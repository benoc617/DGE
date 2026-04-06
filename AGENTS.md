<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## SRX tooling (Docker only)

**Do not** run `npm test`, `npm run test:*`, `npm run lint`, `npm run typecheck`, `npm run build`, or other project **verification** on the **host** machine. The canonical environment is the Compose **`app`** container (Linux `node_modules`, correct native bindings). **Always** use `npm run docker:*` scripts from the repo root with the stack up, or `docker compose exec app …` — see **`CLAUDE.md`** → **Container-only npm (mandatory for agents)**.
