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
