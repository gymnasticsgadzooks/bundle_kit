import prisma from "../db.server";

const CONSOLIDATED_DISCOUNT_TITLE = "BundleKit: Consolidated Bundles";

async function resolveCollectionItems(items: any[], admin: any): Promise<any[]> {
    const resolvedItems: any[] = [];
    for (const item of items) {
        if (item.productId) {
            resolvedItems.push(item);
            continue;
        }
        if (!item.collectionId) continue;
        try {
            const queryRes = await admin.graphql(`
                #graphql
                query getCollectionProducts($id: ID!) {
                    collection(id: $id) {
                        products(first: 250) {
                            nodes { id }
                        }
                    }
                }
            `, { variables: { id: item.collectionId } });
            const queryData = await queryRes.json();
            const productNodes = queryData.data?.collection?.products?.nodes || [];
            for (const p of productNodes) {
                if (!resolvedItems.find(r => r.productId === p.id)) {
                    resolvedItems.push({
                        productId: p.id,
                        collectionId: item.collectionId,
                        requiredQuantity: item.requiredQuantity
                    });
                }
            }
        } catch (e) {
            console.warn(`BundleKit: Could not resolve collection ${item.collectionId} (may be deleted or inaccessible). Skipping.`);
        }
    }
    return resolvedItems;
}

async function resolveFunctionId(admin: any): Promise<string> {
    if (process.env.SHOPIFY_BUNDLE_DISCOUNT_ID) return process.env.SHOPIFY_BUNDLE_DISCOUNT_ID;

    const funcsReq = await admin.graphql(`
        #graphql
        query {
            shopifyFunctions(first: 50) {
                nodes {
                    id
                    title
                    apiType
                }
            }
        }
    `);
    const funcsReqJson = await funcsReq.json();
    const nodes = funcsReqJson.data?.shopifyFunctions?.nodes || [];
    const discountFunc = nodes.find((n: any) => {
        const title = n.title.toLowerCase();
        const apiType = n.apiType.toLowerCase();
        return (
            title.includes("bundle-discount") ||
            apiType === "product_discounts" ||
            apiType === "cart_lines_discounts_generate" ||
            apiType.includes("discounts")
        );
    });
    if (!discountFunc?.id) {
        throw new Error(`Could not find Shopify Function ID. Available functions: ${JSON.stringify(nodes)}`);
    }
    return discountFunc.id;
}

async function ensureShopConfig(shop: string) {
    return prisma.shopConfig.upsert({
        where: { shop },
        update: {},
        create: { shop },
    });
}

async function updateShopConfigNodeId(shop: string, consolidatedNodeId: string | null) {
    await prisma.shopConfig.upsert({
        where: { shop },
        update: { consolidatedNodeId },
        create: { shop, consolidatedNodeId },
    });
}

