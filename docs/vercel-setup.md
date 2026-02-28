# Vercel Setup — Connect Project and Environment Variables

Follow these steps to connect the Bundle Kit app to Vercel and configure environment variables.

## Quick start (CLI)

```bash
# 1. Link project (interactive; requires Vercel login)
npm run vercel:link

# 2. Set env vars: either manually in Vercel Dashboard, or sync from .env:
npm run vercel:env-sync production
```

## 1. Connect the Repository

### Option A: Vercel Dashboard (recommended)

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **Add New** → **Project**
3. Import the `bundle_kit` repository (GitHub/GitLab/Bitbucket)
4. Vercel will auto-detect Remix — no framework override needed
5. **Do not deploy yet** — set environment variables first (Step 2)

### Option B: Vercel CLI

```bash
# Install Vercel CLI if needed: npm i -g vercel
npx vercel link
```

Follow the prompts to link an existing project or create a new one.

---

## 2. Set Environment Variables

Set these in **Vercel Project → Settings → Environment Variables** (or via CLI below).

| Variable | Value | Environment | Sensitive |
|----------|-------|--------------|-----------|
| `SHOPIFY_APP_URL` | `https://your-app.vercel.app` | Production | No |
| `SHOPIFY_API_KEY` | From `shopify app env show` | Production | No |
| `SHOPIFY_API_SECRET` | From `shopify app env show` | Production | **Yes** |
| `SCOPES` | `write_products,read_discounts,write_discounts` | Production | No |
| `DATABASE_URL` | Supabase connection pooler URI | Production | **Yes** |
| `NODE_ENV` | `production` | Production | No |

**Notes:**

- **SHOPIFY_APP_URL**: Use your actual Vercel URL after the first deploy (e.g. `https://bundle-kit-xxx.vercel.app`). Update it after the initial deployment.
- **DATABASE_URL**: Use the Supabase **Transaction mode** (port 6543) URI with `?pgbouncer=true`. Example:
  ```
  postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true
  ```
- Get Shopify values: `shopify app env show`

---

## 3. Sync Env Vars from Local .env (Optional)

If you have a populated `.env` file, you can sync selected variables to Vercel:

```bash
./scripts/vercel-env-sync.sh production
```

This reads `.env` and runs `vercel env add` for each variable. Requires `vercel link` to be run first.

---

## 4. Build Settings

Vercel uses `vercel.json` in the repo:

- **Build Command**: `npm run build`
- **Install Command**: `npm ci`

No changes needed unless you customize further.

---

## 5. Deploy

```bash
npx vercel deploy --prod
```

Or push to the connected Git branch for automatic deploys.

---

## 6. Post-Deploy

1. Copy your production URL (e.g. `https://bundle-kit-xxx.vercel.app`)
2. Update `SHOPIFY_APP_URL` in Vercel env vars
3. Update [shopify.app.toml](../shopify.app.toml) with the production URL
4. Run `shopify app deploy` to update Shopify app config
