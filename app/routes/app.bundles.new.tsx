import { useState } from "react";
import type { ActionFunctionArgs } from "@vercel/remix";
import { json, redirect } from "@vercel/remix";
import { useSubmit, useActionData, useNavigate, useNavigation } from "@remix-run/react";
import {
    Page,
    Layout,
    Card,
    BlockStack,
    TextField,
    Select,
    Button,
    InlineStack,
    Text,
    ResourceItem,
    ResourceList,
    Thumbnail,
    Checkbox,
    Banner,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { syncProductMetafieldsForBundleItems } from "../utils/metafields.server";
import { syncConsolidatedDiscountNode } from "../utils/settings.server";
import {
    deriveBrackets,
    getBracketLabel,
    validateTiers,
    buildVolumeTiersForDb,
} from "../utils/volume-brackets";

export const action = async ({ request }: ActionFunctionArgs) => {
    const { session, admin } = await authenticate.admin(request);
    const formData = await request.formData();

    const title = formData.get("title") as string;
    const type = formData.get("type") as string;
    const priority = 0; // New bundles default to 0 (bottom of the list)
    const discountType = formData.get("discountType") as string;
    const discountValue = parseFloat(formData.get("discountValue") as string);
    const stacksWithProductDiscounts = formData.get("stacksWithProductDiscounts") === "true";
    const stacksWithOrderDiscounts = formData.get("stacksWithOrderDiscounts") === "true";
    const stacksWithShippingDiscounts = formData.get("stacksWithShippingDiscounts") === "true";
    const productIds = formData.getAll("productIds[]") as string[];
    const collectionIds = formData.getAll("collectionIds[]") as string[];
    const targetQuantityRaw = formData.get("targetQuantity");
    const targetQuantity = targetQuantityRaw ? parseInt(targetQuantityRaw as string) : null;
    const tiersJson = formData.get("tiers") as string;
    const tiers = tiersJson ? JSON.parse(tiersJson) : [];

    if (!title || !type || ((type !== "VOLUME" && (!discountType || isNaN(discountValue))) || (type === "VOLUME" && tiers.length === 0)) || (productIds.length === 0 && collectionIds.length === 0)) {
        return json({ error: "Please fill out all fields and select at least one product or collection." }, { status: 400 });
    }

    if (type === "VOLUME") {
        const validationErrors = validateTiers(tiers);
        if (validationErrors.length > 0) {
            return json({
                error: "Fix bracket errors: quantities must increase (e.g., 2, 3, 6).",
                tierErrors: validationErrors,
            }, { status: 400 });
        }
    }

    const itemsContent = [
        ...productIds.map(id => ({ productId: id, requiredQuantity: 1 })),
        ...collectionIds.map(id => ({ collectionId: id, requiredQuantity: 1 }))
    ];

    const volumeTiers = type === "VOLUME" ? buildVolumeTiersForDb(tiers) : [];

    await prisma.bundle.create({
        data: {
            shop: session.shop,
            title: title,
            type: type,
            priority: priority,
            status: "ACTIVE",
            discountType: type === "VOLUME" ? null : discountType,
            discountValue: type === "VOLUME" ? null : discountValue,
            targetQuantity,
            stacksWithProductDiscounts,
            stacksWithOrderDiscounts,
            stacksWithShippingDiscounts,
            items: {
                create: itemsContent,
            },
            tiers: {
                create: volumeTiers
            }
        },
    });

    // --- METAFIELD SYNC LOGIC ---

    // Rebuild theme-facing product metafields for all directly selected and collection-expanded products.
    await syncProductMetafieldsForBundleItems(itemsContent, admin, session.shop);

    // Sync one consolidated Shopify discount node for all active bundles.
    await syncConsolidatedDiscountNode(session.shop, admin);

    return redirect(`/app`);
};

export default function BundleNew() {
    const shopify = useAppBridge();
    const submit = useSubmit();
    const navigate = useNavigate();
    const navigation = useNavigation();
    const actionData = useActionData<typeof action>();

    const [title, setTitle] = useState("");
    const [type, setType] = useState("FBT");
    const [discountType, setDiscountType] = useState("PERCENTAGE");
    const [discountValue, setDiscountValue] = useState("");
    const [stacksWithProductDiscounts, setStacksWithProductDiscounts] = useState(true);
    const [stacksWithOrderDiscounts, setStacksWithOrderDiscounts] = useState(true);
    const [stacksWithShippingDiscounts, setStacksWithShippingDiscounts] = useState(true);
    const [selectedProducts, setSelectedProducts] = useState<any[]>([]);

    // New states
    const [targetQuantity, setTargetQuantity] = useState("3");
    const [selectedCollections, setSelectedCollections] = useState<any[]>([]);
    const [tiers, setTiers] = useState([{ quantity: "2", uncapped: true, discountType: "PERCENTAGE", discountValue: "10" }]);

    const isSaving = navigation.state === "submitting";
    const actionDataTyped = actionData as { error?: string; tierErrors?: { index: number; message: string }[] } | undefined;
    const serverTierErrors = actionDataTyped?.tierErrors;
    const [clientTierErrors, setClientTierErrors] = useState<{ index: number; message: string }[]>([]);
    const tierErrors = serverTierErrors ?? clientTierErrors;
    const hasTierErrors = tierErrors && tierErrors.length > 0;

    const handleSave = () => {
        if (type === "VOLUME") {
            const errors = validateTiers(tiers);
            if (errors.length > 0) {
                setClientTierErrors(errors);
                return;
            }
            setClientTierErrors([]);
        }
        doSubmit();
    };

    const doSubmit = () => {
        const formData = new FormData();
        formData.append("title", title);
        if (type === "VOLUME") {
            formData.append("tiers", JSON.stringify(tiers));
        } else {
            formData.append("discountType", discountType);
            formData.append("discountValue", discountValue);
        }

        if (type === "MIX_MATCH") {
            formData.append("targetQuantity", targetQuantity);
        }

        formData.append("type", type);
        formData.append("stacksWithProductDiscounts", stacksWithProductDiscounts.toString());
        formData.append("stacksWithOrderDiscounts", stacksWithOrderDiscounts.toString());
        formData.append("stacksWithShippingDiscounts", stacksWithShippingDiscounts.toString());

        selectedProducts.forEach((p) => {
            formData.append("productIds[]", p.id);
        });

        selectedCollections.forEach((c) => {
            formData.append("collectionIds[]", c.id);
        });

        submit(formData, { method: "post" });
    };

    const handleSelectProducts = async () => {
        const selected = await shopify.resourcePicker({
            type: "product",
            multiple: true,
            selectionIds: selectedProducts.map((p) => ({ id: p.id })),
        });

        if (selected) {
            setSelectedProducts(selected);
        }
    };

    const handleSelectCollections = async () => {
        const selected = await shopify.resourcePicker({
            type: "collection",
            multiple: true,
            selectionIds: selectedCollections.map((c) => ({ id: c.id })),
        });

        if (selected) {
            setSelectedCollections(selected);
        }
    };

    return (
        <Page
            backAction={{ content: "Bundles", onAction: () => navigate("/app") }}
            title="Create new bundle"
        >
            <TitleBar title="Create new bundle">
                <button variant="primary" onClick={() => handleSave()} disabled={isSaving}>
                    {isSaving ? "Saving..." : "Save bundle"}
                </button>
            </TitleBar>

            <BlockStack gap="500">
                <Layout>
                    <Layout.Section>
                        <BlockStack gap="500">
                            <Card>
                                <BlockStack gap="400">
                                    <Text variant="headingMd" as="h2">
                                        Bundle details
                                    </Text>
                                    {actionData?.error && (
                                        <Text tone="critical" as="p">
                                            {actionData.error}
                                        </Text>
                                    )}
                                    <TextField
                                        label="Bundle title"
                                        value={title}
                                        onChange={setTitle}
                                        autoComplete="off"
                                        helpText="Internal name for your reference."
                                    />
                                    <Select
                                        label="Bundle type"
                                        options={[
                                            { label: "Frequently Bought Together (FBT)", value: "FBT" },
                                            { label: "Volume Pricing (Quantity Breaks)", value: "VOLUME" },
                                            { label: "Mix & Match", value: "MIX_MATCH" },
                                            { label: "Classic Bundle", value: "CLASSIC" },
                                        ]}
                                        value={type}
                                        onChange={setType}
                                    />
                                    {type === "MIX_MATCH" && (
                                        <TextField
                                            label="Required Items (Target Quantity)"
                                            type="number"
                                            value={targetQuantity}
                                            onChange={setTargetQuantity}
                                            autoComplete="off"
                                            helpText="How many items must the customer choose from the pool below to unlock the deal?"
                                        />
                                    )}
                                </BlockStack>
                            </Card>

                            <Card>
                                <BlockStack gap="400">
                                    <Text variant="headingMd" as="h2">
                                        Products & Collections
                                    </Text>
                                    {selectedProducts.length > 0 ? (
                                        <ResourceList
                                            resourceName={{ singular: "product", plural: "products" }}
                                            items={selectedProducts}
                                            renderItem={(item) => {
                                                const { id, title, images } = item;
                                                const media = (
                                                    <Thumbnail
                                                        source={images[0]?.originalSrc || "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png"}
                                                        alt={images[0]?.altText || title}
                                                    />
                                                );

                                                return (
                                                    <ResourceItem id={id} media={media} onClick={() => { }}>
                                                        <Text variant="bodyMd" fontWeight="bold" as="h3">
                                                            {title}
                                                        </Text>
                                                    </ResourceItem>
                                                );
                                            }}
                                        />
                                    ) : (
                                        <Text as="p" tone="subdued">No products selected.</Text>
                                    )}

                                    {type === "MIX_MATCH" && selectedCollections.length > 0 && (
                                        <ResourceList
                                            resourceName={{ singular: "collection", plural: "collections" }}
                                            items={selectedCollections}
                                            renderItem={(item) => {
                                                const { id, title, image } = item;
                                                const media = (
                                                    <Thumbnail
                                                        source={image?.originalSrc || "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png"}
                                                        alt={image?.altText || title}
                                                    />
                                                );

                                                return (
                                                    <ResourceItem id={id} media={media} onClick={() => { }}>
                                                        <Text variant="bodyMd" fontWeight="bold" as="h3">
                                                            {title} (Collection)
                                                        </Text>
                                                    </ResourceItem>
                                                );
                                            }}
                                        />
                                    )}
                                    {type === "MIX_MATCH" && selectedCollections.length === 0 && (
                                        <Text as="p" tone="subdued">No collections selected.</Text>
                                    )}

                                    <InlineStack gap="300">
                                        <Button onClick={handleSelectProducts}>Select products</Button>
                                        {type === "MIX_MATCH" && (
                                            <Button onClick={handleSelectCollections}>Select collections</Button>
                                        )}
                                    </InlineStack>
                                </BlockStack>
                            </Card>

                            <Card>
                                <BlockStack gap="400">
                                    <Text variant="headingMd" as="h2">
                                        Combinations
                                    </Text>
                                    <BlockStack gap="200">
                                        <Checkbox
                                            label="Product discounts"
                                            checked={stacksWithProductDiscounts}
                                            onChange={setStacksWithProductDiscounts}
                                        />
                                        <Checkbox
                                            label="Order discounts"
                                            checked={stacksWithOrderDiscounts}
                                            onChange={setStacksWithOrderDiscounts}
                                        />
                                        <Checkbox
                                            label="Shipping discounts"
                                            checked={stacksWithShippingDiscounts}
                                            onChange={setStacksWithShippingDiscounts}
                                        />
                                    </BlockStack>
                                    <Text variant="bodySm" tone="subdued" as="p">
                                        Allow this bundle discount to be combined with other product, order, or shipping discounts at checkout.
                                    </Text>
                                </BlockStack>
                            </Card>
                        </BlockStack>
                    </Layout.Section>

                    <Layout.Section variant="oneThird">
                        {type !== "VOLUME" ? (
                            <Card>
                                <BlockStack gap="400">
                                    <Text variant="headingMd" as="h2">
                                        Discount
                                    </Text>
                                    <Select
                                        label="Discount type"
                                        options={[
                                            { label: "Percentage (%)", value: "PERCENTAGE" },
                                            { label: "Fixed amount off", value: "FIXED_AMOUNT" },
                                            { label: "Set fixed price", value: "FIXED_PRICE" },
                                        ]}
                                        value={discountType}
                                        onChange={setDiscountType}
                                    />
                                    <TextField
                                        label="Discount value"
                                        type="number"
                                        value={discountValue}
                                        onChange={setDiscountValue}
                                        autoComplete="off"
                                        suffix={discountType === "PERCENTAGE" ? "%" : undefined}
                                        helpText={
                                            discountType === "FIXED_PRICE"
                                                ? "The exact total price the customer will pay for all items combined."
                                                : discountType === "FIXED_AMOUNT"
                                                    ? "The exact dollar amount to deduct from the total price of the items."
                                                    : "The percentage to discount from the total price of the items."
                                        }
                                    />
                                </BlockStack>
                            </Card>
                        ) : (
                            <Card>
                                <BlockStack gap="400">
                                    <Text variant="headingMd" as="h2">
                                        Volume Tiers
                                    </Text>
                                    <Banner tone="info" title="How quantity brackets work">
                                        <p>
                                            Quantity brackets are set automatically. Enter the minimum quantity for each tier (e.g., 2, 3, 6).
                                            Brackets will be: 2-2 items, 3-5 items, 6+ items. Each quantity range gets exactly one discount.
                                        </p>
                                        <p>
                                            Example: Buy 2 = 10%, Buy 3-5 = 15%, Buy 6+ = 20%
                                        </p>
                                    </Banner>
                                    {hasTierErrors && (
                                        <Banner tone="critical" title="Fix bracket errors">
                                            Quantities must increase (e.g., 2, 3, 6). Check the fields below.
                                        </Banner>
                                    )}
                                    {(() => {
                                        const sorted = [...tiers]
                                            .map((t, i) => ({ ...t, originalIndex: i }))
                                            .sort((a, b) => (parseInt(a.quantity) || 0) - (parseInt(b.quantity) || 0));
                                        const validForBrackets = sorted
                                            .filter((t) => !isNaN(parseInt(t.quantity)) && parseInt(t.quantity) >= 1)
                                            .map((t) => ({ quantity: parseInt(t.quantity), uncapped: t.uncapped }));
                                        const brackets = deriveBrackets(validForBrackets);
                                        const bracketByMin = new Map(brackets.map((b) => [b.min, b]));
                                        return sorted.map((tier, sortedIndex) => {
                                            const origIndex = (tier as any).originalIndex;
                                            const qty = parseInt(tier.quantity);
                                            const bracket = !isNaN(qty) && qty >= 1 ? bracketByMin.get(qty) : null;
                                            const bracketLabel = bracket
                                                ? getBracketLabel(bracket.min, bracket.max)
                                                : "—";
                                            const err = tierErrors?.find((e) => e.index === origIndex);
                                            return (
                                                <BlockStack gap="200" key={origIndex}>
                                                    <Text fontWeight="bold" as="p">Tier {sortedIndex + 1}</Text>
                                                    <InlineStack gap="300" blockAlign="start">
                                                        <TextField
                                                            label="Buy Qty"
                                                            type="number"
                                                            value={tier.quantity}
                                                            onChange={(val) => {
                                                                const newTiers = [...tiers];
                                                                newTiers[origIndex].quantity = val;
                                                                setTiers(newTiers);
                                                                setClientTierErrors([]);
                                                            }}
                                                            autoComplete="off"
                                                            helpText="Minimum quantity for this tier. Must be higher than the tier above."
                                                            error={err?.message}
                                                        />
                                                        <BlockStack gap="100">
                                                            <Text as="p" variant="bodySm" tone="subdued">
                                                                Bracket
                                                            </Text>
                                                            <Text as="p" fontWeight="semibold">
                                                                {bracketLabel || "—"}
                                                            </Text>
                                                        </BlockStack>
                                                        <TextField
                                                            label="Discount"
                                                            type="number"
                                                            value={tier.discountValue}
                                                            onChange={(val) => {
                                                                const newTiers = [...tiers];
                                                                newTiers[origIndex].discountValue = val;
                                                                setTiers(newTiers);
                                                            }}
                                                            autoComplete="off"
                                                            connectedLeft={
                                                                <Select
                                                                    label="Type"
                                                                    labelHidden
                                                                    options={[
                                                                        { label: "%", value: "PERCENTAGE" },
                                                                        { label: "$", value: "FIXED_AMOUNT" },
                                                                    ]}
                                                                    value={tier.discountType}
                                                                    onChange={(val) => {
                                                                        const newTiers = [...tiers];
                                                                        newTiers[origIndex].discountType = val;
                                                                        setTiers(newTiers);
                                                                    }}
                                                                />
                                                            }
                                                        />
                                                    </InlineStack>
                                                    {sortedIndex === sorted.length - 1 && (
                                                        <Checkbox
                                                            label={`Apply this discount to all quantities ${tier.quantity || "?"} and above`}
                                                            helpText="Recommended for your best discount tier."
                                                            checked={tier.uncapped ?? true}
                                                            onChange={(checked) => {
                                                                const newTiers = [...tiers];
                                                                newTiers[origIndex].uncapped = checked;
                                                                setTiers(newTiers);
                                                            }}
                                                        />
                                                    )}
                                                    <Button tone="critical" onClick={() => {
                                                        setTiers(tiers.filter((_, i) => i !== origIndex));
                                                        setClientTierErrors([]);
                                                    }}>
                                                        Remove Tier
                                                    </Button>
                                                </BlockStack>
                                            );
                                        });
                                    })()}
                                    <BlockStack gap="100">
                                        <Button onClick={() => {
                                            const lastQty = tiers.length > 0
                                                ? Math.max(...tiers.map((t) => parseInt(t.quantity) || 0), 0) + 1
                                                : 2;
                                            setTiers([...tiers, {
                                                quantity: String(lastQty),
                                                uncapped: true,
                                                discountType: "PERCENTAGE",
                                                discountValue: "",
                                            }]);
                                            setClientTierErrors([]);
                                        }}>
                                            Add tier
                                        </Button>
                                        <Text as="p" variant="bodySm" tone="subdued">
                                            Add another tier. New tier's minimum must be higher than the last.
                                        </Text>
                                    </BlockStack>
                                </BlockStack>
                            </Card>
                        )}
                    </Layout.Section>
                </Layout>
            </BlockStack>
        </Page>
    );
}
