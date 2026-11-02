# Deploying

The build is static: `npm run build` → `dist/`. Every host needs the same single rule,
because the routes (`/districts`, `/projects/…`, `/about`) are handled in the browser:
**a path that is not a file serves `/index.html`**.

Before deploying, run `npm run check`. It exits non-zero if an office name, district id
or exclusion does not match the API, so it can gate a CI deploy:

```yaml
# .github/workflows/deploy.yml (excerpt)
- run: npm ci
- run: npm run check
- run: npm run build
```

## Cloudflare Workers (static assets)

`wrangler.jsonc` deploys `dist/` as static assets with single-page-application fallback.
No Worker code and no bindings.

```bash
# change "name" in wrangler.jsonc first
npx wrangler login
npm run deploy:cloudflare
```

Add a custom domain in the Cloudflare dashboard (Workers → your worker → Domains).

## Vercel

Import the repository. `vercel.json` sets the Vite build, `dist/` and the rewrite to
`index.html`.

## Netlify

Import the repository. `netlify.toml` sets the build and the 200 redirect to
`index.html`.

## GitHub Pages and plain web servers

Serve `dist/`. For the fallback, copy `dist/index.html` to `dist/404.html` (GitHub Pages),
or configure the server (nginx: `try_files $uri /index.html;`).

## Link previews

Set `siteUrl` in `portal.config.ts`. The build writes the portal's name, description and
canonical URL into `index.html`, so link previews show the right portal.

## The API host

The portal reads `https://budget.bettergov.ph` unless `api` is set in the config or
`VITE_API_BASE` is set at build time. The API is CORS-open and edge-cached, so no proxy
is needed.

`npm run check` loads the same Vite `.env`, `.env.local`, `.env.production`, and
`.env.production.local` files as the default build. Process environment variables
take precedence. For a different mode, use the same mode for both commands:

```bash
npm run check -- --mode staging
npm run build -- --mode staging
```
