import type { ActionFunctionArgs } from "@vercel/remix";
import { authenticate } from "../shopify.server";
import { syncBundlesAffectedByEntity } from "../utils/settings.server";

/**
 * Handles webhooks for collection and product lifecycle events.
 * Routes configured in shopify.app.toml:
 *   - collections/update, collections/delete
 *   - products/update, products/delete
 *
 * When any of these fire, we find all ACTIVE bundles that reference the
 * changed entity and re-sync the consolidated discount node payload (for the
 * Shopify Function) and per-product storefront metafields (for Liquid themes).
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, admin, payload } = await authenticate.webhook(request);

  if (!admin) {
    // The webhook payload was authenticated, but a tenant admin could not be initialized
    return new Response();
  }

  console.log(`BundleKit: Received ${topic} webhook for shop ${shop}`);

  try {
    // Extract the Shopify GID from the webhook payload.
    // Webhook payloads include `admin_graphql_api_id` for the affected resource.
    const adminGraphqlApiId = (payload as any)?.admin_graphql_api_id;

    if (!adminGraphqlApiId) {
      console.warn(`BundleKit: ${topic} webhook payload missing admin_graphql_api_id. Payload keys: ${Object.keys(payload as any).join(", ")}`);
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
    // Return 200 anyway to prevent Shopify from retrying indefinitely.
    // The error is logged for debugging.
  }

  return new Response("Webhook processed", { status: 200 });
};
