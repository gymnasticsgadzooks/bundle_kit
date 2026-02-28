import prisma from "../db.server";

const PRODUCT_METAFIELD_NAMESPACE = "bundle_app";
const PRODUCT_METAFIELD_KEY = "config";
const MIX_MATCH_PREVIEW_LIMIT = 6;

async function getProductCollectionContext(productId: string, admin: any) {
  const response = await admin.graphql(
    `
      #graphql
      query getProductCollectionContext($id: ID!) {
        product(id: $id) {
          id
          collections(first: 50) {
            nodes {
              id
              handle
            }
          }
        }
      }
    `,
    { variables: { id: productId } },
  );
  const payload = await response.json();
  const nodes = payload.data?.product?.collections?.nodes || [];
  const collectionIds = nodes.map((node: any) => node.id);
  return new Set<string>(collectionIds);
}

async function getProductHandles(productIds: string[], admin: any) {
  if (productIds.length === 0) return new Map<string, string>();
  const graphqlIds = productIds.map((id) => `"${id}"`).join(", ");
  const response = await admin.graphql(`
    #graphql
    query getProductHandles {
      nodes(ids: [${graphqlIds}]) {
        ... on Product {
          id
          handle
        }
      }
    }
  `);
  const payload = await response.json();
  const map = new Map<string, string>();
  (payload.data?.nodes || []).forEach((node: any) => {
    if (node?.id && node?.handle) map.set(node.id, node.handle);
  });
  return map;
}

async function getCollectionThemeContext(collectionIds: string[], admin: any) {
  if (collectionIds.length === 0) {
    return new Map<string, { id: string; handle: string; previewProductHandles: string[]; productIds: string[] }>();
  }

  const graphqlIds = collectionIds.map((id) => `"${id}"`).join(", ");
  const response = await admin.graphql(`
    #graphql
    query getCollectionThemeContext {
      nodes(ids: [${graphqlIds}]) {
        ... on Collection {
          id
          handle
          products(first: 250) {
            nodes {
              id
              handle
            }
          }
        }
      }
    }
  `);
  const payload = await response.json();
  const map = new Map<string, { id: string; handle: string; previewProductHandles: string[]; productIds: string[] }>();
  (payload.data?.nodes || []).forEach((node: any) => {
    if (!node?.id || !node?.handle) return;
    const productNodes = node.products?.nodes || [];
    const handles = productNodes.map((p: any) => p?.handle).filter(Boolean);
    const productIds = productNodes.map((p: any) => p?.id).filter(Boolean);
    map.set(node.id, {
      id: node.id,
      handle: node.handle,
      previewProductHandles: handles.slice(0, MIX_MATCH_PREVIEW_LIMIT),
      productIds,
    });
  });
  return map;
}

async function setProductConfigMetafield(productId: string, value: string, admin: any) {
  const response = await admin.graphql(
    `
      #graphql
      mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          userErrors { field message }
        }
      }
    `,
    {
      variables: {
        metafields: [
          {
            ownerId: productId,
            namespace: PRODUCT_METAFIELD_NAMESPACE,
            key: PRODUCT_METAFIELD_KEY,
            type: "json",
            value,
          },
        ],
      },
    },
  );
  const payload = await response.json();
  const errors = payload.data?.metafieldsSet?.userErrors || [];
  if (errors.length > 0) {
    throw new Error(`Failed to set product metafield for ${productId}: ${JSON.stringify(errors)}`);
  }
}

async function deleteProductConfigMetafield(productId: string, admin: any) {
  await admin.graphql(
    `
      #graphql
      mutation metafieldsDelete($metafields: [MetafieldIdentifierInput!]!) {
        metafieldsDelete(metafields: $metafields) {
          userErrors { field message }
        }
      }
    `,
    {
      variables: {
        metafields: [
          {
            ownerId: productId,
            namespace: PRODUCT_METAFIELD_NAMESPACE,
            key: PRODUCT_METAFIELD_KEY,
          },
        ],
      },
    },
  );
}

