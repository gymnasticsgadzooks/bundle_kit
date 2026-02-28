import type { LoaderFunctionArgs, ActionFunctionArgs } from "@vercel/remix";
import { json } from "@vercel/remix";
import { useSubmit, useActionData } from "@remix-run/react";
import {
    Page,
    Layout,
    Card,
    BlockStack,
    Text,
    Banner,
    Button,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { syncAllBundleDiscountNodes } from "../utils/settings.server";
import { syncAllProductMetafields } from "../utils/metafields.server";
import { useState, useCallback, useEffect } from "react";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    await authenticate.admin(request);
    return json({ ok: true });
};

export const action = async ({ request }: ActionFunctionArgs) => {
    const { session, admin } = await authenticate.admin(request);
    const formData = await request.formData();

    const intent = formData.get("intent") as string;

    // Handle the re-sync discounts action
    if (intent === "resync_discounts") {
        const [discountSync, productSync] = await Promise.all([
            syncAllBundleDiscountNodes(session.shop, admin),
            syncAllProductMetafields(session.shop, admin),
        ]);
        return json({ success: true, resync: { ...discountSync, ...productSync } });
    }

    return json({ success: false, message: "Unknown intent." }, { status: 400 });
};

export default function Settings() {
    const submit = useSubmit();

    const [syncing, setSyncing] = useState(false);
    const [syncResult, setSyncResult] = useState<{ created: number; failed: number; total: number; errors?: string[]; productsSynced?: number } | null>(null);

    const actionData = useActionData<typeof action>();

    useEffect(() => {
        if (actionData && 'resync' in actionData) {
            setSyncing(false);
            setSyncResult((actionData as any).resync);
        }
    }, [actionData]);

    const handleResync = useCallback(() => {
        setSyncing(true);
        setSyncResult(null);
        const formData = new FormData();
        formData.append("intent", "resync_discounts");
        submit(formData, { method: "post" });
    }, [submit]);

    return (
        <Page>
            <TitleBar title="Settings" />
            <BlockStack gap="500">
                <Layout>
                    <Layout.AnnotatedSection
                        title="Operational Re-sync"
                        description="Re-sync consolidated discount config and product metafields consumed by your theme."
                    >
                        <Card>
                            <BlockStack gap="400">
                                <Text as="p" variant="bodyMd">
                                    This refreshes the single consolidated Shopify discount node and rebuilds product-level bundle metafields.
                                </Text>
                                {syncResult && (
                                    <Banner
                                        tone={syncResult.failed > 0 ? "critical" : "success"}
                                        onDismiss={() => setSyncResult(null)}
                                    >
                                        <BlockStack gap="200">
                                            <Text as="p" variant="bodyMd">
                                                Re-sync complete: {syncResult.created}/{syncResult.total} bundles synced
                                                {syncResult.failed > 0 ? ` (${syncResult.failed} failed)` : " successfully."}.
                                            </Text>
                                            {'productsSynced' in syncResult && (
                                                <Text as="p" variant="bodyMd">
                                                    Product metafields refreshed for approximately {syncResult.productsSynced} bundle item references.
                                                </Text>
                                            )}
                                            {syncResult.errors && syncResult.errors.length > 0 && (
                                                <BlockStack gap="100">
                                                    {syncResult.errors.map((err, i) => (
                                                        <Text as="p" key={i} variant="bodySm" tone="critical">{err}</Text>
                                                    ))}
                                                </BlockStack>
                                            )}
                                        </BlockStack>
                                    </Banner>
                                )}
                                <Button
                                    onClick={handleResync}
                                    loading={syncing}
                                    disabled={syncing}
                                >
                                    Re-sync Theme + Discounts
                                </Button>
                            </BlockStack>
                        </Card>
                    </Layout.AnnotatedSection>
                </Layout>
            </BlockStack>
        </Page>
    );
}
