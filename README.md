# GameGuard

GameGuard is a responsive gaming transaction workspace with server-owned development authentication.

## Development

Run the client and API in separate terminals:

```bash
npm run dev
npm run server
```

For the middleman portal, export credentials before starting the API. The account is seeded with a server-side hash on first use:

```bash
export MIDDLEMAN_EMAIL=your-middleman@example.com
export MIDDLEMAN_PASSWORD='use-a-long-development-password'
export MIDDLEMAN_USERNAME=middleman
npm run server
```

Middleman login is available at `/middleman/login`. Accounts without the `middleman` or `admin` role are rejected by the server and redirected away from `/middleman/*` routes.

The client is available at `http://localhost:5173` or through your forwarded workspace port at `http://<workspace-host>:5173`. Both the Vite client and API bind to `0.0.0.0` so the forwarded client port can reach the API through the Vite proxy. The API uses a local ignored `data/auth.json` file for development users and sessions. Passwords are hashed with Node `scrypt`; sessions use HTTP-only, SameSite cookies. Set `NODE_ENV=production` behind HTTPS to enable the `Secure` cookie flag.

Authentication routes are `/signup`, `/login`, and `/forgot-password`. Protected routes redirect to `/login` with a return path.

## Production deployment

### Vercel

Import this repository into Vercel. The included `vercel.json` builds the Vite frontend and routes `/api/*` to the existing Node API function. Add `MIDDLEMAN_EMAIL`, `MIDDLEMAN_PASSWORD`, and optionally `MIDDLEMAN_USERNAME` under Vercel project settings, then redeploy.

The current API stores users, sessions, requests, messages, and reset tokens in `data/auth.json`. Vercel function filesystems are ephemeral, so this file is suitable for local development only; connect the API to a persistent database before relying on production accounts or transactions. Also set `NODE_ENV=production` so session cookies use the `Secure` flag.

The included `render.yaml` deploys the Vite build and Node API as one Render web service. In Render, create a new Blueprint from this repository, set `MIDDLEMAN_EMAIL` and `MIDDLEMAN_PASSWORD`, and deploy. The service listens on Render's `PORT` automatically through `API_PORT`'s default unless the host provides a port override.

To connect `gamersguard.com` through Cloudflare, add the custom domain in Render first, then create the DNS record Render provides in Cloudflare. Keep the record proxied only if Render reports that Cloudflare proxying is supported for the custom domain. Add both the root domain and `www` if you want both URLs to work.

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