/**
 * Ensures `product.metafields.bundle_app.config` contains all ACTIVE bundle
 * data relevant to a product, including MIX_MATCH collection handles and a
 * bounded preview subset for theme rendering.
 */
export async function syncProductMetafield(productId: string, admin: any, shop: string) {
  const productCollectionIds = await getProductCollectionContext(productId, admin);
  const collectionIdList = Array.from(productCollectionIds);

  const itemFilters: any[] = [{ productId }];
  if (collectionIdList.length > 0) {
    itemFilters.push({ collectionId: { in: collectionIdList } });
  }

  const bundles = await prisma.bundle.findMany({
    where: {
      shop,
      status: "ACTIVE",
      items: {
        some: {
          OR: itemFilters,
        },
      },
    },
    include: { items: true, tiers: true },
    orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
  });

  if (bundles.length === 0) {
    await deleteProductConfigMetafield(productId, admin);
    return;
  }

  const directProductIds = new Set<string>();
  const bundleCollectionIds = new Set<string>();
  bundles.forEach((bundle) => {
    bundle.items.forEach((item) => {
      if (item.productId) directProductIds.add(item.productId);
      if (item.collectionId) bundleCollectionIds.add(item.collectionId);
    });
  });

  const productHandleMap = await getProductHandles(Array.from(directProductIds), admin);
  const collectionContextMap = await getCollectionThemeContext(Array.from(bundleCollectionIds), admin);

  const configs = bundles.map((bundle) => {
    const productHandles = bundle.items
      .map((item) => (item.productId ? productHandleMap.get(item.productId) : null))
      .filter(Boolean);

    const collections = bundle.items
      .map((item) => (item.collectionId ? collectionContextMap.get(item.collectionId) : null))
      .filter(Boolean)
      .map((entry: any) => ({
        id: entry.id,
        handle: entry.handle,
        previewProductHandles: entry.previewProductHandles,
      }));

    return {
      id: bundle.id,
      title: bundle.title,
      type: bundle.type,
      targetQuantity: bundle.targetQuantity,
      discountType: bundle.discountType,
      discountValue: Number(bundle.discountValue || 0),
      tiers:
        bundle.tiers?.map((tier) => ({
          quantity: Number(tier.quantity),
          quantityMax: tier.quantityMax != null ? Number(tier.quantityMax) : undefined,
          discountType: tier.discountType,
          discountValue: Number(tier.discountValue),
        })) || [],
      productHandles,
      collections,
    };
  });

  await setProductConfigMetafield(productId, JSON.stringify(configs), admin);
}

export async function syncProductMetafieldsForBundleItems(items: Array<{ productId?: string | null; collectionId?: string | null }>, admin: any, shop: string) {
  const productIds = new Set<string>();
  const collectionIds = new Set<string>();

  items.forEach((item) => {
    if (item.productId) productIds.add(item.productId);
    if (item.collectionId) collectionIds.add(item.collectionId);
  });

  if (collectionIds.size > 0) {
    for (const collectionId of collectionIds) {
      const response = await admin.graphql(
        `
          #graphql
          query getCollectionProducts($id: ID!) {
            collection(id: $id) {
              products(first: 250) {
                nodes { id }
              }
            }
          }
        `,
        { variables: { id: collectionId } },
      );
      const payload = await response.json();
      const collectionProducts = payload.data?.collection?.products?.nodes || [];
      collectionProducts.forEach((node: any) => {
        if (node?.id) productIds.add(node.id);
      });
    }
  }

  for (const id of productIds) {
    await syncProductMetafield(id, admin, shop);
  }
}

export async function syncAllProductMetafields(shop: string, admin: any) {
  const activeBundles = await prisma.bundle.findMany({
    where: { shop, status: "ACTIVE" },
    include: { items: true },
  });

  const allItems = activeBundles.flatMap((bundle) => bundle.items);
  await syncProductMetafieldsForBundleItems(allItems, admin, shop);

  return { productsSynced: allItems.length };
}
