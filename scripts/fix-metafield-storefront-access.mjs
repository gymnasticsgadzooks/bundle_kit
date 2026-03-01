/**
 * fix-metafield-storefront-access.mjs
 *
 * One-shot script that grants PUBLIC_READ storefront access to the
 * bundle_app.config metafield definition so Shopify Liquid themes can
 * read it via product.metafields.bundle_app.config.value
 *
 * Usage:
 *   SHOPIFY_STORE=your-store.myshopify.com \
 *   SHOPIFY_ADMIN_TOKEN=shpat_xxxx \
 *   node scripts/fix-metafield-storefront-access.mjs
 */

const STORE   = process.env.SHOPIFY_STORE;
const TOKEN   = process.env.SHOPIFY_ADMIN_TOKEN;
const API_VER = '2025-01';

if (!STORE || !TOKEN) {
  console.error(`
  Missing environment variables. Run as:

    SHOPIFY_STORE=your-store.myshopify.com \\
    SHOPIFY_ADMIN_TOKEN=shpat_xxxx \\
    node scripts/fix-metafield-storefront-access.mjs
  `);
  process.exit(1);
}

const endpoint = `https://${STORE}/admin/api/${API_VER}/graphql.json`;
const headers  = {
  'Content-Type':          'application/json',
  'X-Shopify-Access-Token': TOKEN,
};

async function gql(query, variables = {}) {
  const res  = await fetch(endpoint, {
    method:  'POST',
    headers,
    body:    JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors, null, 2));
  return json.data;
}

// ── Step 1: find the existing definition ─────────────────────────────────────
console.log('🔍  Looking up bundle_app.config metafield definition…');

const listData = await gql(`{
  metafieldDefinitions(first: 50, ownerType: PRODUCT) {
    edges {
      node {
        id
        namespace
        key
        access { storefront }
      }
    }
  }
}`);

const defs = listData.metafieldDefinitions.edges.map(e => e.node);
const def  = defs.find(d => d.namespace === 'bundle_app' && d.key === 'config');

if (!def) {
  console.error(`
  ✗  Could not find a metafield definition for bundle_app.config on this store.
     Make sure the BundleKit app is installed and has been opened at least once
     so it can register the definition, then re-run this script.
  `);
  process.exit(1);
}

console.log(`   Found: ${def.id}`);
console.log(`   Current storefront access: ${def.access.storefront}`);

if (def.access.storefront === 'PUBLIC_READ') {
  console.log('\n✓  Already set to PUBLIC_READ — nothing to do.');
  process.exit(0);
}

// ── Step 2: update to PUBLIC_READ ────────────────────────────────────────────
console.log('\n🔧  Updating storefront access to PUBLIC_READ…');

const updateData = await gql(`
  mutation UpdateMetafieldDef($definition: MetafieldDefinitionUpdateInput!) {
    metafieldDefinitionUpdate(definition: $definition) {
      updatedDefinition {
        id
        access { storefront }
      }
      userErrors { field message code }
    }
  }
`, {
  definition: {
    id:     def.id,
    access: { storefront: 'PUBLIC_READ' },
  },
});

const result = updateData.metafieldDefinitionUpdate;

if (result.userErrors.length > 0) {
  console.error('\n✗  Mutation returned errors:');
  result.userErrors.forEach(e => console.error(`   [${e.code}] ${e.field}: ${e.message}`));
  process.exit(1);
}

console.log(`\n✓  Done!`);
console.log(`   Definition : ${result.updatedDefinition.id}`);
console.log(`   Storefront : ${result.updatedDefinition.access.storefront}`);
console.log(`\n   product.metafields.bundle_app.config.value is now readable in Liquid.`);
