import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Page, Card, BlockStack, Text, Banner, Box, InlineStack, Badge, Button } from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { syncAllBundleDiscountNodes } from "../utils/settings.server";

export const action = async ({ request }: LoaderFunctionArgs) => {
    const { session, admin } = await authenticate.admin(request);
    const result = await syncAllBundleDiscountNodes(session.shop, admin);
    return json({ resynced: true, result });
};

async function postDebugLog(_payload: {
    runId: string;
    hypothesisId: string;
    location: string;
    message: string;
    data: Record<string, unknown>;
}) {
    // Intentionally no-op. (Used during an interactive debug session.)
}

interface DiagnosticBundle {
    db: {
        id: string;
        title: string;
        type: string;
        status: string;
        discountType: string | null;
        discountValue: number | null;
        targetQuantity: number | null;
        shopifyDiscountId: string | null;
        itemCount: number;
        items: Array<{ productId: string | null; collectionId: string | null; requiredQuantity: number }>;
        tierCount: number;
        tiers: Array<{ quantity: number; discountType: string; discountValue: number }>;
    };
    shopify: {
        nodeExists: boolean;
        nodeStatus: string | null;
        nodeTitle: string | null;
        functionId: string | null;
        functionApiType: string | null;
        discountClasses: string[] | null;
        metafieldValue: string | null;
        metafieldParsed: unknown;
        combinesWith: unknown;
        errors: string[];
    };
    validation: {
        hasDiscountNode: boolean;
        nodeIsActive: boolean;
        metafieldExists: boolean;
        metafieldHasItems: boolean;
        metafieldProductIdsAreGids: boolean;
        functionIsCartLines: boolean;
        discountClassIncludesProduct: boolean;
        issues: string[];
    };
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const { session, admin } = await authenticate.admin(request);

    // Check the consolidated node from ShopConfig (bundle_kit architecture)
    const shopConfig = await prisma.shopConfig.findUnique({ where: { shop: session.shop } });

    const bundles = await prisma.bundle.findMany({
        where: { shop: session.shop },
        include: { items: true, tiers: true },
        orderBy: { createdAt: "desc" },
    });

    // Fetch all Shopify Functions to see what's available
    const funcsReq = await admin.graphql(`
        #graphql
        query {
            shopifyFunctions(first: 50) {
                nodes {
                    id
                    title
                    apiType
                    app { title }
                }
            }
        }
    `);
    const funcsData = await funcsReq.json();
    const allFunctions = funcsData.data?.shopifyFunctions?.nodes || [];

    // Check consolidated discount node on Shopify
    let consolidatedNode: any = null;
    let consolidatedNodeError: string | null = null;
    if (shopConfig?.consolidatedNodeId) {
        // The discountNode query requires a DiscountAutomaticNode GID, not DiscountAutomaticApp.
        // The update mutation returns discountId as DiscountAutomaticNode, confirming this is the correct type.
        const gid = `gid://shopify/DiscountAutomaticNode/${shopConfig.consolidatedNodeId}`;
        try {
            const nodeRes = await admin.graphql(`
                #graphql
                query getDiscountNode($id: ID!) {
                    discountNode(id: $id) {
                        id
                        discount {
                            ... on DiscountAutomaticApp {
                                title
                                status
                                appDiscountType { functionId title }
                                discountClasses
                                combinesWith { orderDiscounts productDiscounts shippingDiscounts }
                            }
                        }
                        metafield(namespace: "bundle_app", key: "config") { value }
                    }
                }
            `, { variables: { id: gid } });
            const nodeData = await nodeRes.json();
            consolidatedNode = nodeData.data?.discountNode || null;
            if (!consolidatedNode) consolidatedNodeError = `Node ${gid} not found on Shopify (may have been deleted)`;
        } catch (e: any) {
            consolidatedNodeError = e?.message || String(e);
        }
    }