async function cleanupConsolidatedDiscountsByTitle(
    admin: any,
    title: string,
    keepDiscountId?: string | null,
) {
    const ids = new Set<string>();
    const expectedQuery = `title:${JSON.stringify(title)}`;

    // Primary query shape used by recent Admin APIs.
    try {
        const queryRes = await admin.graphql(`
            #graphql
            query automaticDiscountNodesByTitle($query: String!, $first: Int!) {
                automaticDiscountNodes(query: $query, first: $first) {
                    nodes {
                        automaticDiscount {
                            ... on DiscountAutomaticApp {
                                title
                                discountId
                            }
                        }
                    }
                }
            }
        `, {
            variables: { query: expectedQuery, first: 50 },
        });
        const queryData = await queryRes.json();
        const nodes = queryData.data?.automaticDiscountNodes?.nodes || [];
        for (const node of nodes) {
            const discount = node?.automaticDiscount;
            if (discount?.title === title && discount?.discountId) {
                const numericId = discount.discountId.split("/").pop();
                if (numericId) ids.add(numericId);
            }
        }
    } catch (error: any) {
        console.warn(`BundleKit: automaticDiscountNodes lookup failed: ${error?.message || error}`);
    }

    // Fallback query shape for environments that expose discountNodes.
    if (ids.size === 0) {
        try {
            const queryRes = await admin.graphql(`
                #graphql
                query discountNodesByTitle($query: String!, $first: Int!) {
                    discountNodes(query: $query, first: $first) {
                        nodes {
                            discount {
                                ... on DiscountAutomaticApp {
                                    title
                                    discountId
                                }
                            }
                        }
                    }
                }
            `, {
                variables: { query: expectedQuery, first: 50 },
            });
            const queryData = await queryRes.json();
            const nodes = queryData.data?.discountNodes?.nodes || [];
            for (const node of nodes) {
                const discount = node?.discount;
                if (discount?.title === title && discount?.discountId) {
                    const numericId = discount.discountId.split("/").pop();
                    if (numericId) ids.add(numericId);
                }
            }
        } catch (error: any) {
            console.warn(`BundleKit: discountNodes lookup failed: ${error?.message || error}`);
        }
    }

    for (const numericId of ids) {
        if (!numericId || numericId === keepDiscountId) continue;
        await deleteBundleDiscountNode(numericId, admin);
    }
}

async function auditConsolidatedDiscountState(admin: any, shop: string) {
    try {
        await admin.graphql(`
            #graphql
            query AuditConsolidatedDiscount($query: String!, $namespace: String!, $key: String!) {
                discountNodes(query: $query, first: 20) {
                    nodes {
                        id
                        discount {
                            __typename
                            ... on DiscountAutomaticApp {
                                title
                                status
                                startsAt
                                endsAt
                                discountClasses
                                combinesWith {
                                    orderDiscounts
                                    productDiscounts
                                    shippingDiscounts
                                }
                                metafield(namespace: $namespace, key: $key) {
                                    key
                                    value
                                }
                            }
                        }
                    }
                }
            }
        `, {
            variables: {
                query: `title:${JSON.stringify(CONSOLIDATED_DISCOUNT_TITLE)}`,
                namespace: "bundle_app",
                key: "config",
            },
        });
    } catch (error: any) {
        console.warn(`BundleKit: auditConsolidatedDiscountState failed: ${error?.message || error}`);
    }
}

export async function registerBundleMetafieldDefinitions(admin: any) {
    // Product metafield consumed by theme
    await admin.graphql(`
        #graphql
        mutation MetafieldDefinitionCreate($definition: MetafieldDefinitionInput!) {
            metafieldDefinitionCreate(definition: $definition) {
                createdDefinition { id }
                userErrors { field message code }
            }
        }
    `, {
        variables: {
            definition: {
                name: "Bundle Config",
                namespace: "bundle_app",
                key: "config",
                ownerType: "PRODUCT",
                type: "json",
                description: "BundleKit product-level bundle config payload",
                access: {
                    storefront: "PUBLIC_READ"
                }
            }
        }
    });
}

