---
description: Launch the 6Gate app (NestJS API + Next.js UI) and drive it in the browser
triggers:
  - run the app
  - start the app
  - launch the app
  - verify in browser
---

# Run 6Gate

6Gate is two services: a NestJS API on port **20130** and a Next.js UI on port **20129**.
The UI proxies `/api/*` to the backend.

## Prerequisites

Both `app/` and `ui/` need `node_modules` installed:

```bash
cd app && npm install && cd ../ui && npm install && cd ..
```

The backend requires a `.env` file at `app/.env` with at minimum:

```
DATABASE_URL=postgresql://<user>:<pass>@<host>:5432/<db>
SYSTEM_SECRET=<any-string>
ENCRYPTION_KEY=<any-string>
```

`SYSTEM_SECRET` and `ENCRYPTION_KEY` are auto-generated on first boot if missing.

## 1. Stop any previous instances

```bash
pkill -f "nest start" 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true
```

On Windows (PowerShell):

```powershell
Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -match 'nest start|next dev' } | Stop-Process -Force -ErrorAction SilentlyContinue
```

## 2. Start the backend (port 20130)

```bash
cd app && npm run dev &
echo $! > /tmp/6gate-api.pid
```

Wait for it to be ready:

```bash
timeout 30 bash -c 'until curl -sf http://localhost:20130/api/health >/dev/null 2>&1; do sleep 1; done'
```

## 3. Start the frontend (port 20129)

```bash
cd ui && npm run dev &
echo $! > /tmp/6gate-ui.pid
```

Wait for it to be ready:

```bash
timeout 30 bash -c 'until curl -sf http://localhost:20129 >/dev/null 2>&1; do sleep 1; done'
```

## 4. Drive in browser

Use the Chrome MCP tools (`mcp__Claude_in_Chrome__*`) or `chromium-cli` to navigate to `http://localhost:20129`.

The app opens to a login page. Log in with the `SYSTEM_SECRET` value from `app/.env`.

After login, the sidebar shows: Dashboard, Providers, Groups, Schedule, Use Cases.

### Smoke check

1. Navigate to `http://localhost:20129`
2. If on login page, enter the system secret and submit
3. Verify the sidebar renders with navigation links
4. Navigate to `/schedule` — should show the weekly calendar view
5. Navigate to `/processes` — should show running processes dashboard
6. Navigate to `/groups` — should list groups

### API smoke

```bash
curl -sf http://localhost:20130/api/health | head -c 200
curl -sf http://localhost:20130/api/schedules | head -c 200
curl -sf http://localhost:20130/api/post-jobs/table | head -c 200
```

## 5. Stop

```bash
kill $(cat /tmp/6gate-api.pid) $(cat /tmp/6gate-ui.pid) 2>/dev/null
```

## Gotchas

- The backend auto-runs Postgres migrations on boot. First start after schema changes takes a few extra seconds.
- Next.js 16 with Turbopack may show a workspace root warning on some setups — this is cosmetic and doesn't block the dev server on the standard `npm run dev` path.
- The UI port is **20129**, the API port is **20130**. Don't mix them up.
- `SYSTEM_SECRET` in `app/.env` is the login password for the admin UI.