    const consolidatedIssues: string[] = [];
    if (!shopConfig?.consolidatedNodeId) {
        consolidatedIssues.push("CRITICAL: ShopConfig.consolidatedNodeId is null — consolidated discount node was never created. Click 'Re-sync Discount Nodes' below.");
    } else if (consolidatedNodeError) {
        consolidatedIssues.push(`CRITICAL: ${consolidatedNodeError}`);
    } else if (consolidatedNode) {
        const status = consolidatedNode.discount?.status;
        if (status !== "ACTIVE") consolidatedIssues.push(`WARNING: Consolidated discount node status is "${status}" (not ACTIVE)`);
        if (!consolidatedNode.metafield?.value) consolidatedIssues.push("CRITICAL: Consolidated node exists but has NO metafield (bundle_app.config)");
        if (!consolidatedNode.discount?.discountClasses?.includes("PRODUCT")) {
            consolidatedIssues.push(`CRITICAL: discountClasses=${JSON.stringify(consolidatedNode.discount?.discountClasses)} — missing PRODUCT`);
        }
        if (consolidatedNode.metafield?.value) {
            try {
                const parsed = JSON.parse(consolidatedNode.metafield.value);
                const arr = Array.isArray(parsed) ? parsed : [parsed];
                const badIds = arr.flatMap((c: any) => (c.items || []).filter((i: any) => !i.productId?.startsWith("gid://shopify/Product/")).map((i: any) => i.productId));
                if (badIds.length > 0) consolidatedIssues.push(`CRITICAL: Some metafield productIds are not GIDs: ${JSON.stringify(badIds)}`);
            } catch {
                consolidatedIssues.push("CRITICAL: Metafield value is not valid JSON");
            }
        }
    }

    await postDebugLog({
        runId: "diag-2",
        hypothesisId: "DIAG",
        location: "app/routes/app.debug.tsx:loader",
        message: "Consolidated node diagnostic",
        data: {
            shop: session.shop,
            shopConfigConsolidatedNodeId: shopConfig?.consolidatedNodeId ?? null,
            bundleCount: bundles.length,
            allFunctions: allFunctions.map((f: any) => ({ id: f.id, title: f.title, apiType: f.apiType })),
            consolidatedNodeExists: !!consolidatedNode,
            consolidatedNodeStatus: consolidatedNode?.discount?.status ?? null,
            consolidatedNodeDiscountClasses: consolidatedNode?.discount?.discountClasses ?? null,
            consolidatedNodeFunctionId: consolidatedNode?.discount?.appDiscountType?.functionId ?? null,
            consolidatedNodeFunctionTitle: consolidatedNode?.discount?.appDiscountType?.title ?? null,
            consolidatedNodeHasMetafield: !!consolidatedNode?.metafield?.value,
            consolidatedNodeMetafieldLength: consolidatedNode?.metafield?.value?.length ?? 0,
            consolidatedNodeMetafieldPreview: (consolidatedNode?.metafield?.value ?? "").slice(0, 220),
            consolidatedIssues,
        },
    });

    const diagnostics: DiagnosticBundle[] = [];