async function upsertConsolidatedNode(
    admin: any,
    functionId: string,
    shop: string,
    bundleConfigs: any[],
    combinesWith: { orderDiscounts: boolean; productDiscounts: boolean; shippingDiscounts: boolean; }
) {
    const shopConfig = await ensureShopConfig(shop);
    const payloadValue = JSON.stringify(bundleConfigs);
    const payloadBytes = Buffer.byteLength(payloadValue, "utf8");
    if (payloadBytes > 240000) {
        throw new Error(`Consolidated payload too large (${payloadBytes} bytes).`);
    }

    const existingNumericId = shopConfig.consolidatedNodeId;
    const existingGid = existingNumericId ? `gid://shopify/DiscountAutomaticApp/${existingNumericId}` : null;

    if (existingGid) {
        try {
            const updateRes = await admin.graphql(`
                #graphql
                mutation discountAutomaticAppUpdate($id: ID!, $automaticAppDiscount: DiscountAutomaticAppInput!) {
                    discountAutomaticAppUpdate(id: $id, automaticAppDiscount: $automaticAppDiscount) {
                        automaticAppDiscount { discountId }
                        userErrors { field message }
                    }
                }
            `, {
                variables: {
                    id: existingGid,
                    automaticAppDiscount: {
                        title: CONSOLIDATED_DISCOUNT_TITLE,
                        combinesWith,
                        discountClasses: ["PRODUCT", "ORDER"]
                    }
                }
            });
            const updateData = await updateRes.json();
            const updateErrors = updateData.data?.discountAutomaticAppUpdate?.userErrors || [];
            if (updateErrors.length > 0) {
                throw new Error(`Failed to update consolidated discount node: ${JSON.stringify(updateErrors)}`);
            }
            const updateDiscountNodeGid = updateData.data?.discountAutomaticAppUpdate?.automaticAppDiscount?.discountId;
            if (!updateDiscountNodeGid) {
                throw new Error(`Update succeeded but returned no discount node ID. Response: ${JSON.stringify(updateData)}`);
            }
            const metafieldSetRes = await admin.graphql(`
                #graphql
                mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
                    metafieldsSet(metafields: $metafields) {
                        userErrors { field message }
                    }
                }
            `, {
                variables: {
                    metafields: [{
                        ownerId: updateDiscountNodeGid,
                        namespace: "bundle_app",
                        key: "config",
                        type: "json",
                        value: payloadValue
                    }]
                }
            });
            const mfSetData = await metafieldSetRes.json();
            const mfErrors = mfSetData.data?.metafieldsSet?.userErrors || [];
            if (mfErrors.length > 0) {
                throw new Error(`Failed to update consolidated node metafield: ${JSON.stringify(mfErrors)}`);
            }
            await admin.graphql(`
                #graphql
                query DiscountNodeMetafieldCheck($id: ID!, $namespace: String!, $key: String!) {
                    node(id: $id) {
                        ... on DiscountAutomaticNode {
                            id
                            metafield(namespace: $namespace, key: $key) {
                                key
                                value
                            }
                        }
                    }
                }
            `, {
                variables: { id: updateDiscountNodeGid, namespace: "bundle_app", key: "config" }
            });
            await auditConsolidatedDiscountState(admin, shop);
            return { mode: "updated", nodeId: existingNumericId, payloadBytes };
        } catch (err: any) {
            console.warn(`BundleKit: Existing consolidated node appears stale (${existingGid}); recreating. ${err?.message || err}`);
            if (existingNumericId) {
                await deleteBundleDiscountNode(existingNumericId, admin);
            }
            await updateShopConfigNodeId(shop, null);
        }
    }

    await cleanupConsolidatedDiscountsByTitle(admin, CONSOLIDATED_DISCOUNT_TITLE, existingNumericId);

    const createRes = await admin.graphql(`
        #graphql
        mutation discountAutomaticAppCreate($automaticAppDiscount: DiscountAutomaticAppInput!) {
            discountAutomaticAppCreate(automaticAppDiscount: $automaticAppDiscount) {
                automaticAppDiscount { discountId }
                userErrors { field message }
            }
        }
    `, {
        variables: {
            automaticAppDiscount: {
                title: CONSOLIDATED_DISCOUNT_TITLE,
                functionId,
                startsAt: new Date().toISOString(),
                combinesWith,
                discountClasses: ["PRODUCT", "ORDER"],
                metafields: [{
                    namespace: "bundle_app",
                    key: "config",
                    type: "json",
                    value: payloadValue
                }]
            }
        }
    });
    const createData = await createRes.json();
    const createErrors = createData.data?.discountAutomaticAppCreate?.userErrors || [];
    if (createErrors.length > 0) {
        throw new Error(`Failed to create consolidated discount node: ${JSON.stringify(createErrors)}`);
    }
    const createdGid = createData.data?.discountAutomaticAppCreate?.automaticAppDiscount?.discountId;
    if (!createdGid) {
        throw new Error(`Consolidated node creation returned no ID. Full response: ${JSON.stringify(createData)}`);
    }
    const numericId = createdGid.split("/").pop() || null;
    await updateShopConfigNodeId(shop, numericId);
    await admin.graphql(`
        #graphql
        query DiscountNodeMetafieldCheck($id: ID!, $namespace: String!, $key: String!) {
            node(id: $id) {
                ... on DiscountAutomaticNode {
                    id
                    metafield(namespace: $namespace, key: $key) {
                        key
                        value
                    }
                }
            }
        }
    `, {
        variables: { id: createdGid, namespace: "bundle_app", key: "config" }
    });
    await auditConsolidatedDiscountState(admin, shop);
    return { mode: "created", nodeId: numericId, payloadBytes };
}

