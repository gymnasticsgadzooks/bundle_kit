var _a;
import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { PassThrough } from "stream";
import { renderToPipeableStream } from "react-dom/server";
import { RemixServer, Meta, Links, Outlet, ScrollRestoration, Scripts, useLoaderData, useActionData, Form, Link, useRouteError, useSubmit, useNavigate, useNavigation } from "@remix-run/react";
import { createReadableStreamFromReadable, redirect, json } from "@remix-run/node";
import { isbot } from "isbot";
import "@shopify/shopify-app-remix/adapters/node";
import { shopifyApp, AppDistribution, ApiVersion, LoginErrorType, boundary } from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import { PrismaClient } from "@prisma/client";
import { useState, useEffect, useCallback } from "react";
import { AppProvider, Page, Card, FormLayout, Text, TextField, Button, BlockStack, Layout, Select, ResourceList, Thumbnail, ResourceItem, InlineStack, Checkbox, Banner, Link as Link$1, List, Box, IndexTable, EmptyState, Icon, Badge } from "@shopify/polaris";
import { AppProvider as AppProvider$1 } from "@shopify/shopify-app-remix/react";
import { NavMenu, useAppBridge, TitleBar } from "@shopify/app-bridge-react";
import { DragHandleIcon } from "@shopify/polaris-icons";
import { useSensors, useSensor, PointerSensor, KeyboardSensor, DndContext, closestCenter } from "@dnd-kit/core";
import { sortableKeyboardCoordinates, arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
if (process.env.NODE_ENV !== "production") {
  if (!global.prismaGlobal) {
    global.prismaGlobal = new PrismaClient();
  }
}
const prisma = global.prismaGlobal ?? new PrismaClient();
const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.January25,
  scopes: (_a = process.env.SCOPES) == null ? void 0 : _a.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  future: {
    unstable_newEmbeddedAuthStrategy: true,
    expiringOfflineAccessTokens: true
  },
  hooks: {
    afterAuth: async ({ session, admin }) => {
      try {
        const { registerBundleMetafieldDefinitions: registerBundleMetafieldDefinitions2, syncConsolidatedDiscountNode: syncConsolidatedDiscountNode2 } = await Promise.resolve().then(() => settings_server);
        await registerBundleMetafieldDefinitions2(admin);
        await syncConsolidatedDiscountNode2(session.shop, admin);
      } catch (error) {
        console.error("BundleKit: afterAuth setup failed", error);
      }
    }
  },
  ...process.env.SHOP_CUSTOM_DOMAIN ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] } : {}
});
ApiVersion.January25;
const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
const authenticate = shopify.authenticate;
shopify.unauthenticated;
const login = shopify.login;
shopify.registerWebhooks;
shopify.sessionStorage;
const streamTimeout = 5e3;
async function handleRequest(request, responseStatusCode, responseHeaders, remixContext) {
  addDocumentResponseHeaders(request, responseHeaders);
  const userAgent = request.headers.get("user-agent");
  const callbackName = isbot(userAgent ?? "") ? "onAllReady" : "onShellReady";
  return new Promise((resolve, reject) => {
    const { pipe, abort } = renderToPipeableStream(
      /* @__PURE__ */ jsx(
        RemixServer,
        {
          context: remixContext,
          url: request.url
        }
      ),
      {
        [callbackName]: () => {
          const body = new PassThrough();
          const stream = createReadableStreamFromReadable(body);
          responseHeaders.set("Content-Type", "text/html");
          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode
            })
          );
          pipe(body);
        },
        onShellError(error) {
          reject(error);
        },
        onError(error) {
          responseStatusCode = 500;
          console.error(error);
        }
      }
    );
    setTimeout(abort, streamTimeout + 1e3);
  });
}
const entryServer = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: handleRequest,
  streamTimeout
}, Symbol.toStringTag, { value: "Module" }));
function App$2() {
  return /* @__PURE__ */ jsxs("html", { children: [
    /* @__PURE__ */ jsxs("head", { children: [
      /* @__PURE__ */ jsx("meta", { charSet: "utf-8" }),
      /* @__PURE__ */ jsx("meta", { name: "viewport", content: "width=device-width,initial-scale=1" }),
      /* @__PURE__ */ jsx("link", { rel: "preconnect", href: "https://cdn.shopify.com/" }),
      /* @__PURE__ */ jsx(
        "link",
        {
          rel: "stylesheet",
          href: "https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
        }
      ),
      /* @__PURE__ */ jsx("link", { rel: "icon", type: "image/png", href: "/logo.png" }),
      /* @__PURE__ */ jsx(Meta, {}),
      /* @__PURE__ */ jsx(Links, {})
    ] }),
    /* @__PURE__ */ jsxs("body", { children: [
      /* @__PURE__ */ jsx(Outlet, {}),
      /* @__PURE__ */ jsx(ScrollRestoration, {}),
      /* @__PURE__ */ jsx(Scripts, {})
    ] })
  ] });
}
const route0 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: App$2
}, Symbol.toStringTag, { value: "Module" }));
const CONSOLIDATED_DISCOUNT_TITLE = "BundleKit: Consolidated Bundles";
async function resolveCollectionItems(items, admin) {
  var _a2, _b, _c;
  const resolvedItems = [];
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
      const productNodes = ((_c = (_b = (_a2 = queryData.data) == null ? void 0 : _a2.collection) == null ? void 0 : _b.products) == null ? void 0 : _c.nodes) || [];
      for (const p of productNodes) {
        if (!resolvedItems.find((r) => r.productId === p.id)) {
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
async function resolveFunctionId(admin) {
  var _a2, _b;
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
  const nodes = ((_b = (_a2 = funcsReqJson.data) == null ? void 0 : _a2.shopifyFunctions) == null ? void 0 : _b.nodes) || [];
  fetch("http://127.0.0.1:7665/ingest/10e41b89-e35d-4666-ad18-f1b09f5cc832", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "e4134a" }, body: JSON.stringify({ sessionId: "e4134a", runId: "pre-fix", hypothesisId: "H6", location: "app/utils/settings.server.ts:resolveFunctionId:nodes", message: "shopify functions discovered", data: { functionCount: nodes.length, functions: nodes.map((n) => ({ id: n.id, title: n.title, apiType: n.apiType })) }, timestamp: Date.now() }) }).catch(() => {
  });
  const discountFunc = nodes.find((n) => {
    const title = n.title.toLowerCase();
    const apiType = n.apiType.toLowerCase();
    return title.includes("bundle-discount") || apiType === "product_discounts" || apiType === "cart_lines_discounts_generate" || apiType.includes("discounts");
  });
  if (!(discountFunc == null ? void 0 : discountFunc.id)) {
    throw new Error(`Could not find Shopify Function ID. Available functions: ${JSON.stringify(nodes)}`);
  }
  fetch("http://127.0.0.1:7665/ingest/10e41b89-e35d-4666-ad18-f1b09f5cc832", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "e4134a" }, body: JSON.stringify({ sessionId: "e4134a", runId: "pre-fix", hypothesisId: "H6", location: "app/utils/settings.server.ts:resolveFunctionId:selected", message: "selected function id", data: { selected: { id: discountFunc.id, title: discountFunc.title, apiType: discountFunc.apiType } }, timestamp: Date.now() }) }).catch(() => {
  });
  return discountFunc.id;
}
async function ensureShopConfig(shop) {
  return prisma.shopConfig.upsert({
    where: { shop },
    update: {},
    create: { shop }
  });
}
async function updateShopConfigNodeId(shop, consolidatedNodeId) {
  await prisma.shopConfig.upsert({
    where: { shop },
    update: { consolidatedNodeId },
    create: { shop, consolidatedNodeId }
  });
}
async function cleanupConsolidatedDiscountsByTitle(admin, title, keepDiscountId) {
  var _a2, _b, _c, _d;
  const ids = /* @__PURE__ */ new Set();
  const expectedQuery = `title:${JSON.stringify(title)}`;
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
      variables: { query: expectedQuery, first: 50 }
    });
    const queryData = await queryRes.json();
    const nodes = ((_b = (_a2 = queryData.data) == null ? void 0 : _a2.automaticDiscountNodes) == null ? void 0 : _b.nodes) || [];
    for (const node of nodes) {
      const discount = node == null ? void 0 : node.automaticDiscount;
      if ((discount == null ? void 0 : discount.title) === title && (discount == null ? void 0 : discount.discountId)) {
        const numericId = discount.discountId.split("/").pop();
        if (numericId) ids.add(numericId);
      }
    }
  } catch (error) {
    console.warn(`BundleKit: automaticDiscountNodes lookup failed: ${(error == null ? void 0 : error.message) || error}`);
  }
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
        variables: { query: expectedQuery, first: 50 }
      });
      const queryData = await queryRes.json();
      const nodes = ((_d = (_c = queryData.data) == null ? void 0 : _c.discountNodes) == null ? void 0 : _d.nodes) || [];
      for (const node of nodes) {
        const discount = node == null ? void 0 : node.discount;
        if ((discount == null ? void 0 : discount.title) === title && (discount == null ? void 0 : discount.discountId)) {
          const numericId = discount.discountId.split("/").pop();
          if (numericId) ids.add(numericId);
        }
      }
    } catch (error) {
      console.warn(`BundleKit: discountNodes lookup failed: ${(error == null ? void 0 : error.message) || error}`);
    }
  }
  for (const numericId of ids) {
    if (!numericId || numericId === keepDiscountId) continue;
    await deleteBundleDiscountNode(numericId, admin);
  }
}
async function auditConsolidatedDiscountState(admin, shop) {
  var _a2, _b;
  try {
    const auditRes = await admin.graphql(`
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
        key: "config"
      }
    });
    const auditData = await auditRes.json();
    const nodes = ((_b = (_a2 = auditData == null ? void 0 : auditData.data) == null ? void 0 : _a2.discountNodes) == null ? void 0 : _b.nodes) || [];
    fetch("http://127.0.0.1:7665/ingest/10e41b89-e35d-4666-ad18-f1b09f5cc832", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "e4134a" }, body: JSON.stringify({ sessionId: "e4134a", runId: "post-fix", hypothesisId: "H11", location: "app/utils/settings.server.ts:auditConsolidatedDiscountState", message: "consolidated discount audit", data: { shop, nodeCount: nodes.length, nodes: nodes.map((n) => {
      var _a3, _b2, _c, _d, _e, _f, _g, _h, _i, _j, _k;
      return { id: n.id, typename: (_a3 = n.discount) == null ? void 0 : _a3.__typename, title: (_b2 = n.discount) == null ? void 0 : _b2.title, status: (_c = n.discount) == null ? void 0 : _c.status, startsAt: (_d = n.discount) == null ? void 0 : _d.startsAt, endsAt: (_e = n.discount) == null ? void 0 : _e.endsAt, discountClasses: (_f = n.discount) == null ? void 0 : _f.discountClasses, combinesWith: (_g = n.discount) == null ? void 0 : _g.combinesWith, hasMetafield: Boolean((_h = n.discount) == null ? void 0 : _h.metafield), metafieldValueLength: ((_k = (_j = (_i = n.discount) == null ? void 0 : _i.metafield) == null ? void 0 : _j.value) == null ? void 0 : _k.length) || 0 };
    }) }, timestamp: Date.now() }) }).catch(() => {
    });
  } catch (error) {
    fetch("http://127.0.0.1:7665/ingest/10e41b89-e35d-4666-ad18-f1b09f5cc832", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "e4134a" }, body: JSON.stringify({ sessionId: "e4134a", runId: "post-fix", hypothesisId: "H11", location: "app/utils/settings.server.ts:auditConsolidatedDiscountState:error", message: "consolidated discount audit failed", data: { shop, errorMessage: (error == null ? void 0 : error.message) || String(error) }, timestamp: Date.now() }) }).catch(() => {
    });
  }
}
async function registerBundleMetafieldDefinitions(admin) {
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
        description: "BundleKit product-level bundle config payload"
      }
    }
  });
}
async function upsertConsolidatedNode(admin, functionId, shop, bundleConfigs, combinesWith) {
  var _a2, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _A, _B, _C, _D, _E, _F, _G;
  const shopConfig = await ensureShopConfig(shop);
  const payloadValue = JSON.stringify(bundleConfigs);
  const payloadBytes = Buffer.byteLength(payloadValue, "utf8");
  if (payloadBytes > 24e4) {
    throw new Error(`Consolidated payload too large (${payloadBytes} bytes).`);
  }
  const existingNumericId = shopConfig.consolidatedNodeId;
  const existingGid = existingNumericId ? `gid://shopify/DiscountAutomaticApp/${existingNumericId}` : null;
  fetch("http://127.0.0.1:7665/ingest/10e41b89-e35d-4666-ad18-f1b09f5cc832", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "e4134a" }, body: JSON.stringify({ sessionId: "e4134a", runId: "pre-fix", hypothesisId: "H4", location: "app/utils/settings.server.ts:upsertConsolidatedNode:entry", message: "upsert consolidated node", data: { shop, existingNumericId, hasExistingGid: Boolean(existingGid), bundleCount: bundleConfigs.length, payloadBytes, combinesWith }, timestamp: Date.now() }) }).catch(() => {
  });
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
      fetch("http://127.0.0.1:7665/ingest/10e41b89-e35d-4666-ad18-f1b09f5cc832", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "e4134a" }, body: JSON.stringify({ sessionId: "e4134a", runId: "pre-fix", hypothesisId: "H8", location: "app/utils/settings.server.ts:upsertConsolidatedNode:updateResponse", message: "update mutation response", data: { shop, existingGid, response: (_a2 = updateData == null ? void 0 : updateData.data) == null ? void 0 : _a2.discountAutomaticAppUpdate, userErrors: ((_c = (_b = updateData == null ? void 0 : updateData.data) == null ? void 0 : _b.discountAutomaticAppUpdate) == null ? void 0 : _c.userErrors) || [] }, timestamp: Date.now() }) }).catch(() => {
      });
      const updateErrors = ((_e = (_d = updateData.data) == null ? void 0 : _d.discountAutomaticAppUpdate) == null ? void 0 : _e.userErrors) || [];
      if (updateErrors.length > 0) {
        throw new Error(`Failed to update consolidated discount node: ${JSON.stringify(updateErrors)}`);
      }
      const updateDiscountNodeGid = (_h = (_g = (_f = updateData.data) == null ? void 0 : _f.discountAutomaticAppUpdate) == null ? void 0 : _g.automaticAppDiscount) == null ? void 0 : _h.discountId;
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
      const mfErrors = ((_j = (_i = mfSetData.data) == null ? void 0 : _i.metafieldsSet) == null ? void 0 : _j.userErrors) || [];
      fetch("http://127.0.0.1:7665/ingest/10e41b89-e35d-4666-ad18-f1b09f5cc832", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "e4134a" }, body: JSON.stringify({ sessionId: "e4134a", runId: "post-fix", hypothesisId: "H9", location: "app/utils/settings.server.ts:upsertConsolidatedNode:updateMetafieldSet", message: "update metafield set response", data: { shop, ownerId: updateDiscountNodeGid, userErrors: mfErrors }, timestamp: Date.now() }) }).catch(() => {
      });
      if (mfErrors.length > 0) {
        throw new Error(`Failed to update consolidated node metafield: ${JSON.stringify(mfErrors)}`);
      }
      const updateMetafieldCheckRes = await admin.graphql(`
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
      const updateMetafieldCheckData = await updateMetafieldCheckRes.json();
      fetch("http://127.0.0.1:7665/ingest/10e41b89-e35d-4666-ad18-f1b09f5cc832", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "e4134a" }, body: JSON.stringify({ sessionId: "e4134a", runId: "post-fix", hypothesisId: "H10", location: "app/utils/settings.server.ts:upsertConsolidatedNode:updateMetafieldCheck", message: "update metafield check", data: { shop, discountNodeId: updateDiscountNodeGid, hasMetafield: Boolean((_l = (_k = updateMetafieldCheckData == null ? void 0 : updateMetafieldCheckData.data) == null ? void 0 : _k.node) == null ? void 0 : _l.metafield), metafieldValueLength: ((_p = (_o = (_n = (_m = updateMetafieldCheckData == null ? void 0 : updateMetafieldCheckData.data) == null ? void 0 : _m.node) == null ? void 0 : _n.metafield) == null ? void 0 : _o.value) == null ? void 0 : _p.length) || 0, metafieldPreview: (((_s = (_r = (_q = updateMetafieldCheckData == null ? void 0 : updateMetafieldCheckData.data) == null ? void 0 : _q.node) == null ? void 0 : _r.metafield) == null ? void 0 : _s.value) || "").slice(0, 180) }, timestamp: Date.now() }) }).catch(() => {
      });
      fetch("http://127.0.0.1:7665/ingest/10e41b89-e35d-4666-ad18-f1b09f5cc832", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "e4134a" }, body: JSON.stringify({ sessionId: "e4134a", runId: "pre-fix", hypothesisId: "H4", location: "app/utils/settings.server.ts:upsertConsolidatedNode:updateSuccess", message: "updated consolidated node", data: { shop, nodeId: existingNumericId, payloadBytes }, timestamp: Date.now() }) }).catch(() => {
      });
      await auditConsolidatedDiscountState(admin, shop);
      return { mode: "updated", nodeId: existingNumericId, payloadBytes };
    } catch (err) {
      console.warn(`BundleKit: Existing consolidated node appears stale (${existingGid}); recreating. ${(err == null ? void 0 : err.message) || err}`);
      fetch("http://127.0.0.1:7665/ingest/10e41b89-e35d-4666-ad18-f1b09f5cc832", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "e4134a" }, body: JSON.stringify({ sessionId: "e4134a", runId: "pre-fix", hypothesisId: "H5", location: "app/utils/settings.server.ts:upsertConsolidatedNode:updateCatch", message: "update path failed", data: { shop, existingGid, errorMessage: (err == null ? void 0 : err.message) || String(err) }, timestamp: Date.now() }) }).catch(() => {
      });
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
        startsAt: (/* @__PURE__ */ new Date()).toISOString(),
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
  fetch("http://127.0.0.1:7665/ingest/10e41b89-e35d-4666-ad18-f1b09f5cc832", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "e4134a" }, body: JSON.stringify({ sessionId: "e4134a", runId: "pre-fix", hypothesisId: "H8", location: "app/utils/settings.server.ts:upsertConsolidatedNode:createResponse", message: "create mutation response", data: { shop, functionId, response: (_t = createData == null ? void 0 : createData.data) == null ? void 0 : _t.discountAutomaticAppCreate, userErrors: ((_v = (_u = createData == null ? void 0 : createData.data) == null ? void 0 : _u.discountAutomaticAppCreate) == null ? void 0 : _v.userErrors) || [] }, timestamp: Date.now() }) }).catch(() => {
  });
  const createErrors = ((_x = (_w = createData.data) == null ? void 0 : _w.discountAutomaticAppCreate) == null ? void 0 : _x.userErrors) || [];
  if (createErrors.length > 0) {
    throw new Error(`Failed to create consolidated discount node: ${JSON.stringify(createErrors)}`);
  }
  const createdGid = (_A = (_z = (_y = createData.data) == null ? void 0 : _y.discountAutomaticAppCreate) == null ? void 0 : _z.automaticAppDiscount) == null ? void 0 : _A.discountId;
  if (!createdGid) {
    throw new Error(`Consolidated node creation returned no ID. Full response: ${JSON.stringify(createData)}`);
  }
  const numericId = createdGid.split("/").pop() || null;
  await updateShopConfigNodeId(shop, numericId);
  const createMetafieldCheckRes = await admin.graphql(`
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
  const createMetafieldCheckData = await createMetafieldCheckRes.json();
  fetch("http://127.0.0.1:7665/ingest/10e41b89-e35d-4666-ad18-f1b09f5cc832", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "e4134a" }, body: JSON.stringify({ sessionId: "e4134a", runId: "post-fix", hypothesisId: "H9", location: "app/utils/settings.server.ts:upsertConsolidatedNode:createMetafieldCheck", message: "create metafield check", data: { shop, discountNodeId: createdGid, hasMetafield: Boolean((_C = (_B = createMetafieldCheckData == null ? void 0 : createMetafieldCheckData.data) == null ? void 0 : _B.node) == null ? void 0 : _C.metafield), metafieldValueLength: ((_G = (_F = (_E = (_D = createMetafieldCheckData == null ? void 0 : createMetafieldCheckData.data) == null ? void 0 : _D.node) == null ? void 0 : _E.metafield) == null ? void 0 : _F.value) == null ? void 0 : _G.length) || 0 }, timestamp: Date.now() }) }).catch(() => {
  });
  fetch("http://127.0.0.1:7665/ingest/10e41b89-e35d-4666-ad18-f1b09f5cc832", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "e4134a" }, body: JSON.stringify({ sessionId: "e4134a", runId: "pre-fix", hypothesisId: "H4", location: "app/utils/settings.server.ts:upsertConsolidatedNode:createSuccess", message: "created consolidated node", data: { shop, nodeId: numericId, payloadBytes, bundleCount: bundleConfigs.length }, timestamp: Date.now() }) }).catch(() => {
  });
  await auditConsolidatedDiscountState(admin, shop);
  return { mode: "created", nodeId: numericId, payloadBytes };
}
async function syncConsolidatedDiscountNode(shop, admin) {
  var _a2, _b;
  fetch("http://127.0.0.1:7665/ingest/10e41b89-e35d-4666-ad18-f1b09f5cc832", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "e4134a" }, body: JSON.stringify({ sessionId: "e4134a", runId: "pre-fix", hypothesisId: "H1", location: "app/utils/settings.server.ts:syncConsolidatedDiscountNode:entry", message: "sync start", data: { shop }, timestamp: Date.now() }) }).catch(() => {
  });
  await registerBundleMetafieldDefinitions(admin);
  const functionId = await resolveFunctionId(admin);
  const activeBundles = await prisma.bundle.findMany({
    where: { shop, status: "ACTIVE" },
    include: { items: true, tiers: true },
    orderBy: [{ priority: "desc" }, { updatedAt: "desc" }]
  });
  fetch("http://127.0.0.1:7665/ingest/10e41b89-e35d-4666-ad18-f1b09f5cc832", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "e4134a" }, body: JSON.stringify({ sessionId: "e4134a", runId: "pre-fix", hypothesisId: "H1", location: "app/utils/settings.server.ts:syncConsolidatedDiscountNode:activeBundles", message: "active bundles loaded", data: { shop, bundleCount: activeBundles.length, bundles: activeBundles.map((b) => {
    var _a3, _b2;
    return { id: b.id, type: b.type, discountType: b.discountType, discountValue: Number(b.discountValue || 0), targetQuantity: b.targetQuantity, itemCount: ((_a3 = b.items) == null ? void 0 : _a3.length) || 0, tierCount: ((_b2 = b.tiers) == null ? void 0 : _b2.length) || 0 };
  }) }, timestamp: Date.now() }) }).catch(() => {
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
    fetch("http://127.0.0.1:7665/ingest/10e41b89-e35d-4666-ad18-f1b09f5cc832", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "e4134a" }, body: JSON.stringify({ sessionId: "e4134a", runId: "pre-fix", hypothesisId: "H2", location: "app/utils/settings.server.ts:syncConsolidatedDiscountNode:resolvedItems", message: "bundle items resolved", data: { bundleId: bundle.id, bundleType: bundle.type, rawItemCount: ((_a2 = bundle.items) == null ? void 0 : _a2.length) || 0, resolvedItemCount: resolvedItems.length, rawItems: (bundle.items || []).slice(0, 6).map((i) => ({ productId: i.productId, collectionId: i.collectionId, requiredQuantity: i.requiredQuantity })), resolvedItems: (resolvedItems || []).slice(0, 6).map((i) => ({ productId: i.productId, collectionId: i.collectionId, requiredQuantity: i.requiredQuantity })) }, timestamp: Date.now() }) }).catch(() => {
    });
    const normalizedItems = resolvedItems.map((item) => ({
      productId: item.productId,
      collectionId: item.collectionId,
      requiredQuantity: item.requiredQuantity
    }));
    const normalizedTiers = ((_b = bundle.tiers) == null ? void 0 : _b.map((t) => ({
      quantity: t.quantity,
      quantityMax: t.quantityMax != null ? t.quantityMax : void 0,
      discountType: t.discountType,
      discountValue: Number(t.discountValue)
    }))) || [];
    if (bundle.type === "VOLUME" && normalizedTiers.length > 0) {
      for (const tier of normalizedTiers) {
        const tierTitle = tier.quantityMax != null ? `${bundle.title} (Buy ${tier.quantity}-${tier.quantityMax})` : `${bundle.title} (Buy ${tier.quantity}+)`;
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
          tiers: normalizedTiers
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
      tiers: normalizedTiers
    });
  }
  fetch("http://127.0.0.1:7665/ingest/10e41b89-e35d-4666-ad18-f1b09f5cc832", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "e4134a" }, body: JSON.stringify({ sessionId: "e4134a", runId: "pre-fix", hypothesisId: "H3", location: "app/utils/settings.server.ts:syncConsolidatedDiscountNode:bundleConfigs", message: "bundle configs prepared", data: { bundleCount: bundleConfigs.length, bundleConfigs: bundleConfigs.map((b) => {
    var _a3, _b2;
    return { id: b.id, type: b.type, discountType: b.discountType, discountValue: b.discountValue, targetQuantity: b.targetQuantity, itemCount: ((_a3 = b.items) == null ? void 0 : _a3.length) || 0, tierCount: ((_b2 = b.tiers) == null ? void 0 : _b2.length) || 0, firstItems: (b.items || []).slice(0, 4) };
  }) }, timestamp: Date.now() }) }).catch(() => {
  });
  const combinesWith = {
    orderDiscounts: activeBundles.some((b) => b.stacksWithOrderDiscounts),
    productDiscounts: activeBundles.some((b) => b.stacksWithProductDiscounts),
    shippingDiscounts: activeBundles.some((b) => b.stacksWithShippingDiscounts)
  };
  const result = await upsertConsolidatedNode(admin, functionId, shop, bundleConfigs, combinesWith);
  return { ...result, bundleCount: activeBundles.length };
}
async function upsertBundleDiscountNode(_bundleId, admin, shop) {
  return syncConsolidatedDiscountNode(shop, admin);
}
async function deleteBundleDiscountNode(numericId, admin) {
  var _a2, _b, _c;
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
  if (((_c = (_b = (_a2 = deleteData.data) == null ? void 0 : _a2.discountAutomaticDelete) == null ? void 0 : _b.userErrors) == null ? void 0 : _c.length) > 0) {
    console.error("BundleKit: Error deleting discount node:", deleteData.data.discountAutomaticDelete.userErrors);
  }
}
async function syncAllBundleDiscountNodes(shop, admin) {
  try {
    const result = await syncConsolidatedDiscountNode(shop, admin);
    return { created: result.bundleCount, failed: 0, total: result.bundleCount, errors: [] };
  } catch (err) {
    const msg = (err == null ? void 0 : err.message) || String(err);
    return { created: 0, failed: 1, total: 1, errors: [msg] };
  }
}
async function syncBundlesAffectedByEntity(shop, admin, entity) {
  const { collectionId, productId } = entity;
  const itemOrConditions = [];
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
          OR: itemOrConditions
        }
      }
    },
    include: { items: true }
  });
  if (affectedBundles.length === 0) {
    console.log(`BundleKit: No active bundles affected by entity change.`);
    return { synced: 0, failed: 0 };
  }
  console.log(`BundleKit: Found ${affectedBundles.length} bundle(s) affected by entity change. Re-syncing...`);
  try {
    const productIds = /* @__PURE__ */ new Set();
    for (const bundle of affectedBundles) {
      for (const item of bundle.items) {
        if (item.productId) productIds.add(item.productId);
      }
      const resolvedItems = await resolveCollectionItems(bundle.items, admin);
      for (const ri of resolvedItems) {
        if (ri.productId) productIds.add(ri.productId);
      }
    }
    const { syncProductMetafield: syncProductMetafield2 } = await Promise.resolve().then(() => metafields_server);
    for (const pid of productIds) {
      await syncProductMetafield2(pid, admin, shop);
    }
    await syncConsolidatedDiscountNode(shop, admin);
    console.log(`BundleKit: Entity sync complete. Synced: ${affectedBundles.length}, Failed: 0`);
    return { synced: affectedBundles.length, failed: 0 };
  } catch (err) {
    console.error(`BundleKit: Failed entity sync for ${shop}: ${(err == null ? void 0 : err.message) || String(err)}`);
    return { synced: 0, failed: 1 };
  }
}
const settings_server = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  deleteBundleDiscountNode,
  registerBundleMetafieldDefinitions,
  syncAllBundleDiscountNodes,
  syncBundlesAffectedByEntity,
  syncConsolidatedDiscountNode,
  upsertBundleDiscountNode
}, Symbol.toStringTag, { value: "Module" }));
const action$8 = async ({ request }) => {
  const { topic, shop, admin, payload } = await authenticate.webhook(request);
  if (!admin) {
    return new Response();
  }
  console.log(`BundleKit: Received ${topic} webhook for shop ${shop}`);
  try {
    const adminGraphqlApiId = payload == null ? void 0 : payload.admin_graphql_api_id;
    if (!adminGraphqlApiId) {
      console.warn(`BundleKit: ${topic} webhook payload missing admin_graphql_api_id. Payload keys: ${Object.keys(payload).join(", ")}`);
      return new Response("No entity ID in payload", { status: 200 });
    }
    switch (topic) {
      case "COLLECTIONS_UPDATE":
      case "COLLECTIONS_DELETE": {
        await syncBundlesAffectedByEntity(shop, admin, { collectionId: adminGraphqlApiId });
        break;
      }
      case "PRODUCTS_UPDATE":
      case "PRODUCTS_DELETE": {
        await syncBundlesAffectedByEntity(shop, admin, { productId: adminGraphqlApiId });
        break;
      }
      default:
        console.warn(`BundleKit: Unhandled webhook topic: ${topic}`);
    }
    console.log(`BundleKit: Successfully processed ${topic} webhook for shop ${shop}`);
  } catch (error) {
    console.error(`BundleKit: Error processing ${topic} webhook:`, error);
  }
  return new Response("Webhook processed", { status: 200 });
};
const route1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$8
}, Symbol.toStringTag, { value: "Module" }));
const action$7 = async ({ request }) => {
  const { payload, session, topic, shop } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);
  const current = payload.current;
  if (session) {
    await prisma.session.update({
      where: {
        id: session.id
      },
      data: {
        scope: current.toString()
      }
    });
  }
  return new Response();
};
const route2 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$7
}, Symbol.toStringTag, { value: "Module" }));
const action$6 = async ({ request }) => {
  const { shop, session, topic } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);
  if (session) {
    await prisma.session.deleteMany({ where: { shop } });
  }
  return new Response();
};
const route3 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$6
}, Symbol.toStringTag, { value: "Module" }));
const Polaris = /* @__PURE__ */ JSON.parse('{"ActionMenu":{"Actions":{"moreActions":"More actions"},"RollupActions":{"rollupButton":"View actions"}},"ActionList":{"SearchField":{"clearButtonLabel":"Clear","search":"Search","placeholder":"Search actions"}},"Avatar":{"label":"Avatar","labelWithInitials":"Avatar with initials {initials}"},"Autocomplete":{"spinnerAccessibilityLabel":"Loading","ellipsis":"{content}…"},"Badge":{"PROGRESS_LABELS":{"incomplete":"Incomplete","partiallyComplete":"Partially complete","complete":"Complete"},"TONE_LABELS":{"info":"Info","success":"Success","warning":"Warning","critical":"Critical","attention":"Attention","new":"New","readOnly":"Read-only","enabled":"Enabled"},"progressAndTone":"{toneLabel} {progressLabel}"},"Banner":{"dismissButton":"Dismiss notification"},"Button":{"spinnerAccessibilityLabel":"Loading"},"Common":{"checkbox":"checkbox","undo":"Undo","cancel":"Cancel","clear":"Clear","close":"Close","submit":"Submit","more":"More"},"ContextualSaveBar":{"save":"Save","discard":"Discard"},"DataTable":{"sortAccessibilityLabel":"sort {direction} by","navAccessibilityLabel":"Scroll table {direction} one column","totalsRowHeading":"Totals","totalRowHeading":"Total"},"DatePicker":{"previousMonth":"Show previous month, {previousMonthName} {showPreviousYear}","nextMonth":"Show next month, {nextMonth} {nextYear}","today":"Today ","start":"Start of range","end":"End of range","months":{"january":"January","february":"February","march":"March","april":"April","may":"May","june":"June","july":"July","august":"August","september":"September","october":"October","november":"November","december":"December"},"days":{"monday":"Monday","tuesday":"Tuesday","wednesday":"Wednesday","thursday":"Thursday","friday":"Friday","saturday":"Saturday","sunday":"Sunday"},"daysAbbreviated":{"monday":"Mo","tuesday":"Tu","wednesday":"We","thursday":"Th","friday":"Fr","saturday":"Sa","sunday":"Su"}},"DiscardConfirmationModal":{"title":"Discard all unsaved changes","message":"If you discard changes, you’ll delete any edits you made since you last saved.","primaryAction":"Discard changes","secondaryAction":"Continue editing"},"DropZone":{"single":{"overlayTextFile":"Drop file to upload","overlayTextImage":"Drop image to upload","overlayTextVideo":"Drop video to upload","actionTitleFile":"Add file","actionTitleImage":"Add image","actionTitleVideo":"Add video","actionHintFile":"or drop file to upload","actionHintImage":"or drop image to upload","actionHintVideo":"or drop video to upload","labelFile":"Upload file","labelImage":"Upload image","labelVideo":"Upload video"},"allowMultiple":{"overlayTextFile":"Drop files to upload","overlayTextImage":"Drop images to upload","overlayTextVideo":"Drop videos to upload","actionTitleFile":"Add files","actionTitleImage":"Add images","actionTitleVideo":"Add videos","actionHintFile":"or drop files to upload","actionHintImage":"or drop images to upload","actionHintVideo":"or drop videos to upload","labelFile":"Upload files","labelImage":"Upload images","labelVideo":"Upload videos"},"errorOverlayTextFile":"File type is not valid","errorOverlayTextImage":"Image type is not valid","errorOverlayTextVideo":"Video type is not valid"},"EmptySearchResult":{"altText":"Empty search results"},"Frame":{"skipToContent":"Skip to content","navigationLabel":"Navigation","Navigation":{"closeMobileNavigationLabel":"Close navigation"}},"FullscreenBar":{"back":"Back","accessibilityLabel":"Exit fullscreen mode"},"Filters":{"moreFilters":"More filters","moreFiltersWithCount":"More filters ({count})","filter":"Filter {resourceName}","noFiltersApplied":"No filters applied","cancel":"Cancel","done":"Done","clearAllFilters":"Clear all filters","clear":"Clear","clearLabel":"Clear {filterName}","addFilter":"Add filter","clearFilters":"Clear all","searchInView":"in:{viewName}"},"FilterPill":{"clear":"Clear","unsavedChanges":"Unsaved changes - {label}"},"IndexFilters":{"searchFilterTooltip":"Search and filter","searchFilterTooltipWithShortcut":"Search and filter (F)","searchFilterAccessibilityLabel":"Search and filter results","sort":"Sort your results","addView":"Add a new view","newView":"Custom search","SortButton":{"ariaLabel":"Sort the results","tooltip":"Sort","title":"Sort by","sorting":{"asc":"Ascending","desc":"Descending","az":"A-Z","za":"Z-A"}},"EditColumnsButton":{"tooltip":"Edit columns","accessibilityLabel":"Customize table column order and visibility"},"UpdateButtons":{"cancel":"Cancel","update":"Update","save":"Save","saveAs":"Save as","modal":{"title":"Save view as","label":"Name","sameName":"A view with this name already exists. Please choose a different name.","save":"Save","cancel":"Cancel"}}},"IndexProvider":{"defaultItemSingular":"Item","defaultItemPlural":"Items","allItemsSelected":"All {itemsLength}+ {resourceNamePlural} are selected","selected":"{selectedItemsCount} selected","a11yCheckboxDeselectAllSingle":"Deselect {resourceNameSingular}","a11yCheckboxSelectAllSingle":"Select {resourceNameSingular}","a11yCheckboxDeselectAllMultiple":"Deselect all {itemsLength} {resourceNamePlural}","a11yCheckboxSelectAllMultiple":"Select all {itemsLength} {resourceNamePlural}"},"IndexTable":{"emptySearchTitle":"No {resourceNamePlural} found","emptySearchDescription":"Try changing the filters or search term","onboardingBadgeText":"New","resourceLoadingAccessibilityLabel":"Loading {resourceNamePlural}…","selectAllLabel":"Select all {resourceNamePlural}","selected":"{selectedItemsCount} selected","undo":"Undo","selectAllItems":"Select all {itemsLength}+ {resourceNamePlural}","selectItem":"Select {resourceName}","selectButtonText":"Select","sortAccessibilityLabel":"sort {direction} by"},"Loading":{"label":"Page loading bar"},"Modal":{"iFrameTitle":"body markup","modalWarning":"These required properties are missing from Modal: {missingProps}"},"Page":{"Header":{"rollupActionsLabel":"View actions for {title}","pageReadyAccessibilityLabel":"{title}. This page is ready"}},"Pagination":{"previous":"Previous","next":"Next","pagination":"Pagination"},"ProgressBar":{"negativeWarningMessage":"Values passed to the progress prop shouldn’t be negative. Resetting {progress} to 0.","exceedWarningMessage":"Values passed to the progress prop shouldn’t exceed 100. Setting {progress} to 100."},"ResourceList":{"sortingLabel":"Sort by","defaultItemSingular":"item","defaultItemPlural":"items","showing":"Showing {itemsCount} {resource}","showingTotalCount":"Showing {itemsCount} of {totalItemsCount} {resource}","loading":"Loading {resource}","selected":"{selectedItemsCount} selected","allItemsSelected":"All {itemsLength}+ {resourceNamePlural} in your store are selected","allFilteredItemsSelected":"All {itemsLength}+ {resourceNamePlural} in this filter are selected","selectAllItems":"Select all {itemsLength}+ {resourceNamePlural} in your store","selectAllFilteredItems":"Select all {itemsLength}+ {resourceNamePlural} in this filter","emptySearchResultTitle":"No {resourceNamePlural} found","emptySearchResultDescription":"Try changing the filters or search term","selectButtonText":"Select","a11yCheckboxDeselectAllSingle":"Deselect {resourceNameSingular}","a11yCheckboxSelectAllSingle":"Select {resourceNameSingular}","a11yCheckboxDeselectAllMultiple":"Deselect all {itemsLength} {resourceNamePlural}","a11yCheckboxSelectAllMultiple":"Select all {itemsLength} {resourceNamePlural}","Item":{"actionsDropdownLabel":"Actions for {accessibilityLabel}","actionsDropdown":"Actions dropdown","viewItem":"View details for {itemName}"},"BulkActions":{"actionsActivatorLabel":"Actions","moreActionsActivatorLabel":"More actions"}},"SkeletonPage":{"loadingLabel":"Page loading"},"Tabs":{"newViewAccessibilityLabel":"Create new view","newViewTooltip":"Create view","toggleTabsLabel":"More views","Tab":{"rename":"Rename view","duplicate":"Duplicate view","edit":"Edit view","editColumns":"Edit columns","delete":"Delete view","copy":"Copy of {name}","deleteModal":{"title":"Delete view?","description":"This can’t be undone. {viewName} view will no longer be available in your admin.","cancel":"Cancel","delete":"Delete view"}},"RenameModal":{"title":"Rename view","label":"Name","cancel":"Cancel","create":"Save","errors":{"sameName":"A view with this name already exists. Please choose a different name."}},"DuplicateModal":{"title":"Duplicate view","label":"Name","cancel":"Cancel","create":"Create view","errors":{"sameName":"A view with this name already exists. Please choose a different name."}},"CreateViewModal":{"title":"Create new view","label":"Name","cancel":"Cancel","create":"Create view","errors":{"sameName":"A view with this name already exists. Please choose a different name."}}},"Tag":{"ariaLabel":"Remove {children}"},"TextField":{"characterCount":"{count} characters","characterCountWithMaxLength":"{count} of {limit} characters used"},"TooltipOverlay":{"accessibilityLabel":"Tooltip: {label}"},"TopBar":{"toggleMenuLabel":"Toggle menu","SearchField":{"clearButtonLabel":"Clear","search":"Search"}},"MediaCard":{"dismissButton":"Dismiss","popoverButton":"Actions"},"VideoThumbnail":{"playButtonA11yLabel":{"default":"Play video","defaultWithDuration":"Play video of length {duration}","duration":{"hours":{"other":{"only":"{hourCount} hours","andMinutes":"{hourCount} hours and {minuteCount} minutes","andMinute":"{hourCount} hours and {minuteCount} minute","minutesAndSeconds":"{hourCount} hours, {minuteCount} minutes, and {secondCount} seconds","minutesAndSecond":"{hourCount} hours, {minuteCount} minutes, and {secondCount} second","minuteAndSeconds":"{hourCount} hours, {minuteCount} minute, and {secondCount} seconds","minuteAndSecond":"{hourCount} hours, {minuteCount} minute, and {secondCount} second","andSeconds":"{hourCount} hours and {secondCount} seconds","andSecond":"{hourCount} hours and {secondCount} second"},"one":{"only":"{hourCount} hour","andMinutes":"{hourCount} hour and {minuteCount} minutes","andMinute":"{hourCount} hour and {minuteCount} minute","minutesAndSeconds":"{hourCount} hour, {minuteCount} minutes, and {secondCount} seconds","minutesAndSecond":"{hourCount} hour, {minuteCount} minutes, and {secondCount} second","minuteAndSeconds":"{hourCount} hour, {minuteCount} minute, and {secondCount} seconds","minuteAndSecond":"{hourCount} hour, {minuteCount} minute, and {secondCount} second","andSeconds":"{hourCount} hour and {secondCount} seconds","andSecond":"{hourCount} hour and {secondCount} second"}},"minutes":{"other":{"only":"{minuteCount} minutes","andSeconds":"{minuteCount} minutes and {secondCount} seconds","andSecond":"{minuteCount} minutes and {secondCount} second"},"one":{"only":"{minuteCount} minute","andSeconds":"{minuteCount} minute and {secondCount} seconds","andSecond":"{minuteCount} minute and {secondCount} second"}},"seconds":{"other":"{secondCount} seconds","one":"{secondCount} second"}}}}}');
const polarisTranslations = {
  Polaris
};
const polarisStyles = "/assets/styles-CV7GIAUv.css";
function loginErrorMessage(loginErrors) {
  if ((loginErrors == null ? void 0 : loginErrors.shop) === LoginErrorType.MissingShop) {
    return { shop: "Please enter your shop domain to log in" };
  } else if ((loginErrors == null ? void 0 : loginErrors.shop) === LoginErrorType.InvalidShop) {
    return { shop: "Please enter a valid shop domain to log in" };
  }
  return {};
}
const links$1 = () => [{ rel: "stylesheet", href: polarisStyles }];
const loader$7 = async ({ request }) => {
  const errors = loginErrorMessage(await login(request));
  return { errors, polarisTranslations };
};
const action$5 = async ({ request }) => {
  const errors = loginErrorMessage(await login(request));
  return {
    errors
  };
};
function Auth() {
  const loaderData = useLoaderData();
  const actionData = useActionData();
  const [shop, setShop] = useState("");
  const { errors } = actionData || loaderData;
  return /* @__PURE__ */ jsx(AppProvider, { i18n: loaderData.polarisTranslations, children: /* @__PURE__ */ jsx(Page, { children: /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsx(Form, { method: "post", children: /* @__PURE__ */ jsxs(FormLayout, { children: [
    /* @__PURE__ */ jsx(Text, { variant: "headingMd", as: "h2", children: "Log in" }),
    /* @__PURE__ */ jsx(
      TextField,
      {
        type: "text",
        name: "shop",
        label: "Shop domain",
        helpText: "example.myshopify.com",
        value: shop,
        onChange: setShop,
        autoComplete: "on",
        error: errors.shop
      }
    ),
    /* @__PURE__ */ jsx(Button, { submit: true, children: "Log in" })
  ] }) }) }) }) });
}
const route4 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$5,
  default: Auth,
  links: links$1,
  loader: loader$7
}, Symbol.toStringTag, { value: "Module" }));
const index = "_index_12o3y_1";
const heading = "_heading_12o3y_11";
const text = "_text_12o3y_12";
const content = "_content_12o3y_22";
const form = "_form_12o3y_27";
const label = "_label_12o3y_35";
const input = "_input_12o3y_43";
const button = "_button_12o3y_47";
const list = "_list_12o3y_51";
const styles = {
  index,
  heading,
  text,
  content,
  form,
  label,
  input,
  button,
  list
};
const loader$6 = async ({ request }) => {
  const url = new URL(request.url);
  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }
  return { showForm: Boolean(login) };
};
function App$1() {
  const { showForm } = useLoaderData();
  return /* @__PURE__ */ jsx("div", { className: styles.index, children: /* @__PURE__ */ jsxs("div", { className: styles.content, children: [
    /* @__PURE__ */ jsx("h1", { className: styles.heading, children: "A short heading about [your app]" }),
    /* @__PURE__ */ jsx("p", { className: styles.text, children: "A tagline about [your app] that describes your value proposition." }),
    showForm && /* @__PURE__ */ jsxs(Form, { className: styles.form, method: "post", action: "/auth/login", children: [
      /* @__PURE__ */ jsxs("label", { className: styles.label, children: [
        /* @__PURE__ */ jsx("span", { children: "Shop domain" }),
        /* @__PURE__ */ jsx("input", { className: styles.input, type: "text", name: "shop" }),
        /* @__PURE__ */ jsx("span", { children: "e.g: my-shop-domain.myshopify.com" })
      ] }),
      /* @__PURE__ */ jsx("button", { className: styles.button, type: "submit", children: "Log in" })
    ] }),
    /* @__PURE__ */ jsxs("ul", { className: styles.list, children: [
      /* @__PURE__ */ jsxs("li", { children: [
        /* @__PURE__ */ jsx("strong", { children: "Product feature" }),
        ". Some detail about your feature and its benefit to your customer."
      ] }),
      /* @__PURE__ */ jsxs("li", { children: [
        /* @__PURE__ */ jsx("strong", { children: "Product feature" }),
        ". Some detail about your feature and its benefit to your customer."
      ] }),
      /* @__PURE__ */ jsxs("li", { children: [
        /* @__PURE__ */ jsx("strong", { children: "Product feature" }),
        ". Some detail about your feature and its benefit to your customer."
      ] })
    ] })
  ] }) });
}
const route5 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: App$1,
  loader: loader$6
}, Symbol.toStringTag, { value: "Module" }));
const loader$5 = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};
const route6 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  loader: loader$5
}, Symbol.toStringTag, { value: "Module" }));
const links = () => [{ rel: "stylesheet", href: polarisStyles }];
const loader$4 = async ({ request }) => {
  await authenticate.admin(request);
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};
function App() {
  const { apiKey } = useLoaderData();
  return /* @__PURE__ */ jsxs(AppProvider$1, { isEmbeddedApp: true, apiKey, children: [
    /* @__PURE__ */ jsx(NavMenu, { children: /* @__PURE__ */ jsx(Link, { to: "/app", rel: "home", children: "Dashboard" }) }),
    /* @__PURE__ */ jsx(Outlet, {})
  ] });
}
function ErrorBoundary() {
  return boundary.error(useRouteError());
}
const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
const route7 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  ErrorBoundary,
  default: App,
  headers,
  links,
  loader: loader$4
}, Symbol.toStringTag, { value: "Module" }));
const PRODUCT_METAFIELD_NAMESPACE = "bundle_app";
const PRODUCT_METAFIELD_KEY = "config";
const MIX_MATCH_PREVIEW_LIMIT = 6;
async function getProductCollectionContext(productId, admin) {
  var _a2, _b, _c;
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
    { variables: { id: productId } }
  );
  const payload = await response.json();
  const nodes = ((_c = (_b = (_a2 = payload.data) == null ? void 0 : _a2.product) == null ? void 0 : _b.collections) == null ? void 0 : _c.nodes) || [];
  const collectionIds = nodes.map((node) => node.id);
  return new Set(collectionIds);
}
async function getProductHandles(productIds, admin) {
  var _a2;
  if (productIds.length === 0) return /* @__PURE__ */ new Map();
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
  const map = /* @__PURE__ */ new Map();
  (((_a2 = payload.data) == null ? void 0 : _a2.nodes) || []).forEach((node) => {
    if ((node == null ? void 0 : node.id) && (node == null ? void 0 : node.handle)) map.set(node.id, node.handle);
  });
  return map;
}
async function getCollectionThemeContext(collectionIds, admin) {
  var _a2;
  if (collectionIds.length === 0) {
    return /* @__PURE__ */ new Map();
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
  const map = /* @__PURE__ */ new Map();
  (((_a2 = payload.data) == null ? void 0 : _a2.nodes) || []).forEach((node) => {
    var _a3;
    if (!(node == null ? void 0 : node.id) || !(node == null ? void 0 : node.handle)) return;
    const productNodes = ((_a3 = node.products) == null ? void 0 : _a3.nodes) || [];
    const handles = productNodes.map((p) => p == null ? void 0 : p.handle).filter(Boolean);
    const productIds = productNodes.map((p) => p == null ? void 0 : p.id).filter(Boolean);
    map.set(node.id, {
      id: node.id,
      handle: node.handle,
      previewProductHandles: handles.slice(0, MIX_MATCH_PREVIEW_LIMIT),
      productIds
    });
  });
  return map;
}
async function setProductConfigMetafield(productId, value, admin) {
  var _a2, _b;
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
            value
          }
        ]
      }
    }
  );
  const payload = await response.json();
  const errors = ((_b = (_a2 = payload.data) == null ? void 0 : _a2.metafieldsSet) == null ? void 0 : _b.userErrors) || [];
  if (errors.length > 0) {
    throw new Error(`Failed to set product metafield for ${productId}: ${JSON.stringify(errors)}`);
  }
}
async function deleteProductConfigMetafield(productId, admin) {
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
            key: PRODUCT_METAFIELD_KEY
          }
        ]
      }
    }
  );
}
async function syncProductMetafield(productId, admin, shop) {
  const productCollectionIds = await getProductCollectionContext(productId, admin);
  const collectionIdList = Array.from(productCollectionIds);
  const itemFilters = [{ productId }];
  if (collectionIdList.length > 0) {
    itemFilters.push({ collectionId: { in: collectionIdList } });
  }
  const bundles = await prisma.bundle.findMany({
    where: {
      shop,
      status: "ACTIVE",
      items: {
        some: {
          OR: itemFilters
        }
      }
    },
    include: { items: true, tiers: true },
    orderBy: [{ priority: "desc" }, { updatedAt: "desc" }]
  });
  if (bundles.length === 0) {
    await deleteProductConfigMetafield(productId, admin);
    return;
  }
  const directProductIds = /* @__PURE__ */ new Set();
  const bundleCollectionIds = /* @__PURE__ */ new Set();
  bundles.forEach((bundle) => {
    bundle.items.forEach((item) => {
      if (item.productId) directProductIds.add(item.productId);
      if (item.collectionId) bundleCollectionIds.add(item.collectionId);
    });
  });
  const productHandleMap = await getProductHandles(Array.from(directProductIds), admin);
  const collectionContextMap = await getCollectionThemeContext(Array.from(bundleCollectionIds), admin);
  const configs = bundles.map((bundle) => {
    var _a2;
    const productHandles = bundle.items.map((item) => item.productId ? productHandleMap.get(item.productId) : null).filter(Boolean);
    const collections = bundle.items.map((item) => item.collectionId ? collectionContextMap.get(item.collectionId) : null).filter(Boolean).map((entry2) => ({
      id: entry2.id,
      handle: entry2.handle,
      previewProductHandles: entry2.previewProductHandles
    }));
    return {
      id: bundle.id,
      title: bundle.title,
      type: bundle.type,
      targetQuantity: bundle.targetQuantity,
      discountType: bundle.discountType,
      discountValue: Number(bundle.discountValue || 0),
      tiers: ((_a2 = bundle.tiers) == null ? void 0 : _a2.map((tier) => ({
        quantity: Number(tier.quantity),
        quantityMax: tier.quantityMax != null ? Number(tier.quantityMax) : void 0,
        discountType: tier.discountType,
        discountValue: Number(tier.discountValue)
      }))) || [],
      productHandles,
      collections
    };
  });
  await setProductConfigMetafield(productId, JSON.stringify(configs), admin);
}
async function syncProductMetafieldsForBundleItems(items, admin, shop) {
  var _a2, _b, _c;
  const productIds = /* @__PURE__ */ new Set();
  const collectionIds = /* @__PURE__ */ new Set();
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
        { variables: { id: collectionId } }
      );
      const payload = await response.json();
      const collectionProducts = ((_c = (_b = (_a2 = payload.data) == null ? void 0 : _a2.collection) == null ? void 0 : _b.products) == null ? void 0 : _c.nodes) || [];
      collectionProducts.forEach((node) => {
        if (node == null ? void 0 : node.id) productIds.add(node.id);
      });
    }
  }
  for (const id of productIds) {
    await syncProductMetafield(id, admin, shop);
  }
}
async function syncAllProductMetafields(shop, admin) {
  const activeBundles = await prisma.bundle.findMany({
    where: { shop, status: "ACTIVE" },
    include: { items: true }
  });
  const allItems = activeBundles.flatMap((bundle) => bundle.items);
  await syncProductMetafieldsForBundleItems(allItems, admin, shop);
  return { productsSynced: allItems.length };
}
const metafields_server = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  syncAllProductMetafields,
  syncProductMetafield,
  syncProductMetafieldsForBundleItems
}, Symbol.toStringTag, { value: "Module" }));
function deriveBrackets(tiers) {
  const sorted = [...tiers].filter((t) => !isNaN(t.quantity) && t.quantity >= 1).sort((a, b) => a.quantity - b.quantity);
  return sorted.map((t, i) => {
    const isLast = i === sorted.length - 1;
    const uncapped = isLast && t.uncapped;
    const max = uncapped || isLast ? null : sorted[i + 1].quantity - 1;
    return { min: t.quantity, max };
  });
}
function getBracketLabel(min, max) {
  if (max == null) return `${min}+ items`;
  if (min === max) return `${min} item${min === 1 ? "" : "s"}`;
  return `${min}-${max} items`;
}
function validateTiers(tiers) {
  const errors = [];
  const parsed = tiers.map((t, i) => ({
    index: i,
    qty: parseInt(t.quantity, 10),
    raw: String(t.quantity).trim()
  }));
  for (const p of parsed) {
    if (p.raw === "") continue;
    if (isNaN(p.qty) || p.qty < 1) {
      errors.push({ index: p.index, message: "Must be 1 or greater." });
    }
  }
  const withQty = parsed.filter((p) => p.raw !== "" && !isNaN(p.qty) && p.qty >= 1);
  const sorted = [...withQty].sort((a, b) => a.qty - b.qty);
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].qty >= sorted[i + 1].qty) {
      errors.push({
        index: sorted[i + 1].index,
        message: `Must be greater than ${sorted[i].qty}. Quantities must increase (e.g., 2, 3, 6).`
      });
    }
  }
  return errors;
}
function buildVolumeTiersForDb(tiers) {
  const valid = tiers.map((t) => ({
    ...t,
    quantity: parseInt(t.quantity, 10)
  })).filter((t) => !isNaN(t.quantity) && t.quantity >= 1);
  const sorted = [...valid].sort((a, b) => a.quantity - b.quantity);
  return sorted.map((t, i) => {
    const isLast = i === sorted.length - 1;
    const uncapped = isLast && t.uncapped;
    const quantityMax = uncapped || isLast ? null : sorted[i + 1].quantity - 1;
    return {
      quantity: t.quantity,
      quantityMax,
      discountType: t.discountType,
      discountValue: parseFloat(t.discountValue) || 0
    };
  });
}
const loader$3 = async ({ request, params }) => {
  var _a2, _b, _c, _d;
  const { session, admin } = await authenticate.admin(request);
  const bundle = await prisma.bundle.findUnique({
    where: { id: params.id, shop: session.shop },
    include: { items: true, tiers: true }
  });
  if (!bundle) {
    return redirect("/app");
  }
  const productGraphqlIds = bundle.items.filter((i) => i.productId).map((item) => `"${item.productId}"`).join(", ");
  const collectionGraphqlIds = bundle.items.filter((i) => i.collectionId).map((item) => `"${item.collectionId}"`).join(", ");
  let richProducts = [];
  let richCollections = [];
  if (productGraphqlIds.length > 0) {
    const productQuery = await admin.graphql(`
            #graphql
            query {
                nodes(ids: [${productGraphqlIds}]) {
                    ... on Product {
                        id
                        title
                        handle
                        images(first: 1) {
                            edges {
                                node {
                                    url
                                    altText
                                }
                            }
                        }
                    }
                }
            }
        `);
    const productData = await productQuery.json();
    richProducts = ((_b = (_a2 = productData.data) == null ? void 0 : _a2.nodes) == null ? void 0 : _b.map((n) => {
      var _a3, _b2;
      if (!n) return null;
      return {
        id: n.id,
        title: n.title,
        handle: n.handle,
        images: ((_b2 = (_a3 = n.images) == null ? void 0 : _a3.edges) == null ? void 0 : _b2.map((e) => ({ originalSrc: e.node.url, altText: e.node.altText }))) || []
      };
    }).filter(Boolean)) || [];
  }
  if (collectionGraphqlIds.length > 0) {
    const collectionQuery = await admin.graphql(`
            #graphql
            query {
                nodes(ids: [${collectionGraphqlIds}]) {
                    ... on Collection {
                        id
                        title
                        handle
                        image {
                            url
                            altText
                        }
                    }
                }
            }
        `);
    const collectionData = await collectionQuery.json();
    richCollections = ((_d = (_c = collectionData.data) == null ? void 0 : _c.nodes) == null ? void 0 : _d.map((n) => {
      if (!n) return null;
      return {
        id: n.id,
        title: n.title,
        handle: n.handle,
        image: n.image ? { originalSrc: n.image.url, altText: n.image.altText } : null
      };
    }).filter(Boolean)) || [];
  }
  return json({ bundle, richProducts, richCollections });
};
const action$4 = async ({ request, params }) => {
  const { session, admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const title = formData.get("title");
  const type = formData.get("type");
  const discountType = formData.get("discountType");
  const discountValue = parseFloat(formData.get("discountValue"));
  const stacksWithProductDiscounts = formData.get("stacksWithProductDiscounts") === "true";
  const stacksWithOrderDiscounts = formData.get("stacksWithOrderDiscounts") === "true";
  const stacksWithShippingDiscounts = formData.get("stacksWithShippingDiscounts") === "true";
  const productIds = formData.getAll("productIds[]");
  const collectionIds = formData.getAll("collectionIds[]");
  const targetQuantityRaw = formData.get("targetQuantity");
  const targetQuantity = targetQuantityRaw ? parseInt(targetQuantityRaw) : null;
  const tiersJson = formData.get("tiers");
  const tiers = tiersJson ? JSON.parse(tiersJson) : [];
  if (!title || !type || (type !== "VOLUME" && (!discountType || isNaN(discountValue)) || type === "VOLUME" && tiers.length === 0) || productIds.length === 0 && collectionIds.length === 0) {
    return json({ error: "Please fill out all fields and select at least one product or collection." }, { status: 400 });
  }
  const bundleId = params.id;
  const currentBundle = await prisma.bundle.findUnique({
    where: { id: bundleId },
    include: { items: true }
  });
  if (!currentBundle) return redirect("/app");
  const itemsContent = [
    ...productIds.map((id) => ({ productId: id, requiredQuantity: 1 })),
    ...collectionIds.map((id) => ({ collectionId: id, requiredQuantity: 1 }))
  ];
  if (type === "VOLUME") {
    const validationErrors = validateTiers(tiers);
    if (validationErrors.length > 0) {
      return json({
        error: "Fix bracket errors: quantities must increase (e.g., 2, 3, 6).",
        tierErrors: validationErrors
      }, { status: 400 });
    }
  }
  const volumeTiers = type === "VOLUME" ? buildVolumeTiersForDb(tiers) : [];
  await prisma.bundle.update({
    where: { id: bundleId },
    data: {
      title,
      type,
      discountType: type === "VOLUME" ? null : discountType,
      discountValue: type === "VOLUME" ? null : discountValue,
      targetQuantity,
      stacksWithProductDiscounts,
      stacksWithOrderDiscounts,
      stacksWithShippingDiscounts,
      items: {
        deleteMany: {},
        // Clear all existing items
        create: itemsContent
      },
      tiers: {
        deleteMany: {},
        // Clear all existing tiers
        create: volumeTiers
      }
    }
  });
  await syncProductMetafieldsForBundleItems([...currentBundle.items, ...itemsContent], admin, session.shop);
  await syncConsolidatedDiscountNode(session.shop, admin);
  return redirect(`/app`);
};
function BundleEdit() {
  const { bundle, richProducts, richCollections } = useLoaderData();
  const shopify2 = useAppBridge();
  const submit = useSubmit();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const actionData = useActionData();
  const [title, setTitle] = useState(bundle.title);
  const [type, setType] = useState(bundle.type);
  const [discountType, setDiscountType] = useState(bundle.discountType || "PERCENTAGE");
  const [discountValue, setDiscountValue] = useState(bundle.discountValue ? bundle.discountValue.toString() : "");
  const [stacksWithProductDiscounts, setStacksWithProductDiscounts] = useState(bundle.stacksWithProductDiscounts ?? true);
  const [stacksWithOrderDiscounts, setStacksWithOrderDiscounts] = useState(bundle.stacksWithOrderDiscounts ?? true);
  const [stacksWithShippingDiscounts, setStacksWithShippingDiscounts] = useState(bundle.stacksWithShippingDiscounts ?? true);
  const [selectedProducts, setSelectedProducts] = useState(richProducts || []);
  const [targetQuantity, setTargetQuantity] = useState(bundle.targetQuantity ? bundle.targetQuantity.toString() : "3");
  const [selectedCollections, setSelectedCollections] = useState(richCollections || []);
  const [tiers, setTiers] = useState(() => {
    if (!bundle.tiers || bundle.tiers.length === 0) {
      return [{ quantity: "2", uncapped: true, discountType: "PERCENTAGE", discountValue: "10" }];
    }
    const sorted = [...bundle.tiers].sort((a, b) => a.quantity - b.quantity);
    return sorted.map((t, i) => ({
      quantity: t.quantity.toString(),
      uncapped: i === sorted.length - 1 && t.quantityMax == null,
      discountType: t.discountType,
      discountValue: t.discountValue.toString()
    }));
  });
  const isSaving = navigation.state === "submitting";
  const serverTierErrors = actionData == null ? void 0 : actionData.tierErrors;
  const [clientTierErrors, setClientTierErrors] = useState([]);
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
  const handleSelectProducts = async () => {
    const selected = await shopify2.resourcePicker({
      type: "product",
      multiple: true,
      selectionIds: selectedProducts.map((p) => ({ id: p.id }))
    });
    if (selected) {
      setSelectedProducts(selected);
    }
  };
  const handleSelectCollections = async () => {
    const selected = await shopify2.resourcePicker({
      type: "collection",
      multiple: true,
      selectionIds: selectedCollections.map((c) => ({ id: c.id }))
    });
    if (selected) {
      setSelectedCollections(selected);
    }
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
  return /* @__PURE__ */ jsxs(
    Page,
    {
      backAction: { content: "Bundles", onAction: () => navigate("/app") },
      title: `Edit: ${bundle.title}`,
      children: [
        /* @__PURE__ */ jsx(TitleBar, { title: `Edit: ${bundle.title}`, children: /* @__PURE__ */ jsx("button", { variant: "primary", onClick: handleSave, disabled: isSaving, children: isSaving ? "Saving..." : "Save changes" }) }),
        /* @__PURE__ */ jsx(BlockStack, { gap: "500", children: /* @__PURE__ */ jsxs(Layout, { children: [
          /* @__PURE__ */ jsx(Layout.Section, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "500", children: [
            /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "400", children: [
              /* @__PURE__ */ jsx(Text, { variant: "headingMd", as: "h2", children: "Bundle details" }),
              (actionData == null ? void 0 : actionData.error) && /* @__PURE__ */ jsx(Text, { tone: "critical", as: "p", children: actionData.error }),
              /* @__PURE__ */ jsx(
                TextField,
                {
                  label: "Bundle title",
                  value: title,
                  onChange: setTitle,
                  autoComplete: "off",
                  helpText: "Internal name for your reference."
                }
              ),
              /* @__PURE__ */ jsx(
                Select,
                {
                  label: "Bundle type",
                  options: [
                    { label: "Frequently Bought Together (FBT)", value: "FBT" },
                    { label: "Volume Pricing (Quantity Breaks)", value: "VOLUME" },
                    { label: "Mix & Match", value: "MIX_MATCH" },
                    { label: "Classic Bundle", value: "CLASSIC" }
                  ],
                  value: type,
                  onChange: setType
                }
              ),
              type === "MIX_MATCH" && /* @__PURE__ */ jsx(
                TextField,
                {
                  label: "Required Items (Target Quantity)",
                  type: "number",
                  value: targetQuantity,
                  onChange: setTargetQuantity,
                  autoComplete: "off",
                  helpText: "How many items must the customer choose from the pool below to unlock the deal?"
                }
              )
            ] }) }),
            /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "400", children: [
              /* @__PURE__ */ jsx(Text, { variant: "headingMd", as: "h2", children: "Products & Collections" }),
              selectedProducts.length > 0 ? /* @__PURE__ */ jsx(
                ResourceList,
                {
                  resourceName: { singular: "product", plural: "products" },
                  items: selectedProducts,
                  renderItem: (item) => {
                    var _a2, _b;
                    const { id, title: title2, images } = item;
                    const media = /* @__PURE__ */ jsx(
                      Thumbnail,
                      {
                        source: ((_a2 = images[0]) == null ? void 0 : _a2.originalSrc) || "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png",
                        alt: ((_b = images[0]) == null ? void 0 : _b.altText) || title2
                      }
                    );
                    return /* @__PURE__ */ jsx(ResourceItem, { id, media, onClick: () => {
                    }, children: /* @__PURE__ */ jsx(Text, { variant: "bodyMd", fontWeight: "bold", as: "h3", children: title2 }) });
                  }
                }
              ) : /* @__PURE__ */ jsx(Text, { as: "p", tone: "subdued", children: "No products selected." }),
              type === "MIX_MATCH" && selectedCollections.length > 0 && /* @__PURE__ */ jsx(
                ResourceList,
                {
                  resourceName: { singular: "collection", plural: "collections" },
                  items: selectedCollections,
                  renderItem: (item) => {
                    const { id, title: title2, image } = item;
                    const media = /* @__PURE__ */ jsx(
                      Thumbnail,
                      {
                        source: (image == null ? void 0 : image.originalSrc) || "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png",
                        alt: (image == null ? void 0 : image.altText) || title2
                      }
                    );
                    return /* @__PURE__ */ jsx(ResourceItem, { id, media, onClick: () => {
                    }, children: /* @__PURE__ */ jsxs(Text, { variant: "bodyMd", fontWeight: "bold", as: "h3", children: [
                      title2,
                      " (Collection)"
                    ] }) });
                  }
                }
              ),
              type === "MIX_MATCH" && selectedCollections.length === 0 && /* @__PURE__ */ jsx(Text, { as: "p", tone: "subdued", children: "No collections selected." }),
              /* @__PURE__ */ jsxs(InlineStack, { gap: "300", children: [
                /* @__PURE__ */ jsx(Button, { onClick: handleSelectProducts, children: "Select products" }),
                type === "MIX_MATCH" && /* @__PURE__ */ jsx(Button, { onClick: handleSelectCollections, children: "Select collections" })
              ] })
            ] }) }),
            /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "400", children: [
              /* @__PURE__ */ jsx(Text, { variant: "headingMd", as: "h2", children: "Combinations" }),
              /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
                /* @__PURE__ */ jsx(
                  Checkbox,
                  {
                    label: "Product discounts",
                    checked: stacksWithProductDiscounts,
                    onChange: setStacksWithProductDiscounts
                  }
                ),
                /* @__PURE__ */ jsx(
                  Checkbox,
                  {
                    label: "Order discounts",
                    checked: stacksWithOrderDiscounts,
                    onChange: setStacksWithOrderDiscounts
                  }
                ),
                /* @__PURE__ */ jsx(
                  Checkbox,
                  {
                    label: "Shipping discounts",
                    checked: stacksWithShippingDiscounts,
                    onChange: setStacksWithShippingDiscounts
                  }
                )
              ] }),
              /* @__PURE__ */ jsx(Text, { variant: "bodySm", tone: "subdued", as: "p", children: "Allow this bundle discount to be combined with other product, order, or shipping discounts at checkout." })
            ] }) })
          ] }) }),
          /* @__PURE__ */ jsx(Layout.Section, { variant: "oneThird", children: type !== "VOLUME" ? /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "400", children: [
            /* @__PURE__ */ jsx(Text, { variant: "headingMd", as: "h2", children: "Discount" }),
            /* @__PURE__ */ jsx(
              Select,
              {
                label: "Discount type",
                options: [
                  { label: "Percentage (%)", value: "PERCENTAGE" },
                  { label: "Fixed amount off", value: "FIXED_AMOUNT" },
                  { label: "Set fixed price", value: "FIXED_PRICE" }
                ],
                value: discountType,
                onChange: setDiscountType
              }
            ),
            /* @__PURE__ */ jsx(
              TextField,
              {
                label: "Discount value",
                type: "number",
                value: discountValue,
                onChange: setDiscountValue,
                autoComplete: "off",
                suffix: discountType === "PERCENTAGE" ? "%" : void 0,
                helpText: discountType === "FIXED_PRICE" ? "The exact total price the customer will pay for all items combined." : discountType === "FIXED_AMOUNT" ? "The exact dollar amount to deduct from the total price of the items." : "The percentage to discount from the total price of the items."
              }
            )
          ] }) }) : /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "400", children: [
            /* @__PURE__ */ jsx(Text, { variant: "headingMd", as: "h2", children: "Volume Tiers" }),
            /* @__PURE__ */ jsxs(Banner, { tone: "info", title: "How quantity brackets work", children: [
              /* @__PURE__ */ jsx("p", { children: "Quantity brackets are set automatically. Enter the minimum quantity for each tier (e.g., 2, 3, 6). Brackets will be: 2-2 items, 3-5 items, 6+ items. Each quantity range gets exactly one discount." }),
              /* @__PURE__ */ jsx("p", { children: "Example: Buy 2 = 10%, Buy 3-5 = 15%, Buy 6+ = 20%" })
            ] }),
            hasTierErrors && /* @__PURE__ */ jsx(Banner, { tone: "critical", title: "Fix bracket errors", children: "Quantities must increase (e.g., 2, 3, 6). Check the fields below." }),
            (() => {
              const sorted = [...tiers].map((t, i) => ({ ...t, originalIndex: i })).sort((a, b) => (parseInt(a.quantity) || 0) - (parseInt(b.quantity) || 0));
              const validForBrackets = sorted.filter((t) => !isNaN(parseInt(t.quantity)) && parseInt(t.quantity) >= 1).map((t) => ({ quantity: parseInt(t.quantity), uncapped: t.uncapped }));
              const brackets = deriveBrackets(validForBrackets);
              const bracketByMin = new Map(brackets.map((b) => [b.min, b]));
              return sorted.map((tier, sortedIndex) => {
                const origIndex = tier.originalIndex;
                const qty = parseInt(tier.quantity);
                const bracket = !isNaN(qty) && qty >= 1 ? bracketByMin.get(qty) : null;
                const bracketLabel = bracket ? getBracketLabel(bracket.min, bracket.max) : "—";
                const err = tierErrors == null ? void 0 : tierErrors.find((e) => e.index === origIndex);
                return /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
                  /* @__PURE__ */ jsxs(Text, { fontWeight: "bold", as: "p", children: [
                    "Tier ",
                    sortedIndex + 1
                  ] }),
                  /* @__PURE__ */ jsxs(InlineStack, { gap: "300", blockAlign: "start", children: [
                    /* @__PURE__ */ jsx(
                      TextField,
                      {
                        label: "Buy Qty",
                        type: "number",
                        value: tier.quantity,
                        onChange: (val) => {
                          const newTiers = [...tiers];
                          newTiers[origIndex].quantity = val;
                          setTiers(newTiers);
                          setClientTierErrors([]);
                        },
                        autoComplete: "off",
                        helpText: "Minimum quantity for this tier. Must be higher than the tier above.",
                        error: err == null ? void 0 : err.message
                      }
                    ),
                    /* @__PURE__ */ jsxs(BlockStack, { gap: "100", children: [
                      /* @__PURE__ */ jsx(Text, { as: "p", variant: "bodySm", tone: "subdued", children: "Bracket" }),
                      /* @__PURE__ */ jsx(Text, { as: "p", fontWeight: "semibold", children: bracketLabel || "—" })
                    ] }),
                    /* @__PURE__ */ jsx(
                      TextField,
                      {
                        label: "Discount",
                        type: "number",
                        value: tier.discountValue,
                        onChange: (val) => {
                          const newTiers = [...tiers];
                          newTiers[origIndex].discountValue = val;
                          setTiers(newTiers);
                        },
                        autoComplete: "off",
                        connectedLeft: /* @__PURE__ */ jsx(
                          Select,
                          {
                            label: "Type",
                            labelHidden: true,
                            options: [
                              { label: "%", value: "PERCENTAGE" },
                              { label: "$", value: "FIXED_AMOUNT" }
                            ],
                            value: tier.discountType,
                            onChange: (val) => {
                              const newTiers = [...tiers];
                              newTiers[origIndex].discountType = val;
                              setTiers(newTiers);
                            }
                          }
                        )
                      }
                    )
                  ] }),
                  sortedIndex === sorted.length - 1 && /* @__PURE__ */ jsx(
                    Checkbox,
                    {
                      label: `Apply this discount to all quantities ${tier.quantity || "?"} and above`,
                      helpText: "Recommended for your best discount tier.",
                      checked: tier.uncapped ?? true,
                      onChange: (checked) => {
                        const newTiers = [...tiers];
                        newTiers[origIndex].uncapped = checked;
                        setTiers(newTiers);
                      }
                    }
                  ),
                  /* @__PURE__ */ jsx(Button, { tone: "critical", onClick: () => {
                    setTiers(tiers.filter((_, i) => i !== origIndex));
                    setClientTierErrors([]);
                  }, children: "Remove Tier" })
                ] }, origIndex);
              });
            })(),
            /* @__PURE__ */ jsxs(BlockStack, { gap: "100", children: [
              /* @__PURE__ */ jsx(Button, { onClick: () => {
                const lastQty = tiers.length > 0 ? Math.max(...tiers.map((t) => parseInt(t.quantity) || 0), 0) + 1 : 2;
                setTiers([...tiers, {
                  quantity: String(lastQty),
                  uncapped: true,
                  discountType: "PERCENTAGE",
                  discountValue: ""
                }]);
                setClientTierErrors([]);
              }, children: "Add tier" }),
              /* @__PURE__ */ jsx(Text, { as: "p", variant: "bodySm", tone: "subdued", children: "Add another tier. New tier's minimum must be higher than the last." })
            ] })
          ] }) }) })
        ] }) })
      ]
    }
  );
}
const route8 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$4,
  default: BundleEdit,
  loader: loader$3
}, Symbol.toStringTag, { value: "Module" }));
const action$3 = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const title = formData.get("title");
  const type = formData.get("type");
  const priority = 0;
  const discountType = formData.get("discountType");
  const discountValue = parseFloat(formData.get("discountValue"));
  const stacksWithProductDiscounts = formData.get("stacksWithProductDiscounts") === "true";
  const stacksWithOrderDiscounts = formData.get("stacksWithOrderDiscounts") === "true";
  const stacksWithShippingDiscounts = formData.get("stacksWithShippingDiscounts") === "true";
  const productIds = formData.getAll("productIds[]");
  const collectionIds = formData.getAll("collectionIds[]");
  const targetQuantityRaw = formData.get("targetQuantity");
  const targetQuantity = targetQuantityRaw ? parseInt(targetQuantityRaw) : null;
  const tiersJson = formData.get("tiers");
  const tiers = tiersJson ? JSON.parse(tiersJson) : [];
  if (!title || !type || (type !== "VOLUME" && (!discountType || isNaN(discountValue)) || type === "VOLUME" && tiers.length === 0) || productIds.length === 0 && collectionIds.length === 0) {
    return json({ error: "Please fill out all fields and select at least one product or collection." }, { status: 400 });
  }
  if (type === "VOLUME") {
    const validationErrors = validateTiers(tiers);
    if (validationErrors.length > 0) {
      return json({
        error: "Fix bracket errors: quantities must increase (e.g., 2, 3, 6).",
        tierErrors: validationErrors
      }, { status: 400 });
    }
  }
  const itemsContent = [
    ...productIds.map((id) => ({ productId: id, requiredQuantity: 1 })),
    ...collectionIds.map((id) => ({ collectionId: id, requiredQuantity: 1 }))
  ];
  const volumeTiers = type === "VOLUME" ? buildVolumeTiersForDb(tiers) : [];
  await prisma.bundle.create({
    data: {
      shop: session.shop,
      title,
      type,
      priority,
      status: "ACTIVE",
      discountType: type === "VOLUME" ? null : discountType,
      discountValue: type === "VOLUME" ? null : discountValue,
      targetQuantity,
      stacksWithProductDiscounts,
      stacksWithOrderDiscounts,
      stacksWithShippingDiscounts,
      items: {
        create: itemsContent
      },
      tiers: {
        create: volumeTiers
      }
    }
  });
  await syncProductMetafieldsForBundleItems(itemsContent, admin, session.shop);
  await syncConsolidatedDiscountNode(session.shop, admin);
  return redirect(`/app`);
};
function BundleNew() {
  const shopify2 = useAppBridge();
  const submit = useSubmit();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const actionData = useActionData();
  const [title, setTitle] = useState("");
  const [type, setType] = useState("FBT");
  const [discountType, setDiscountType] = useState("PERCENTAGE");
  const [discountValue, setDiscountValue] = useState("");
  const [stacksWithProductDiscounts, setStacksWithProductDiscounts] = useState(true);
  const [stacksWithOrderDiscounts, setStacksWithOrderDiscounts] = useState(true);
  const [stacksWithShippingDiscounts, setStacksWithShippingDiscounts] = useState(true);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [targetQuantity, setTargetQuantity] = useState("3");
  const [selectedCollections, setSelectedCollections] = useState([]);
  const [tiers, setTiers] = useState([{ quantity: "2", uncapped: true, discountType: "PERCENTAGE", discountValue: "10" }]);
  const isSaving = navigation.state === "submitting";
  const actionDataTyped = actionData;
  const serverTierErrors = actionDataTyped == null ? void 0 : actionDataTyped.tierErrors;
  const [clientTierErrors, setClientTierErrors] = useState([]);
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
    const selected = await shopify2.resourcePicker({
      type: "product",
      multiple: true,
      selectionIds: selectedProducts.map((p) => ({ id: p.id }))
    });
    if (selected) {
      setSelectedProducts(selected);
    }
  };
  const handleSelectCollections = async () => {
    const selected = await shopify2.resourcePicker({
      type: "collection",
      multiple: true,
      selectionIds: selectedCollections.map((c) => ({ id: c.id }))
    });
    if (selected) {
      setSelectedCollections(selected);
    }
  };
  return /* @__PURE__ */ jsxs(
    Page,
    {
      backAction: { content: "Bundles", onAction: () => navigate("/app") },
      title: "Create new bundle",
      children: [
        /* @__PURE__ */ jsx(TitleBar, { title: "Create new bundle", children: /* @__PURE__ */ jsx("button", { variant: "primary", onClick: () => handleSave(), disabled: isSaving, children: isSaving ? "Saving..." : "Save bundle" }) }),
        /* @__PURE__ */ jsx(BlockStack, { gap: "500", children: /* @__PURE__ */ jsxs(Layout, { children: [
          /* @__PURE__ */ jsx(Layout.Section, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "500", children: [
            /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "400", children: [
              /* @__PURE__ */ jsx(Text, { variant: "headingMd", as: "h2", children: "Bundle details" }),
              (actionData == null ? void 0 : actionData.error) && /* @__PURE__ */ jsx(Text, { tone: "critical", as: "p", children: actionData.error }),
              /* @__PURE__ */ jsx(
                TextField,
                {
                  label: "Bundle title",
                  value: title,
                  onChange: setTitle,
                  autoComplete: "off",
                  helpText: "Internal name for your reference."
                }
              ),
              /* @__PURE__ */ jsx(
                Select,
                {
                  label: "Bundle type",
                  options: [
                    { label: "Frequently Bought Together (FBT)", value: "FBT" },
                    { label: "Volume Pricing (Quantity Breaks)", value: "VOLUME" },
                    { label: "Mix & Match", value: "MIX_MATCH" },
                    { label: "Classic Bundle", value: "CLASSIC" }
                  ],
                  value: type,
                  onChange: setType
                }
              ),
              type === "MIX_MATCH" && /* @__PURE__ */ jsx(
                TextField,
                {
                  label: "Required Items (Target Quantity)",
                  type: "number",
                  value: targetQuantity,
                  onChange: setTargetQuantity,
                  autoComplete: "off",
                  helpText: "How many items must the customer choose from the pool below to unlock the deal?"
                }
              )
            ] }) }),
            /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "400", children: [
              /* @__PURE__ */ jsx(Text, { variant: "headingMd", as: "h2", children: "Products & Collections" }),
              selectedProducts.length > 0 ? /* @__PURE__ */ jsx(
                ResourceList,
                {
                  resourceName: { singular: "product", plural: "products" },
                  items: selectedProducts,
                  renderItem: (item) => {
                    var _a2, _b;
                    const { id, title: title2, images } = item;
                    const media = /* @__PURE__ */ jsx(
                      Thumbnail,
                      {
                        source: ((_a2 = images[0]) == null ? void 0 : _a2.originalSrc) || "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png",
                        alt: ((_b = images[0]) == null ? void 0 : _b.altText) || title2
                      }
                    );
                    return /* @__PURE__ */ jsx(ResourceItem, { id, media, onClick: () => {
                    }, children: /* @__PURE__ */ jsx(Text, { variant: "bodyMd", fontWeight: "bold", as: "h3", children: title2 }) });
                  }
                }
              ) : /* @__PURE__ */ jsx(Text, { as: "p", tone: "subdued", children: "No products selected." }),
              type === "MIX_MATCH" && selectedCollections.length > 0 && /* @__PURE__ */ jsx(
                ResourceList,
                {
                  resourceName: { singular: "collection", plural: "collections" },
                  items: selectedCollections,
                  renderItem: (item) => {
                    const { id, title: title2, image } = item;
                    const media = /* @__PURE__ */ jsx(
                      Thumbnail,
                      {
                        source: (image == null ? void 0 : image.originalSrc) || "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png",
                        alt: (image == null ? void 0 : image.altText) || title2
                      }
                    );
                    return /* @__PURE__ */ jsx(ResourceItem, { id, media, onClick: () => {
                    }, children: /* @__PURE__ */ jsxs(Text, { variant: "bodyMd", fontWeight: "bold", as: "h3", children: [
                      title2,
                      " (Collection)"
                    ] }) });
                  }
                }
              ),
              type === "MIX_MATCH" && selectedCollections.length === 0 && /* @__PURE__ */ jsx(Text, { as: "p", tone: "subdued", children: "No collections selected." }),
              /* @__PURE__ */ jsxs(InlineStack, { gap: "300", children: [
                /* @__PURE__ */ jsx(Button, { onClick: handleSelectProducts, children: "Select products" }),
                type === "MIX_MATCH" && /* @__PURE__ */ jsx(Button, { onClick: handleSelectCollections, children: "Select collections" })
              ] })
            ] }) }),
            /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "400", children: [
              /* @__PURE__ */ jsx(Text, { variant: "headingMd", as: "h2", children: "Combinations" }),
              /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
                /* @__PURE__ */ jsx(
                  Checkbox,
                  {
                    label: "Product discounts",
                    checked: stacksWithProductDiscounts,
                    onChange: setStacksWithProductDiscounts
                  }
                ),
                /* @__PURE__ */ jsx(
                  Checkbox,
                  {
                    label: "Order discounts",
                    checked: stacksWithOrderDiscounts,
                    onChange: setStacksWithOrderDiscounts
                  }
                ),
                /* @__PURE__ */ jsx(
                  Checkbox,
                  {
                    label: "Shipping discounts",
                    checked: stacksWithShippingDiscounts,
                    onChange: setStacksWithShippingDiscounts
                  }
                )
              ] }),
              /* @__PURE__ */ jsx(Text, { variant: "bodySm", tone: "subdued", as: "p", children: "Allow this bundle discount to be combined with other product, order, or shipping discounts at checkout." })
            ] }) })
          ] }) }),
          /* @__PURE__ */ jsx(Layout.Section, { variant: "oneThird", children: type !== "VOLUME" ? /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "400", children: [
            /* @__PURE__ */ jsx(Text, { variant: "headingMd", as: "h2", children: "Discount" }),
            /* @__PURE__ */ jsx(
              Select,
              {
                label: "Discount type",
                options: [
                  { label: "Percentage (%)", value: "PERCENTAGE" },
                  { label: "Fixed amount off", value: "FIXED_AMOUNT" },
                  { label: "Set fixed price", value: "FIXED_PRICE" }
                ],
                value: discountType,
                onChange: setDiscountType
              }
            ),
            /* @__PURE__ */ jsx(
              TextField,
              {
                label: "Discount value",
                type: "number",
                value: discountValue,
                onChange: setDiscountValue,
                autoComplete: "off",
                suffix: discountType === "PERCENTAGE" ? "%" : void 0,
                helpText: discountType === "FIXED_PRICE" ? "The exact total price the customer will pay for all items combined." : discountType === "FIXED_AMOUNT" ? "The exact dollar amount to deduct from the total price of the items." : "The percentage to discount from the total price of the items."
              }
            )
          ] }) }) : /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "400", children: [
            /* @__PURE__ */ jsx(Text, { variant: "headingMd", as: "h2", children: "Volume Tiers" }),
            /* @__PURE__ */ jsxs(Banner, { tone: "info", title: "How quantity brackets work", children: [
              /* @__PURE__ */ jsx("p", { children: "Quantity brackets are set automatically. Enter the minimum quantity for each tier (e.g., 2, 3, 6). Brackets will be: 2-2 items, 3-5 items, 6+ items. Each quantity range gets exactly one discount." }),
              /* @__PURE__ */ jsx("p", { children: "Example: Buy 2 = 10%, Buy 3-5 = 15%, Buy 6+ = 20%" })
            ] }),
            hasTierErrors && /* @__PURE__ */ jsx(Banner, { tone: "critical", title: "Fix bracket errors", children: "Quantities must increase (e.g., 2, 3, 6). Check the fields below." }),
            (() => {
              const sorted = [...tiers].map((t, i) => ({ ...t, originalIndex: i })).sort((a, b) => (parseInt(a.quantity) || 0) - (parseInt(b.quantity) || 0));
              const validForBrackets = sorted.filter((t) => !isNaN(parseInt(t.quantity)) && parseInt(t.quantity) >= 1).map((t) => ({ quantity: parseInt(t.quantity), uncapped: t.uncapped }));
              const brackets = deriveBrackets(validForBrackets);
              const bracketByMin = new Map(brackets.map((b) => [b.min, b]));
              return sorted.map((tier, sortedIndex) => {
                const origIndex = tier.originalIndex;
                const qty = parseInt(tier.quantity);
                const bracket = !isNaN(qty) && qty >= 1 ? bracketByMin.get(qty) : null;
                const bracketLabel = bracket ? getBracketLabel(bracket.min, bracket.max) : "—";
                const err = tierErrors == null ? void 0 : tierErrors.find((e) => e.index === origIndex);
                return /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
                  /* @__PURE__ */ jsxs(Text, { fontWeight: "bold", as: "p", children: [
                    "Tier ",
                    sortedIndex + 1
                  ] }),
                  /* @__PURE__ */ jsxs(InlineStack, { gap: "300", blockAlign: "start", children: [
                    /* @__PURE__ */ jsx(
                      TextField,
                      {
                        label: "Buy Qty",
                        type: "number",
                        value: tier.quantity,
                        onChange: (val) => {
                          const newTiers = [...tiers];
                          newTiers[origIndex].quantity = val;
                          setTiers(newTiers);
                          setClientTierErrors([]);
                        },
                        autoComplete: "off",
                        helpText: "Minimum quantity for this tier. Must be higher than the tier above.",
                        error: err == null ? void 0 : err.message
                      }
                    ),
                    /* @__PURE__ */ jsxs(BlockStack, { gap: "100", children: [
                      /* @__PURE__ */ jsx(Text, { as: "p", variant: "bodySm", tone: "subdued", children: "Bracket" }),
                      /* @__PURE__ */ jsx(Text, { as: "p", fontWeight: "semibold", children: bracketLabel || "—" })
                    ] }),
                    /* @__PURE__ */ jsx(
                      TextField,
                      {
                        label: "Discount",
                        type: "number",
                        value: tier.discountValue,
                        onChange: (val) => {
                          const newTiers = [...tiers];
                          newTiers[origIndex].discountValue = val;
                          setTiers(newTiers);
                        },
                        autoComplete: "off",
                        connectedLeft: /* @__PURE__ */ jsx(
                          Select,
                          {
                            label: "Type",
                            labelHidden: true,
                            options: [
                              { label: "%", value: "PERCENTAGE" },
                              { label: "$", value: "FIXED_AMOUNT" }
                            ],
                            value: tier.discountType,
                            onChange: (val) => {
                              const newTiers = [...tiers];
                              newTiers[origIndex].discountType = val;
                              setTiers(newTiers);
                            }
                          }
                        )
                      }
                    )
                  ] }),
                  sortedIndex === sorted.length - 1 && /* @__PURE__ */ jsx(
                    Checkbox,
                    {
                      label: `Apply this discount to all quantities ${tier.quantity || "?"} and above`,
                      helpText: "Recommended for your best discount tier.",
                      checked: tier.uncapped ?? true,
                      onChange: (checked) => {
                        const newTiers = [...tiers];
                        newTiers[origIndex].uncapped = checked;
                        setTiers(newTiers);
                      }
                    }
                  ),
                  /* @__PURE__ */ jsx(Button, { tone: "critical", onClick: () => {
                    setTiers(tiers.filter((_, i) => i !== origIndex));
                    setClientTierErrors([]);
                  }, children: "Remove Tier" })
                ] }, origIndex);
              });
            })(),
            /* @__PURE__ */ jsxs(BlockStack, { gap: "100", children: [
              /* @__PURE__ */ jsx(Button, { onClick: () => {
                const lastQty = tiers.length > 0 ? Math.max(...tiers.map((t) => parseInt(t.quantity) || 0), 0) + 1 : 2;
                setTiers([...tiers, {
                  quantity: String(lastQty),
                  uncapped: true,
                  discountType: "PERCENTAGE",
                  discountValue: ""
                }]);
                setClientTierErrors([]);
              }, children: "Add tier" }),
              /* @__PURE__ */ jsx(Text, { as: "p", variant: "bodySm", tone: "subdued", children: "Add another tier. New tier's minimum must be higher than the last." })
            ] })
          ] }) }) })
        ] }) })
      ]
    }
  );
}
const route9 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$3,
  default: BundleNew
}, Symbol.toStringTag, { value: "Module" }));
function AdditionalPage() {
  return /* @__PURE__ */ jsxs(Page, { children: [
    /* @__PURE__ */ jsx(TitleBar, { title: "Additional page" }),
    /* @__PURE__ */ jsxs(Layout, { children: [
      /* @__PURE__ */ jsx(Layout.Section, { children: /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "300", children: [
        /* @__PURE__ */ jsxs(Text, { as: "p", variant: "bodyMd", children: [
          "The app template comes with an additional page which demonstrates how to create multiple pages within app navigation using",
          " ",
          /* @__PURE__ */ jsx(
            Link$1,
            {
              url: "https://shopify.dev/docs/apps/tools/app-bridge",
              target: "_blank",
              removeUnderline: true,
              children: "App Bridge"
            }
          ),
          "."
        ] }),
        /* @__PURE__ */ jsxs(Text, { as: "p", variant: "bodyMd", children: [
          "To create your own page and have it show up in the app navigation, add a page inside ",
          /* @__PURE__ */ jsx(Code, { children: "app/routes" }),
          ", and a link to it in the ",
          /* @__PURE__ */ jsx(Code, { children: "<NavMenu>" }),
          " component found in ",
          /* @__PURE__ */ jsx(Code, { children: "app/routes/app.jsx" }),
          "."
        ] })
      ] }) }) }),
      /* @__PURE__ */ jsx(Layout.Section, { variant: "oneThird", children: /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
        /* @__PURE__ */ jsx(Text, { as: "h2", variant: "headingMd", children: "Resources" }),
        /* @__PURE__ */ jsx(List, { children: /* @__PURE__ */ jsx(List.Item, { children: /* @__PURE__ */ jsx(
          Link$1,
          {
            url: "https://shopify.dev/docs/apps/design-guidelines/navigation#app-nav",
            target: "_blank",
            removeUnderline: true,
            children: "App nav best practices"
          }
        ) }) })
      ] }) }) })
    ] })
  ] });
}
function Code({ children }) {
  return /* @__PURE__ */ jsx(
    Box,
    {
      as: "span",
      padding: "025",
      paddingInlineStart: "100",
      paddingInlineEnd: "100",
      background: "bg-surface-active",
      borderWidth: "025",
      borderColor: "border",
      borderRadius: "100",
      children: /* @__PURE__ */ jsx("code", { children })
    }
  );
}
const route10 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: AdditionalPage
}, Symbol.toStringTag, { value: "Module" }));
const loader$2 = async ({ request }) => {
  await authenticate.admin(request);
  return json({ ok: true });
};
const action$2 = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  if (intent === "resync_discounts") {
    const [discountSync, productSync] = await Promise.all([
      syncAllBundleDiscountNodes(session.shop, admin),
      syncAllProductMetafields(session.shop, admin)
    ]);
    return json({ success: true, resync: { ...discountSync, ...productSync } });
  }
  return json({ success: false, message: "Unknown intent." }, { status: 400 });
};
function Settings() {
  const submit = useSubmit();
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const actionData = useActionData();
  useEffect(() => {
    if (actionData && "resync" in actionData) {
      setSyncing(false);
      setSyncResult(actionData.resync);
    }
  }, [actionData]);
  const handleResync = useCallback(() => {
    setSyncing(true);
    setSyncResult(null);
    const formData = new FormData();
    formData.append("intent", "resync_discounts");
    submit(formData, { method: "post" });
  }, [submit]);
  return /* @__PURE__ */ jsxs(Page, { children: [
    /* @__PURE__ */ jsx(TitleBar, { title: "Settings" }),
    /* @__PURE__ */ jsx(BlockStack, { gap: "500", children: /* @__PURE__ */ jsx(Layout, { children: /* @__PURE__ */ jsx(
      Layout.AnnotatedSection,
      {
        title: "Operational Re-sync",
        description: "Re-sync consolidated discount config and product metafields consumed by your theme.",
        children: /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "400", children: [
          /* @__PURE__ */ jsx(Text, { as: "p", variant: "bodyMd", children: "This refreshes the single consolidated Shopify discount node and rebuilds product-level bundle metafields." }),
          syncResult && /* @__PURE__ */ jsx(
            Banner,
            {
              tone: syncResult.failed > 0 ? "critical" : "success",
              onDismiss: () => setSyncResult(null),
              children: /* @__PURE__ */ jsxs(BlockStack, { gap: "200", children: [
                /* @__PURE__ */ jsxs(Text, { as: "p", variant: "bodyMd", children: [
                  "Re-sync complete: ",
                  syncResult.created,
                  "/",
                  syncResult.total,
                  " bundles synced",
                  syncResult.failed > 0 ? ` (${syncResult.failed} failed)` : " successfully.",
                  "."
                ] }),
                "productsSynced" in syncResult && /* @__PURE__ */ jsxs(Text, { as: "p", variant: "bodyMd", children: [
                  "Product metafields refreshed for approximately ",
                  syncResult.productsSynced,
                  " bundle item references."
                ] }),
                syncResult.errors && syncResult.errors.length > 0 && /* @__PURE__ */ jsx(BlockStack, { gap: "100", children: syncResult.errors.map((err, i) => /* @__PURE__ */ jsx(Text, { as: "p", variant: "bodySm", tone: "critical", children: err }, i)) })
              ] })
            }
          ),
          /* @__PURE__ */ jsx(
            Button,
            {
              onClick: handleResync,
              loading: syncing,
              disabled: syncing,
              children: "Re-sync Theme + Discounts"
            }
          )
        ] }) })
      }
    ) }) })
  ] });
}
const route11 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$2,
  default: Settings,
  loader: loader$2
}, Symbol.toStringTag, { value: "Module" }));
const loader$1 = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const bundles = await prisma.bundle.findMany({
    where: { shop: session.shop },
    orderBy: { priority: "desc" }
  });
  return { bundles };
};
const action$1 = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  if (intent === "delete") {
    const id = formData.get("id");
    const bundle = await prisma.bundle.findUnique({
      where: { id, shop: session.shop },
      include: { items: true }
    });
    if (bundle) {
      await prisma.bundleItem.deleteMany({ where: { bundleId: id } });
      await prisma.bundle.delete({ where: { id } });
      if (bundle.items.length > 0) {
        await syncProductMetafieldsForBundleItems(bundle.items, admin, session.shop);
      }
      await syncConsolidatedDiscountNode(session.shop, admin);
    }
  } else if (intent === "reorder") {
    const orderedIds = JSON.parse(formData.get("orderedIds"));
    const updatePromises = orderedIds.map((id, index2) => {
      const priority = orderedIds.length - index2;
      return prisma.bundle.update({
        where: { id, shop: session.shop },
        data: { priority }
      });
    });
    await Promise.all(updatePromises);
  }
  return json({ success: true });
};
function Index() {
  const { bundles: initialBundles } = useLoaderData();
  const navigate = useNavigate();
  const submit = useSubmit();
  const [bundles, setBundles] = useState(initialBundles);
  useEffect(() => {
    setBundles(initialBundles);
  }, [initialBundles]);
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );
  const handleDragEnd = useCallback((event) => {
    const { active, over } = event;
    if (active.id !== (over == null ? void 0 : over.id)) {
      setBundles((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === (over == null ? void 0 : over.id));
        const newOrder = arrayMove(items, oldIndex, newIndex);
        submit(
          {
            intent: "reorder",
            orderedIds: JSON.stringify(newOrder.map((i) => i.id))
          },
          { method: "post" }
        );
        return newOrder;
      });
    }
  }, [submit]);
  const emptyStateMarkup = /* @__PURE__ */ jsx(
    EmptyState,
    {
      heading: "Create your first bundle",
      action: {
        content: "Create bundle",
        onAction: () => navigate("/app/bundles/new")
      },
      image: "https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png",
      children: /* @__PURE__ */ jsx("p", { children: "Configure bundle offers to increase your average order value." })
    }
  );
  return /* @__PURE__ */ jsxs(Page, { children: [
    /* @__PURE__ */ jsxs(TitleBar, { title: "BundleKit", children: [
      /* @__PURE__ */ jsx("button", { variant: "primary", onClick: () => navigate("/app/bundles/new"), children: "Create bundle" }),
      /* @__PURE__ */ jsx("button", { onClick: () => navigate("/app/settings"), children: "⚙️ Settings" })
    ] }),
    /* @__PURE__ */ jsx(BlockStack, { gap: "500", children: /* @__PURE__ */ jsx(Layout, { children: /* @__PURE__ */ jsx(Layout.Section, { children: /* @__PURE__ */ jsx(Card, { padding: "0", children: bundles.length === 0 ? emptyStateMarkup : /* @__PURE__ */ jsx(
      DndContext,
      {
        sensors,
        collisionDetection: closestCenter,
        onDragEnd: handleDragEnd,
        children: /* @__PURE__ */ jsx(
          IndexTable,
          {
            resourceName: { singular: "bundle", plural: "bundles" },
            itemCount: bundles.length,
            headings: [
              { title: "" },
              // Drag handle column
              { title: "Title" },
              { title: "Type" },
              { title: "Status" },
              { title: "Discount" },
              { title: "Actions" }
            ],
            selectable: false,
            children: /* @__PURE__ */ jsx(
              SortableContext,
              {
                items: bundles.map((b) => b.id),
                strategy: verticalListSortingStrategy,
                children: bundles.map((bundle, index2) => /* @__PURE__ */ jsx(
                  SortableRow,
                  {
                    bundle,
                    index: index2,
                    navigate,
                    submit
                  },
                  bundle.id
                ))
              }
            )
          }
        )
      }
    ) }) }) }) })
  ] });
}
function SortableRow({ bundle, index: index2, navigate, submit }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: bundle.id });
  const handleActivatorRef = (node) => {
    setActivatorNodeRef(node);
    if (node) {
      const tr = node.closest("tr");
      if (tr) {
        setNodeRef(tr);
      }
    }
  };
  const dndTransition = transition ? `${transition}, box-shadow 0.2s ease, background-color 0.2s ease` : "box-shadow 0.2s ease, background-color 0.2s ease";
  const style = {
    transform: CSS.Translate.toString(transform),
    transition: dndTransition,
    ...isDragging ? {
      position: "relative",
      zIndex: 9999,
      boxShadow: "0 8px 16px rgba(0,0,0,0.1)",
      backgroundColor: "var(--p-color-bg-surface-hover)",
      opacity: 0.95,
      display: "table-row"
    } : {
      zIndex: 1
    }
  };
  return (
    // @ts-ignore - Polaris IndexTable.Row types don't officially support 'style', but it passes through to the underlying HTML tr element
    /* @__PURE__ */ jsxs(IndexTable.Row, { id: bundle.id, position: index2, style, children: [
      /* @__PURE__ */ jsx(
        "td",
        {
          ref: handleActivatorRef,
          ...attributes,
          ...listeners,
          style: {
            cursor: isDragging ? "grabbing" : "grab",
            padding: "10px",
            width: "40px",
            textAlign: "center"
          },
          children: /* @__PURE__ */ jsx(Icon, { source: DragHandleIcon, tone: "base" })
        }
      ),
      /* @__PURE__ */ jsx(IndexTable.Cell, { children: /* @__PURE__ */ jsx(Text, { variant: "bodyMd", fontWeight: "bold", as: "span", children: bundle.title }) }),
      /* @__PURE__ */ jsx(IndexTable.Cell, { children: bundle.type }),
      /* @__PURE__ */ jsx(IndexTable.Cell, { children: /* @__PURE__ */ jsx(Badge, { tone: bundle.status === "ACTIVE" ? "success" : "info", children: bundle.status }) }),
      /* @__PURE__ */ jsxs(IndexTable.Cell, { children: [
        String(bundle.discountValue),
        " ",
        bundle.discountType === "PERCENTAGE" ? "%" : "off"
      ] }),
      /* @__PURE__ */ jsx(IndexTable.Cell, { children: /* @__PURE__ */ jsx(InlineStack, { gap: "300", wrap: false, children: /* @__PURE__ */ jsxs("div", { style: { pointerEvents: isDragging ? "none" : "auto", display: "flex", gap: "8px" }, children: [
        /* @__PURE__ */ jsx(Button, { onClick: () => navigate(`/app/bundles/${bundle.id}`), size: "micro", children: "Edit" }),
        /* @__PURE__ */ jsx(
          Button,
          {
            tone: "critical",
            onClick: () => submit({ intent: "delete", id: bundle.id }, { method: "post" }),
            size: "micro",
            children: "Delete"
          }
        )
      ] }) }) })
    ] })
  );
}
const route12 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action: action$1,
  default: Index,
  loader: loader$1
}, Symbol.toStringTag, { value: "Module" }));
const action = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const result = await syncAllBundleDiscountNodes(session.shop, admin);
  return json({ resynced: true, result });
};
async function postDebugLog(_payload) {
}
const loader = async ({ request }) => {
  var _a2, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _A, _B, _C;
  const { session, admin } = await authenticate.admin(request);
  const shopConfig = await prisma.shopConfig.findUnique({ where: { shop: session.shop } });
  const bundles = await prisma.bundle.findMany({
    where: { shop: session.shop },
    include: { items: true, tiers: true },
    orderBy: { createdAt: "desc" }
  });
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
  const allFunctions = ((_b = (_a2 = funcsData.data) == null ? void 0 : _a2.shopifyFunctions) == null ? void 0 : _b.nodes) || [];
  let consolidatedNode = null;
  let consolidatedNodeError = null;
  if (shopConfig == null ? void 0 : shopConfig.consolidatedNodeId) {
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
      consolidatedNode = ((_c = nodeData.data) == null ? void 0 : _c.discountNode) || null;
      if (!consolidatedNode) consolidatedNodeError = `Node ${gid} not found on Shopify (may have been deleted)`;
    } catch (e) {
      consolidatedNodeError = (e == null ? void 0 : e.message) || String(e);
    }
  }
  const consolidatedIssues = [];
  if (!(shopConfig == null ? void 0 : shopConfig.consolidatedNodeId)) {
    consolidatedIssues.push("CRITICAL: ShopConfig.consolidatedNodeId is null — consolidated discount node was never created. Click 'Re-sync Discount Nodes' below.");
  } else if (consolidatedNodeError) {
    consolidatedIssues.push(`CRITICAL: ${consolidatedNodeError}`);
  } else if (consolidatedNode) {
    const status = (_d = consolidatedNode.discount) == null ? void 0 : _d.status;
    if (status !== "ACTIVE") consolidatedIssues.push(`WARNING: Consolidated discount node status is "${status}" (not ACTIVE)`);
    if (!((_e = consolidatedNode.metafield) == null ? void 0 : _e.value)) consolidatedIssues.push("CRITICAL: Consolidated node exists but has NO metafield (bundle_app.config)");
    if (!((_g = (_f = consolidatedNode.discount) == null ? void 0 : _f.discountClasses) == null ? void 0 : _g.includes("PRODUCT"))) {
      consolidatedIssues.push(`CRITICAL: discountClasses=${JSON.stringify((_h = consolidatedNode.discount) == null ? void 0 : _h.discountClasses)} — missing PRODUCT`);
    }
    if ((_i = consolidatedNode.metafield) == null ? void 0 : _i.value) {
      try {
        const parsed = JSON.parse(consolidatedNode.metafield.value);
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        const badIds = arr.flatMap((c) => (c.items || []).filter((i) => {
          var _a3;
          return !((_a3 = i.productId) == null ? void 0 : _a3.startsWith("gid://shopify/Product/"));
        }).map((i) => i.productId));
        if (badIds.length > 0) consolidatedIssues.push(`CRITICAL: Some metafield productIds are not GIDs: ${JSON.stringify(badIds)}`);
      } catch {
        consolidatedIssues.push("CRITICAL: Metafield value is not valid JSON");
      }
    }
  }
  await postDebugLog({
    data: {
      shop: session.shop,
      shopConfigConsolidatedNodeId: (shopConfig == null ? void 0 : shopConfig.consolidatedNodeId) ?? null,
      bundleCount: bundles.length,
      allFunctions: allFunctions.map((f) => ({ id: f.id, title: f.title, apiType: f.apiType })),
      consolidatedNodeStatus: ((_j = consolidatedNode == null ? void 0 : consolidatedNode.discount) == null ? void 0 : _j.status) ?? null,
      consolidatedNodeDiscountClasses: ((_k = consolidatedNode == null ? void 0 : consolidatedNode.discount) == null ? void 0 : _k.discountClasses) ?? null,
      consolidatedNodeFunctionId: ((_m = (_l = consolidatedNode == null ? void 0 : consolidatedNode.discount) == null ? void 0 : _l.appDiscountType) == null ? void 0 : _m.functionId) ?? null,
      consolidatedNodeFunctionTitle: ((_o = (_n = consolidatedNode == null ? void 0 : consolidatedNode.discount) == null ? void 0 : _n.appDiscountType) == null ? void 0 : _o.title) ?? null,
      consolidatedNodeHasMetafield: !!((_p = consolidatedNode == null ? void 0 : consolidatedNode.metafield) == null ? void 0 : _p.value),
      consolidatedNodeMetafieldLength: ((_r = (_q = consolidatedNode == null ? void 0 : consolidatedNode.metafield) == null ? void 0 : _q.value) == null ? void 0 : _r.length) ?? 0,
      consolidatedNodeMetafieldPreview: (((_s = consolidatedNode == null ? void 0 : consolidatedNode.metafield) == null ? void 0 : _s.value) ?? "").slice(0, 220)
    }
  });
  const diagnostics = [];
  for (const bundle of bundles) {
    const dbInfo = {
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
        requiredQuantity: i.requiredQuantity
      })),
      tierCount: bundle.tiers.length,
      tiers: bundle.tiers.map((t) => ({
        quantity: t.quantity,
        discountType: t.discountType,
        discountValue: Number(t.discountValue)
      }))
    };
    const shopifyInfo = {
      nodeExists: false,
      nodeStatus: null,
      nodeTitle: null,
      functionId: null,
      functionApiType: null,
      discountClasses: null,
      metafieldValue: null,
      metafieldParsed: null,
      combinesWith: null,
      errors: []
    };
    if (bundle.shopifyDiscountId) {
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
        const node = (_t = nodeData.data) == null ? void 0 : _t.discountNode;
        if (node) {
          shopifyInfo.nodeExists = true;
          shopifyInfo.nodeStatus = ((_u = node.discount) == null ? void 0 : _u.status) || null;
          shopifyInfo.nodeTitle = ((_v = node.discount) == null ? void 0 : _v.title) || null;
          shopifyInfo.functionId = ((_x = (_w = node.discount) == null ? void 0 : _w.appDiscountType) == null ? void 0 : _x.functionId) || null;
          shopifyInfo.discountClasses = ((_y = node.discount) == null ? void 0 : _y.discountClasses) || null;
          shopifyInfo.combinesWith = ((_z = node.discount) == null ? void 0 : _z.combinesWith) || null;
          shopifyInfo.metafieldValue = ((_A = node.metafield) == null ? void 0 : _A.value) || null;
          if (shopifyInfo.functionId) {
            const matchedFunc = allFunctions.find((f) => f.id === shopifyInfo.functionId);
            shopifyInfo.functionApiType = (matchedFunc == null ? void 0 : matchedFunc.apiType) || "UNKNOWN (not found in functions list)";
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
      } catch (e) {
        shopifyInfo.errors.push(`Failed to query discount node: ${(e == null ? void 0 : e.message) || String(e)}`);
      }
    }
    const issues = [];
    const hasDiscountNode = shopifyInfo.nodeExists;
    if (!hasDiscountNode && bundle.status === "ACTIVE" && bundle.shopifyDiscountId) {
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
      const parsed = shopifyInfo.metafieldParsed;
      const config = Array.isArray(parsed) ? parsed[0] : parsed;
      metafieldHasItems = Array.isArray(config == null ? void 0 : config.items) && config.items.length > 0;
      if (!metafieldHasItems) {
        issues.push("CRITICAL: Metafield config has no items array or it's empty");
      }
      if (metafieldHasItems) {
        const allGids = config.items.every((i) => typeof i.productId === "string" && i.productId.startsWith("gid://shopify/Product/"));
        metafieldProductIdsAreGids = allGids;
        if (!allGids) {
          issues.push("CRITICAL: Some metafield item productIds are NOT full Shopify GIDs (function won't match cart lines)");
          const badIds = config.items.filter((i) => {
            var _a3;
            return !((_a3 = i.productId) == null ? void 0 : _a3.startsWith("gid://shopify/Product/"));
          }).map((i) => i.productId);
          issues.push(`  Bad productIds: ${JSON.stringify(badIds)}`);
        }
        const allHaveReqQty = config.items.every((i) => Number(i.requiredQuantity) > 0);
        if (!allHaveReqQty) {
          issues.push("WARNING: Some metafield items have requiredQuantity <= 0 or missing");
        }
      }
      if (bundle.type !== "VOLUME" && !(config == null ? void 0 : config.discountType)) {
        issues.push("CRITICAL: Non-volume bundle config has null/missing discountType — function won't generate any discount candidate");
      }
      if (bundle.type !== "VOLUME" && ((config == null ? void 0 : config.discountValue) === void 0 || (config == null ? void 0 : config.discountValue) === null || (config == null ? void 0 : config.discountValue) === 0)) {
        issues.push("WARNING: discountValue is 0 or missing — discount will be $0");
      }
    }
    const functionIsCartLines = shopifyInfo.functionApiType === "cart_lines_discounts_generate" || ((_B = shopifyInfo.functionApiType) == null ? void 0 : _B.includes("cart_lines"));
    if (hasDiscountNode && shopifyInfo.functionId && !functionIsCartLines) {
      issues.push(`CRITICAL: Function apiType is "${shopifyInfo.functionApiType}" — should be "cart_lines_discounts_generate" for product discounts`);
    }
    const discountClassIncludesProduct = ((_C = shopifyInfo.discountClasses) == null ? void 0 : _C.includes("PRODUCT")) ?? false;
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
        issues
      }
    });
  }
  await postDebugLog({
    data: {
      shop: session.shop,
      bundleCount: bundles.length,
      allFunctions: allFunctions.map((f) => ({ id: f.id, title: f.title, apiType: f.apiType }))
    }
  });
  return json({
    shop: session.shop,
    allFunctions,
    diagnostics,
    envFunctionId: process.env.SHOPIFY_BUNDLE_DISCOUNT_ID || "(not set)",
    shopConfig: { consolidatedNodeId: (shopConfig == null ? void 0 : shopConfig.consolidatedNodeId) ?? null },
    consolidatedNode,
    consolidatedIssues
  });
};
function DebugPage() {
  var _a2, _b, _c;
  const { shop, allFunctions, diagnostics, envFunctionId, shopConfig, consolidatedNode, consolidatedIssues } = useLoaderData();
  const handleResync = () => {
    const form2 = document.createElement("form");
    form2.method = "post";
    document.body.appendChild(form2);
    form2.submit();
  };
  return /* @__PURE__ */ jsxs(Page, { title: "Bundle Diagnostics", children: [
    /* @__PURE__ */ jsx(TitleBar, { title: "Bundle Diagnostics" }),
    /* @__PURE__ */ jsxs(BlockStack, { gap: "500", children: [
      /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "300", children: [
        /* @__PURE__ */ jsxs(InlineStack, { gap: "300", align: "start", children: [
          /* @__PURE__ */ jsx(Text, { variant: "headingMd", as: "h2", children: "Consolidated Discount Node" }),
          consolidatedIssues.length === 0 ? /* @__PURE__ */ jsx(Badge, { tone: "success", children: "HEALTHY" }) : /* @__PURE__ */ jsx(Badge, { tone: "critical", children: "BROKEN" })
        ] }),
        /* @__PURE__ */ jsxs(Text, { as: "p", children: [
          /* @__PURE__ */ jsx("strong", { children: "ShopConfig.consolidatedNodeId:" }),
          " ",
          shopConfig.consolidatedNodeId ?? "(null — not created yet)"
        ] }),
        consolidatedNode && /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsxs(Text, { as: "p", children: [
            /* @__PURE__ */ jsx("strong", { children: "Status:" }),
            " ",
            (_a2 = consolidatedNode == null ? void 0 : consolidatedNode.discount) == null ? void 0 : _a2.status
          ] }),
          /* @__PURE__ */ jsxs(Text, { as: "p", children: [
            /* @__PURE__ */ jsx("strong", { children: "Discount Classes:" }),
            " ",
            JSON.stringify((_b = consolidatedNode == null ? void 0 : consolidatedNode.discount) == null ? void 0 : _b.discountClasses)
          ] }),
          /* @__PURE__ */ jsxs(Text, { as: "p", children: [
            /* @__PURE__ */ jsx("strong", { children: "Metafield present:" }),
            " ",
            ((_c = consolidatedNode == null ? void 0 : consolidatedNode.metafield) == null ? void 0 : _c.value) ? `Yes (${consolidatedNode.metafield.value.length} chars)` : "No"
          ] })
        ] }),
        consolidatedIssues.length > 0 && /* @__PURE__ */ jsx(Banner, { tone: "critical", title: "Issues Found", children: /* @__PURE__ */ jsx(BlockStack, { gap: "100", children: consolidatedIssues.map((issue, i) => /* @__PURE__ */ jsx(Text, { as: "p", children: issue }, i)) }) }),
        /* @__PURE__ */ jsx(Button, { variant: "primary", onClick: handleResync, children: "Re-sync Discount Nodes Now" })
      ] }) }),
      /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "300", children: [
        /* @__PURE__ */ jsx(Text, { variant: "headingMd", as: "h2", children: "Environment" }),
        /* @__PURE__ */ jsxs(Text, { as: "p", children: [
          /* @__PURE__ */ jsx("strong", { children: "Shop:" }),
          " ",
          shop
        ] }),
        /* @__PURE__ */ jsxs(Text, { as: "p", children: [
          /* @__PURE__ */ jsx("strong", { children: "SHOPIFY_BUNDLE_DISCOUNT_ID:" }),
          " ",
          envFunctionId
        ] })
      ] }) }),
      /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "300", children: [
        /* @__PURE__ */ jsxs(Text, { variant: "headingMd", as: "h2", children: [
          "Available Shopify Functions (",
          allFunctions.length,
          ")"
        ] }),
        allFunctions.map((f) => /* @__PURE__ */ jsx(Box, { padding: "200", background: "bg-surface-secondary", borderRadius: "200", children: /* @__PURE__ */ jsxs(Text, { as: "p", children: [
          /* @__PURE__ */ jsx("strong", { children: f.title }),
          " — apiType: ",
          f.apiType,
          " — ID: ",
          /* @__PURE__ */ jsx("code", { children: f.id })
        ] }) }, f.id))
      ] }) }),
      diagnostics.map((d, idx) => {
        const hasIssues = d.validation.issues.length > 0;
        const isHealthy = !hasIssues && d.db.status === "ACTIVE" && d.validation.nodeIsActive;
        return /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs(BlockStack, { gap: "400", children: [
          /* @__PURE__ */ jsxs(InlineStack, { gap: "300", align: "start", children: [
            /* @__PURE__ */ jsx(Text, { variant: "headingMd", as: "h2", children: d.db.title }),
            /* @__PURE__ */ jsx(Badge, { tone: d.db.status === "ACTIVE" ? "success" : "warning", children: d.db.status }),
            /* @__PURE__ */ jsx(Badge, { children: d.db.type }),
            isHealthy && /* @__PURE__ */ jsx(Badge, { tone: "success", children: "HEALTHY" }),
            hasIssues && /* @__PURE__ */ jsx(Badge, { tone: "critical", children: "ISSUES FOUND" })
          ] }),
          hasIssues && /* @__PURE__ */ jsx(Banner, { tone: "critical", title: "Validation Issues", children: /* @__PURE__ */ jsx(BlockStack, { gap: "100", children: d.validation.issues.map((issue, i) => /* @__PURE__ */ jsx(Text, { as: "p", children: issue }, i)) }) }),
          /* @__PURE__ */ jsx(Text, { variant: "headingSm", as: "h3", children: "Database State" }),
          /* @__PURE__ */ jsx(Box, { padding: "200", background: "bg-surface-secondary", borderRadius: "200", children: /* @__PURE__ */ jsx("pre", { style: { fontSize: "12px", whiteSpace: "pre-wrap", wordBreak: "break-all" }, children: JSON.stringify(d.db, null, 2) }) }),
          /* @__PURE__ */ jsx(Text, { variant: "headingSm", as: "h3", children: "Shopify Discount Node" }),
          /* @__PURE__ */ jsx(Box, { padding: "200", background: "bg-surface-secondary", borderRadius: "200", children: /* @__PURE__ */ jsx("pre", { style: { fontSize: "12px", whiteSpace: "pre-wrap", wordBreak: "break-all" }, children: JSON.stringify(d.shopify, null, 2) }) }),
          /* @__PURE__ */ jsx(Text, { variant: "headingSm", as: "h3", children: "Validation Summary" }),
          /* @__PURE__ */ jsx(Box, { padding: "200", background: "bg-surface-secondary", borderRadius: "200", children: /* @__PURE__ */ jsx("pre", { style: { fontSize: "12px", whiteSpace: "pre-wrap", wordBreak: "break-all" }, children: JSON.stringify(d.validation, null, 2) }) })
        ] }) }, d.db.id);
      })
    ] })
  ] });
}
const route13 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  action,
  default: DebugPage,
  loader
}, Symbol.toStringTag, { value: "Module" }));
const serverManifest = { "entry": { "module": "/assets/entry.client-Dki222tq.js", "imports": ["/assets/index-BXFZJKZ8.js", "/assets/components-B2MXwJ-S.js"], "css": [] }, "routes": { "root": { "id": "root", "parentId": void 0, "path": "", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/root-B09j7QlO.js", "imports": ["/assets/index-BXFZJKZ8.js", "/assets/components-B2MXwJ-S.js"], "css": [] }, "routes/webhooks.collections.update": { "id": "routes/webhooks.collections.update", "parentId": "root", "path": "webhooks/collections/update", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/webhooks.collections.update-l0sNRNKZ.js", "imports": [], "css": [] }, "routes/webhooks.app.scopes_update": { "id": "routes/webhooks.app.scopes_update", "parentId": "root", "path": "webhooks/app/scopes_update", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/webhooks.app.scopes_update-l0sNRNKZ.js", "imports": [], "css": [] }, "routes/webhooks.app.uninstalled": { "id": "routes/webhooks.app.uninstalled", "parentId": "root", "path": "webhooks/app/uninstalled", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/webhooks.app.uninstalled-l0sNRNKZ.js", "imports": [], "css": [] }, "routes/auth.login": { "id": "routes/auth.login", "parentId": "root", "path": "auth/login", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/route-DjL0Zr1r.js", "imports": ["/assets/index-BXFZJKZ8.js", "/assets/styles-DjvKPUBc.js", "/assets/components-B2MXwJ-S.js", "/assets/Page-D9pdNdHS.js", "/assets/context-BusKBsRw.js"], "css": [] }, "routes/_index": { "id": "routes/_index", "parentId": "root", "path": void 0, "index": true, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/route-R7uWX6_v.js", "imports": ["/assets/index-BXFZJKZ8.js", "/assets/components-B2MXwJ-S.js"], "css": ["/assets/route-Xpdx9QZl.css"] }, "routes/auth.$": { "id": "routes/auth.$", "parentId": "root", "path": "auth/*", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/auth._-l0sNRNKZ.js", "imports": [], "css": [] }, "routes/app": { "id": "routes/app", "parentId": "root", "path": "app", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": true, "module": "/assets/app-Cq7Lyb2Y.js", "imports": ["/assets/index-BXFZJKZ8.js", "/assets/components-B2MXwJ-S.js", "/assets/styles-DjvKPUBc.js", "/assets/context-BusKBsRw.js"], "css": [] }, "routes/app.bundles.$id": { "id": "routes/app.bundles.$id", "parentId": "routes/app", "path": "bundles/:id", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/app.bundles._id-Da_2KdzG.js", "imports": ["/assets/index-BXFZJKZ8.js", "/assets/volume-brackets-BsJ0wB5Q.js", "/assets/components-B2MXwJ-S.js", "/assets/Page-D9pdNdHS.js", "/assets/TitleBar-DFMSJ8Yc.js", "/assets/Layout-BW6TgK73.js", "/assets/EmptySearchResult-B5Jp3ieX.js", "/assets/Banner-BiM8hRvP.js", "/assets/context-BusKBsRw.js", "/assets/banner-context-RZ1829w2.js"], "css": [] }, "routes/app.bundles.new": { "id": "routes/app.bundles.new", "parentId": "routes/app", "path": "bundles/new", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/app.bundles.new-wMJ1aSt5.js", "imports": ["/assets/index-BXFZJKZ8.js", "/assets/volume-brackets-BsJ0wB5Q.js", "/assets/components-B2MXwJ-S.js", "/assets/Page-D9pdNdHS.js", "/assets/TitleBar-DFMSJ8Yc.js", "/assets/Layout-BW6TgK73.js", "/assets/EmptySearchResult-B5Jp3ieX.js", "/assets/Banner-BiM8hRvP.js", "/assets/context-BusKBsRw.js", "/assets/banner-context-RZ1829w2.js"], "css": [] }, "routes/app.additional": { "id": "routes/app.additional", "parentId": "routes/app", "path": "additional", "index": void 0, "caseSensitive": void 0, "hasAction": false, "hasLoader": false, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/app.additional-CjxL8NOn.js", "imports": ["/assets/index-BXFZJKZ8.js", "/assets/Page-D9pdNdHS.js", "/assets/TitleBar-DFMSJ8Yc.js", "/assets/Layout-BW6TgK73.js", "/assets/banner-context-RZ1829w2.js", "/assets/context-BusKBsRw.js"], "css": [] }, "routes/app.settings": { "id": "routes/app.settings", "parentId": "routes/app", "path": "settings", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/app.settings-DlxcuhdF.js", "imports": ["/assets/index-BXFZJKZ8.js", "/assets/components-B2MXwJ-S.js", "/assets/Page-D9pdNdHS.js", "/assets/TitleBar-DFMSJ8Yc.js", "/assets/Layout-BW6TgK73.js", "/assets/Banner-BiM8hRvP.js", "/assets/context-BusKBsRw.js", "/assets/banner-context-RZ1829w2.js"], "css": [] }, "routes/app._index": { "id": "routes/app._index", "parentId": "routes/app", "path": void 0, "index": true, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/app._index-BEuVK0A9.js", "imports": ["/assets/index-BXFZJKZ8.js", "/assets/components-B2MXwJ-S.js", "/assets/Page-D9pdNdHS.js", "/assets/TitleBar-DFMSJ8Yc.js", "/assets/Layout-BW6TgK73.js", "/assets/context-BusKBsRw.js", "/assets/EmptySearchResult-B5Jp3ieX.js"], "css": [] }, "routes/app.debug": { "id": "routes/app.debug", "parentId": "routes/app", "path": "debug", "index": void 0, "caseSensitive": void 0, "hasAction": true, "hasLoader": true, "hasClientAction": false, "hasClientLoader": false, "hasErrorBoundary": false, "module": "/assets/app.debug-0ug36t5V.js", "imports": ["/assets/index-BXFZJKZ8.js", "/assets/components-B2MXwJ-S.js", "/assets/Page-D9pdNdHS.js", "/assets/TitleBar-DFMSJ8Yc.js", "/assets/Banner-BiM8hRvP.js", "/assets/context-BusKBsRw.js", "/assets/banner-context-RZ1829w2.js"], "css": [] } }, "url": "/assets/manifest-50b6e21f.js", "version": "50b6e21f" };
const mode = "production";
const assetsBuildDirectory = "build/client";
const basename = "/";
const future = { "v3_fetcherPersist": true, "v3_relativeSplatPath": true, "v3_throwAbortReason": true, "v3_routeConfig": true, "v3_singleFetch": false, "v3_lazyRouteDiscovery": true, "unstable_optimizeDeps": false };
const isSpaMode = false;
const publicPath = "/";
const entry = { module: entryServer };
const routes = {
  "root": {
    id: "root",
    parentId: void 0,
    path: "",
    index: void 0,
    caseSensitive: void 0,
    module: route0
  },
  "routes/webhooks.collections.update": {
    id: "routes/webhooks.collections.update",
    parentId: "root",
    path: "webhooks/collections/update",
    index: void 0,
    caseSensitive: void 0,
    module: route1
  },
  "routes/webhooks.app.scopes_update": {
    id: "routes/webhooks.app.scopes_update",
    parentId: "root",
    path: "webhooks/app/scopes_update",
    index: void 0,
    caseSensitive: void 0,
    module: route2
  },
  "routes/webhooks.app.uninstalled": {
    id: "routes/webhooks.app.uninstalled",
    parentId: "root",
    path: "webhooks/app/uninstalled",
    index: void 0,
    caseSensitive: void 0,
    module: route3
  },
  "routes/auth.login": {
    id: "routes/auth.login",
    parentId: "root",
    path: "auth/login",
    index: void 0,
    caseSensitive: void 0,
    module: route4
  },
  "routes/_index": {
    id: "routes/_index",
    parentId: "root",
    path: void 0,
    index: true,
    caseSensitive: void 0,
    module: route5
  },
  "routes/auth.$": {
    id: "routes/auth.$",
    parentId: "root",
    path: "auth/*",
    index: void 0,
    caseSensitive: void 0,
    module: route6
  },
  "routes/app": {
    id: "routes/app",
    parentId: "root",
    path: "app",
    index: void 0,
    caseSensitive: void 0,
    module: route7
  },
  "routes/app.bundles.$id": {
    id: "routes/app.bundles.$id",
    parentId: "routes/app",
    path: "bundles/:id",
    index: void 0,
    caseSensitive: void 0,
    module: route8
  },
  "routes/app.bundles.new": {
    id: "routes/app.bundles.new",
    parentId: "routes/app",
    path: "bundles/new",
    index: void 0,
    caseSensitive: void 0,
    module: route9
  },
  "routes/app.additional": {
    id: "routes/app.additional",
    parentId: "routes/app",
    path: "additional",
    index: void 0,
    caseSensitive: void 0,
    module: route10
  },
  "routes/app.settings": {
    id: "routes/app.settings",
    parentId: "routes/app",
    path: "settings",
    index: void 0,
    caseSensitive: void 0,
    module: route11
  },
  "routes/app._index": {
    id: "routes/app._index",
    parentId: "routes/app",
    path: void 0,
    index: true,
    caseSensitive: void 0,
    module: route12
  },
  "routes/app.debug": {
    id: "routes/app.debug",
    parentId: "routes/app",
    path: "debug",
    index: void 0,
    caseSensitive: void 0,
    module: route13
  }
};
export {
  serverManifest as assets,
  assetsBuildDirectory,
  basename,
  entry,
  future,
  isSpaMode,
  mode,
  publicPath,
  routes
};