    for (const bundle of bundles) {
        const dbInfo: DiagnosticBundle["db"] = {
            id: bundle.id,
            title: bundle.title,
            type: bundle.type,
            status: bundle.status,
            discountType: bundle.discountType,
            discountValue: bundle.discountValue ? Number(bundle.discountValue) : null,
            targetQuantity: bundle.targetQuantity,
            shopifyDiscountId: bundle.shopifyDiscountId,
            itemCount: bundle.items.length,
            items: bundle.items.map((i) => ({
                productId: i.productId,
                collectionId: i.collectionId,
                requiredQuantity: i.requiredQuantity,
            })),
            tierCount: bundle.tiers.length,
            tiers: bundle.tiers.map((t) => ({
                quantity: t.quantity,
                discountType: t.discountType,
                discountValue: Number(t.discountValue),
            })),
        };

        const shopifyInfo: DiagnosticBundle["shopify"] = {
            nodeExists: false,
            nodeStatus: null,
            nodeTitle: null,
            functionId: null,
            functionApiType: null,
            discountClasses: null,
            metafieldValue: null,
            metafieldParsed: null,
            combinesWith: null,
            errors: [],
        };

        if (bundle.shopifyDiscountId) {
            // Per-bundle nodes (legacy) also use the DiscountAutomaticNode GID type for lookups
            const gid = `gid://shopify/DiscountAutomaticNode/${bundle.shopifyDiscountId}`;
            try {
                const nodeRes = await admin.graphql(`
                    #graphql
                    query getDiscountNode($id: ID!) {
                        discountNode(id: $id) {
                            id
                            discount {
                                ... on DiscountAutomaticApp {
                                    title
                                    status
                                    appDiscountType {
                                        functionId
                                        title
                                    }
                                    discountClasses
                                    combinesWith {
                                        orderDiscounts
                                        productDiscounts
                                        shippingDiscounts
                                    }
                                }
                            }
                            metafield(namespace: "bundle_app", key: "config") {
                                value
                            }
                        }
                    }
                `, { variables: { id: gid } });

                const nodeData = await nodeRes.json();
                const node = nodeData.data?.discountNode;

                if (node) {
                    shopifyInfo.nodeExists = true;
                    shopifyInfo.nodeStatus = node.discount?.status || null;
                    shopifyInfo.nodeTitle = node.discount?.title || null;
                    shopifyInfo.functionId = node.discount?.appDiscountType?.functionId || null;
                    shopifyInfo.discountClasses = node.discount?.discountClasses || null;
                    shopifyInfo.combinesWith = node.discount?.combinesWith || null;
                    shopifyInfo.metafieldValue = node.metafield?.value || null;

                    if (shopifyInfo.functionId) {
                        const matchedFunc = allFunctions.find((f: any) => f.id === shopifyInfo.functionId);
                        shopifyInfo.functionApiType = matchedFunc?.apiType || "UNKNOWN (not found in functions list)";
                    }

                    if (shopifyInfo.metafieldValue) {
                        try {
                            shopifyInfo.metafieldParsed = JSON.parse(shopifyInfo.metafieldValue);
                        } catch {
                            shopifyInfo.errors.push("Metafield value is not valid JSON");
                        }
                    }
                } else {
                    shopifyInfo.errors.push(`Discount node ${gid} not found on Shopify (may have been deleted)`);
                }
            } catch (e: any) {
                shopifyInfo.errors.push(`Failed to query discount node: ${e?.message || String(e)}`);
            }
        }

        // Validation checks
        const issues: string[] = [];

        // In bundle_kit's consolidated-node architecture, all bundles are covered by a single
        // DiscountAutomaticNode stored in ShopConfig.consolidatedNodeId — not per-bundle nodes.
        // Per-bundle shopifyDiscountId is intentionally null and should not be flagged.
        const hasDiscountNode = shopifyInfo.nodeExists;
        if (!hasDiscountNode && bundle.status === "ACTIVE" && bundle.shopifyDiscountId) {
            // Only flag if there was a per-bundle ID stored but the node is gone
            issues.push("WARNING: Bundle had a per-bundle discount node but it no longer exists on Shopify");
        }

        const nodeIsActive = shopifyInfo.nodeStatus === "ACTIVE";
        if (hasDiscountNode && !nodeIsActive) {
            issues.push(`WARNING: Discount node exists but status is "${shopifyInfo.nodeStatus}" (not ACTIVE)`);
        }

        const metafieldExists = !!shopifyInfo.metafieldValue;
        if (hasDiscountNode && !metafieldExists) {
            issues.push("CRITICAL: Discount node exists but has NO metafield (bundle_app.config)");
        }

        let metafieldHasItems = false;
        let metafieldProductIdsAreGids = false;
        if (shopifyInfo.metafieldParsed) {
            const parsed: any = shopifyInfo.metafieldParsed;
            const config = Array.isArray(parsed) ? parsed[0] : parsed;
            metafieldHasItems = Array.isArray(config?.items) && config.items.length > 0;
            if (!metafieldHasItems) {
                issues.push("CRITICAL: Metafield config has no items array or it's empty");
            }
            if (metafieldHasItems) {
                const allGids = config.items.every((i: any) => typeof i.productId === "string" && i.productId.startsWith("gid://shopify/Product/"));
                metafieldProductIdsAreGids = allGids;
                if (!allGids) {
                    issues.push("CRITICAL: Some metafield item productIds are NOT full Shopify GIDs (function won't match cart lines)");
                    const badIds = config.items.filter((i: any) => !i.productId?.startsWith("gid://shopify/Product/")).map((i: any) => i.productId);
                    issues.push(`  Bad productIds: ${JSON.stringify(badIds)}`);
                }

                const allHaveReqQty = config.items.every((i: any) => Number(i.requiredQuantity) > 0);
                if (!allHaveReqQty) {
                    issues.push("WARNING: Some metafield items have requiredQuantity <= 0 or missing");
                }
            }

            if (bundle.type !== "VOLUME" && !config?.discountType) {
                issues.push("CRITICAL: Non-volume bundle config has null/missing discountType — function won't generate any discount candidate");
            }
            if (bundle.type !== "VOLUME" && (config?.discountValue === undefined || config?.discountValue === null || config?.discountValue === 0)) {
                issues.push("WARNING: discountValue is 0 or missing — discount will be $0");
            }
        }

        const functionIsCartLines = shopifyInfo.functionApiType === "cart_lines_discounts_generate" || shopifyInfo.functionApiType?.includes("cart_lines");
        if (hasDiscountNode && shopifyInfo.functionId && !functionIsCartLines) {
            issues.push(`CRITICAL: Function apiType is "${shopifyInfo.functionApiType}" — should be "cart_lines_discounts_generate" for product discounts`);
        }

        const discountClassIncludesProduct = shopifyInfo.discountClasses?.includes("PRODUCT") ?? false;
        if (hasDiscountNode && !discountClassIncludesProduct) {
            issues.push(`CRITICAL: Discount node discountClasses=${JSON.stringify(shopifyInfo.discountClasses)} — missing "PRODUCT" class`);
        }

        if (shopifyInfo.errors.length > 0) {
            issues.push(...shopifyInfo.errors.map((e) => `ERROR: ${e}`));
        }

        diagnostics.push({
            db: dbInfo,
            shopify: shopifyInfo,
            validation: {
                hasDiscountNode,
                nodeIsActive,
                metafieldExists,
                metafieldHasItems,
                metafieldProductIdsAreGids,
                functionIsCartLines,
                discountClassIncludesProduct,
                issues,
            },
        });
    }