export async function syncConsolidatedDiscountNode(shop: string, admin: any) {
    await registerBundleMetafieldDefinitions(admin);
    const functionId = await resolveFunctionId(admin);
    const activeBundles = await prisma.bundle.findMany({
        where: { shop, status: "ACTIVE" },
        include: { items: true, tiers: true },
        orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
    });

    if (activeBundles.length === 0) {
        const shopConfig = await ensureShopConfig(shop);
        if (shopConfig.consolidatedNodeId) {
            await deleteBundleDiscountNode(shopConfig.consolidatedNodeId, admin);
            await updateShopConfigNodeId(shop, null);
        }
        return { mode: "deleted_or_empty", bundleCount: 0, nodeId: null, payloadBytes: 0 };
    }

    const bundleConfigs = [];
    for (const bundle of activeBundles) {
        const resolvedItems = await resolveCollectionItems(bundle.items, admin);
        const normalizedItems = resolvedItems.map(item => ({
            productId: item.productId,
            collectionId: item.collectionId,
            requiredQuantity: item.requiredQuantity
        }));
        const normalizedTiers = bundle.tiers?.map((t: any) => ({
            quantity: t.quantity,
            quantityMax: t.quantityMax != null ? t.quantityMax : undefined,
            discountType: t.discountType,
            discountValue: Number(t.discountValue)
        })) || [];

        // VOLUME discounts are tier-driven; emit one config per tier for the
        // function's targetQuantity/discountType/discountValue contract.
        if (bundle.type === "VOLUME" && normalizedTiers.length > 0) {
            for (const tier of normalizedTiers) {
                const tierTitle = tier.quantityMax != null
                    ? `${bundle.title} (Buy ${tier.quantity}-${tier.quantityMax})`
                    : `${bundle.title} (Buy ${tier.quantity}+)`;
                bundleConfigs.push({
                    id: `${bundle.id}:tier:${tier.quantity}`,
                    title: tierTitle,
                    type: bundle.type,
                    priority: bundle.priority,
                    discountType: tier.discountType,
                    discountValue: Number(tier.discountValue || 0),
                    targetQuantity: tier.quantity,
                    targetQuantityMax: tier.quantityMax,
                    items: normalizedItems,
                    tiers: normalizedTiers,
                });
            }
            continue;
        }

        bundleConfigs.push({
            id: bundle.id,
            title: bundle.title,
            type: bundle.type,
            priority: bundle.priority,
            discountType: bundle.discountType,
            discountValue: Number(bundle.discountValue || 0),
            targetQuantity: bundle.targetQuantity,
            items: normalizedItems,
            tiers: normalizedTiers,
        });
    }

    const combinesWith = {
        orderDiscounts: activeBundles.some((b: any) => b.stacksWithOrderDiscounts),
        productDiscounts: activeBundles.some((b: any) => b.stacksWithProductDiscounts),
        shippingDiscounts: activeBundles.some((b: any) => b.stacksWithShippingDiscounts),
    };

    const result = await upsertConsolidatedNode(admin, functionId, shop, bundleConfigs, combinesWith);
    return { ...result, bundleCount: activeBundles.length };
}

