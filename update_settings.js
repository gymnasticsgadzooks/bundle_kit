const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'app/utils/settings.server.ts');
let content = fs.readFileSync(file, 'utf8');
const searchString = "export async function syncActiveBundles(shop: string, admin: any) {";
const index = content.indexOf(searchString);

if (index !== -1) {
    const newContent = content.substring(0, index) + `export async function upsertBundleDiscountNode(bundleId: string, admin: any, shop: string) {
    const bundle = await prisma.bundle.findUnique({
        where: { id: bundleId },
        include: { items: true, tiers: true }
    });

    if (!bundle) return;

    let functionId = process.env.SHOPIFY_BUNDLE_DISCOUNT_ID;

    if (!functionId) {
        const funcsReq = await admin.graphql(\`
            #graphql
            query {
                shopifyFunctions(first: 50) {
                    nodes { id title apiType }
                }
            }
        \`);
        const funcsReqJson = await funcsReq.json();
        const nodes = funcsReqJson.data?.shopifyFunctions?.nodes || [];
        const discountFunc = nodes.find(
            (n: any) => n.title.includes("bundle-discount") || n.apiType === "product_discounts"
        );
        if (discountFunc) {
            functionId = discountFunc.id;
        }
    }

    if (!functionId) {
        console.warn("BundleKit: Missing SHOPIFY_BUNDLE_DISCOUNT_ID. Cannot auto-activate discount node for this bundle.");
        return;
    }

    const configData = {
        id: bundle.id,
        title: bundle.title,
        type: bundle.type,
        discountType: bundle.discountType,
        discountValue: Number(bundle.discountValue || 0),
        targetQuantity: bundle.targetQuantity,
        items: bundle.items.map(item => ({
            productId: item.productId,
            collectionId: item.collectionId,
            requiredQuantity: item.requiredQuantity
        })),
        tiers: bundle.tiers?.map((t: any) => ({
            quantity: t.quantity,
            discountType: t.discountType,
            discountValue: Number(t.discountValue)
        })) || []
    };

    const combinesWith = {
        orderDiscounts: bundle.stacksWithOrderDiscounts,
        productDiscounts: bundle.stacksWithProductDiscounts,
        shippingDiscounts: bundle.stacksWithShippingDiscounts
    };

    let shopifyDiscountId = bundle.shopifyDiscountId;
    let gid = shopifyDiscountId ? \`gid://shopify/DiscountAutomaticApp/\${shopifyDiscountId}\` : null;

    if (bundle.status !== "ACTIVE") {
        if (shopifyDiscountId) {
           await deleteBundleDiscountNode(shopifyDiscountId, admin);
           await prisma.bundle.update({
               where: { id: bundle.id },
               data: { shopifyDiscountId: null }
           });
        }
        return;
    }

    const metafieldData = {
        namespace: "bundle_app",
        key: "config",
        type: "json",
        value: JSON.stringify(configData)
    };

    if (gid) {
        const updateRes = await admin.graphql(\`
            #graphql
            mutation discountAutomaticAppUpdate($id: ID!, $automaticAppDiscount: DiscountAutomaticAppInput!) {
                discountAutomaticAppUpdate(id: $id, automaticAppDiscount: $automaticAppDiscount) {
                    automaticAppDiscount { id }
                    userErrors { field message }
                }
            }
        \`, {
            variables: {
                id: gid,
                automaticAppDiscount: {
                    title: \`Bundle: \${bundle.title}\`,
                    combinesWith,
                    metafields: [metafieldData]
                }
            }
        });
        const updateData = await updateRes.json();
    } else {
        const createRes = await admin.graphql(\`
            #graphql
            mutation discountAutomaticAppCreate($automaticAppDiscount: DiscountAutomaticAppInput!) {
                discountAutomaticAppCreate(automaticAppDiscount: $automaticAppDiscount) {
                    automaticAppDiscount { id }
                    userErrors { field message }
                }
            }
        \`, {
            variables: {
                automaticAppDiscount: {
                    title: \`Bundle: \${bundle.title}\`,
                    functionId,
                    startsAt: new Date().toISOString(),
                    combinesWith,
                    metafields: [metafieldData]
                }
            }
        });
        const createData = await createRes.json();
        const newGid = createData.data?.discountAutomaticAppCreate?.automaticAppDiscount?.id;
        if (newGid) {
            const numericId = newGid.split("/").pop();
            await prisma.bundle.update({
                where: { id: bundle.id },
                data: { shopifyDiscountId: numericId }
            });
        }
    }
}

export async function deleteBundleDiscountNode(numericId: string, admin: any) {
     const gid = \`gid://shopify/DiscountAutomaticApp/\${numericId}\`;
     const deleteRes = await admin.graphql(\`
        #graphql
        mutation discountAutomaticDelete($id: ID!) {
            discountAutomaticDelete(id: $id) {
                deletedAutomaticDiscountId
                userErrors { field message }
            }
        }
     \`, {
        variables: { id: gid }
     });
}
`;
    fs.writeFileSync(file, newContent);
    console.log("Successfully updated settings.server.ts");
} else {
    console.error("Could not find syncActiveBundles");
}