    await postDebugLog({
        runId: "diag-1",
        hypothesisId: "DIAG",
        location: "app/routes/app.debug.tsx:loader",
        message: "Full bundle diagnostic dump",
        data: {
            shop: session.shop,
            bundleCount: bundles.length,
            allFunctions: allFunctions.map((f: any) => ({ id: f.id, title: f.title, apiType: f.apiType })),
            diagnostics: diagnostics as any,
        },
    });

    return json({
        shop: session.shop,
        allFunctions,
        diagnostics,
        envFunctionId: process.env.SHOPIFY_BUNDLE_DISCOUNT_ID || "(not set)",
        shopConfig: { consolidatedNodeId: shopConfig?.consolidatedNodeId ?? null },
        consolidatedNode,
        consolidatedIssues,
    });
};

export default function DebugPage() {
    const { shop, allFunctions, diagnostics, envFunctionId, shopConfig, consolidatedNode, consolidatedIssues } = useLoaderData<typeof loader>();

    const handleResync = () => {
        const form = document.createElement("form");
        form.method = "post";
        document.body.appendChild(form);
        form.submit();
    };

    return (
        <Page title="Bundle Diagnostics">
            <TitleBar title="Bundle Diagnostics" />
            <BlockStack gap="500">

                {/* Consolidated Node — the most important card */}
                <Card>
                    <BlockStack gap="300">
                        <InlineStack gap="300" align="start">
                            <Text variant="headingMd" as="h2">Consolidated Discount Node</Text>
                            {(consolidatedIssues as string[]).length === 0
                                ? <Badge tone="success">HEALTHY</Badge>
                                : <Badge tone="critical">BROKEN</Badge>}
                        </InlineStack>
                        <Text as="p"><strong>ShopConfig.consolidatedNodeId:</strong> {shopConfig.consolidatedNodeId ?? "(null — not created yet)"}</Text>
                        {consolidatedNode && (
                            <>
                                <Text as="p"><strong>Status:</strong> {(consolidatedNode as any)?.discount?.status}</Text>
                                <Text as="p"><strong>Discount Classes:</strong> {JSON.stringify((consolidatedNode as any)?.discount?.discountClasses)}</Text>
                                <Text as="p"><strong>Metafield present:</strong> {(consolidatedNode as any)?.metafield?.value ? `Yes (${(consolidatedNode as any).metafield.value.length} chars)` : "No"}</Text>
                            </>
                        )}
                        {(consolidatedIssues as string[]).length > 0 && (
                            <Banner tone="critical" title="Issues Found">
                                <BlockStack gap="100">
                                    {(consolidatedIssues as string[]).map((issue: string, i: number) => (
                                        <Text as="p" key={i}>{issue}</Text>
                                    ))}
                                </BlockStack>
                            </Banner>
                        )}
                        <Button variant="primary" onClick={handleResync}>Re-sync Discount Nodes Now</Button>
                    </BlockStack>
                </Card>

                <Card>
                    <BlockStack gap="300">
                        <Text variant="headingMd" as="h2">Environment</Text>
                        <Text as="p"><strong>Shop:</strong> {shop}</Text>
                        <Text as="p"><strong>SHOPIFY_BUNDLE_DISCOUNT_ID:</strong> {envFunctionId}</Text>
                    </BlockStack>
                </Card>

                <Card>
                    <BlockStack gap="300">
                        <Text variant="headingMd" as="h2">Available Shopify Functions ({allFunctions.length})</Text>
                        {allFunctions.map((f: any) => (
                            <Box key={f.id} padding="200" background="bg-surface-secondary" borderRadius="200">
                                <Text as="p"><strong>{f.title}</strong> — apiType: {f.apiType} — ID: <code>{f.id}</code></Text>
                            </Box>
                        ))}
                    </BlockStack>
                </Card>

                {diagnostics.map((d: any, idx: number) => {
                    const hasIssues = d.validation.issues.length > 0;
                    const isHealthy = !hasIssues && d.db.status === "ACTIVE" && d.validation.nodeIsActive;

                    return (
                        <Card key={d.db.id}>
                            <BlockStack gap="400">
                                <InlineStack gap="300" align="start">
                                    <Text variant="headingMd" as="h2">
                                        {d.db.title}
                                    </Text>
                                    <Badge tone={d.db.status === "ACTIVE" ? "success" : "warning"}>
                                        {d.db.status}
                                    </Badge>
                                    <Badge>{d.db.type}</Badge>
                                    {isHealthy && <Badge tone="success">HEALTHY</Badge>}
                                    {hasIssues && <Badge tone="critical">ISSUES FOUND</Badge>}
                                </InlineStack>

                                {hasIssues && (
                                    <Banner tone="critical" title="Validation Issues">
                                        <BlockStack gap="100">
                                            {d.validation.issues.map((issue: string, i: number) => (
                                                <Text as="p" key={i}>{issue}</Text>
                                            ))}
                                        </BlockStack>
                                    </Banner>
                                )}

                                <Text variant="headingSm" as="h3">Database State</Text>
                                <Box padding="200" background="bg-surface-secondary" borderRadius="200">
                                    <pre style={{ fontSize: "12px", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                                        {JSON.stringify(d.db, null, 2)}
                                    </pre>
                                </Box>

                                <Text variant="headingSm" as="h3">Shopify Discount Node</Text>
                                <Box padding="200" background="bg-surface-secondary" borderRadius="200">
                                    <pre style={{ fontSize: "12px", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                                        {JSON.stringify(d.shopify, null, 2)}
                                    </pre>
                                </Box>

                                <Text variant="headingSm" as="h3">Validation Summary</Text>
                                <Box padding="200" background="bg-surface-secondary" borderRadius="200">
                                    <pre style={{ fontSize: "12px", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                                        {JSON.stringify(d.validation, null, 2)}
                                    </pre>
                                </Box>
                            </BlockStack>
                        </Card>
                    );
                })}
            </BlockStack>
        </Page>
    );
}