// Backward-compatible wrapper while routes are being migrated.
export async function upsertBundleDiscountNode(_bundleId: string, admin: any, shop: string) {
    return syncConsolidatedDiscountNode(shop, admin);
}

export async function deleteBundleDiscountNode(numericId: string, admin: any) {
    const gid = `gid://shopify/DiscountAutomaticApp/${numericId}`;
    const deleteRes = await admin.graphql(`
        #graphql
        mutation discountAutomaticDelete($id: ID!) {
            discountAutomaticDelete(id: $id) {
                deletedAutomaticDiscountId
                userErrors { field message }
            }
        }
     `, {
        variables: { id: gid }
    });
    const deleteData = await deleteRes.json();
    if (deleteData.data?.discountAutomaticDelete?.userErrors?.length > 0) {
        console.error("BundleKit: Error deleting discount node:", deleteData.data.discountAutomaticDelete.userErrors);
    }
}

/**
 * Re-syncs Shopify discount nodes for all ACTIVE bundles that are missing one.
 * Call this from a settings action to recover from state where nodes were never created.
 */
export async function syncAllBundleDiscountNodes(shop: string, admin: any) {
    try {
        const result = await syncConsolidatedDiscountNode(shop, admin);
        return { created: result.bundleCount, failed: 0, total: result.bundleCount, errors: [] };
    } catch (err: any) {
        const msg = err?.message || String(err);
        return { created: 0, failed: 1, total: 1, errors: [msg] };
    }
}

/**
 * Finds all ACTIVE bundles affected by a change to a specific collection or product,
 * then re-syncs the consolidated discount node payload and per-product storefront metafields.
 *
 * Call this from webhooks when collections or products change.
 */
export async function syncBundlesAffectedByEntity(
    shop: string,
    admin: any,
    entity: { collectionId?: string; productId?: string }
) {
    const { collectionId, productId } = entity;

    // Build the query to find affected bundles
    const itemOrConditions: any[] = [];
    if (collectionId) {
        itemOrConditions.push({ collectionId });
    }
    if (productId) {
        itemOrConditions.push({ productId });
    }

    if (itemOrConditions.length === 0) return { synced: 0, failed: 0 };

    const affectedBundles = await prisma.bundle.findMany({
        where: {
            shop,
            status: "ACTIVE",
            items: {
                some: {
                    OR: itemOrConditions,
                },
            },
        },
        include: { items: true },
    });

    if (affectedBundles.length === 0) {
        console.log(`BundleKit: No active bundles affected by entity change.`);
        return { synced: 0, failed: 0 };
    }

    console.log(`BundleKit: Found ${affectedBundles.length} bundle(s) affected by entity change. Re-syncing...`);

    try {
        const productIds = new Set<string>();
        for (const bundle of affectedBundles) {
            for (const item of bundle.items) {
                if (item.productId) productIds.add(item.productId);
            }
            const resolvedItems = await resolveCollectionItems(bundle.items, admin);
            for (const ri of resolvedItems) {
                if (ri.productId) productIds.add(ri.productId);
            }
        }

        const { syncProductMetafield } = await import("./metafields.server");
        for (const pid of productIds) {
            await syncProductMetafield(pid, admin, shop);
        }

        await syncConsolidatedDiscountNode(shop, admin);
        console.log(`BundleKit: Entity sync complete. Synced: ${affectedBundles.length}, Failed: 0`);
        return { synced: affectedBundles.length, failed: 0 };
    } catch (err: any) {
        console.error(`BundleKit: Failed entity sync for ${shop}: ${err?.message || String(err)}`);
        return { synced: 0, failed: 1 };
    }
}
