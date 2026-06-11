# 6Gate Deployment

**Architecture**

```
  Browser ──▶ Vercel (Next.js UI, 6gate.minfect.com)
                 │  rewrites /api/* and SSR fetches
                 ▼
            https://6gate-api.minfect.com   ──▶ nginx (TLS) ──▶ pm2 ▶ NestJS API :20130
                                                                          │
                                                                          ▼
                                              Postgres (postgre.minfect.com:5432/sixgate, SSL)
```

- **API** → VPS, run by **pm2** behind your existing **nginx** + Let's Encrypt.
- **UI** → **Vercel**, talks to the API via the `API_URL` env var.

---

## Part A — API on the VPS

### 1. DNS
Point an **A record** `6gate-api.minfect.com` → your VPS public IP. Verify:
```bash
dig +short 6gate-api.minfect.com
```

### 2. Get the code + secrets on the VPS
```bash
git clone <your-repo> 6gate && cd 6gate/app   # or git pull on an existing checkout
```
Create `app/.env` (do **not** commit real secrets):
```ini
SYSTEM_SECRET=<your-login-secret>
ENCRYPTION_KEY=<your-encryption-key>
DATABASE_URL=postgresql://minfect:<db-password>@postgre.minfect.com:5432/sixgate
DATABASE_SSL=require
```
> - `SYSTEM_SECRET` is the login secret (and JWT / `x-system-secret` signer) — rotate freely.
> - `ENCRYPTION_KEY` is the AES key for sensitive values; it **must stay identical** to the
>   original, or the storage token already migrated into Postgres won't decrypt.

### 3. Build + run with pm2
```bash
cd ~/6gate/app
npm ci                       # prebuilt better-sqlite3 binary downloads on x64 Linux;
                             # if it tries to compile: sudo apt install -y build-essential python3
npm run build                # -> dist/main.js
npm i -g pm2                 # if not already installed
pm2 start ecosystem.config.js
pm2 save
pm2 startup                  # run the command it prints, so the API survives reboots
```
The API now listens on **127.0.0.1:20130** (and runs the Postgres migrations on boot —
idempotent, safe). Check it:
```bash
pm2 logs 6gate-api --lines 50
curl -s -H "x-system-secret: $SYSTEM_SECRET" http://127.0.0.1:20130/api/providers | head -c 200
```

> Firewall: only expose 80/443. Keep 20130 closed to the public (nginx reaches it on
> localhost): `sudo ufw allow 'Nginx Full' && sudo ufw deny 20130`.

### 4. nginx + TLS (Cloudflare Origin cert — no certbot)
TLS uses a shared **Cloudflare Origin Certificate** for `*.minfect.com`; the domain
must be Cloudflare-proxied (orange cloud) with SSL mode **Full (strict)**. The host
**must be a single-level subdomain** (`6gate-api.minfect.com`, not `api.6gate.minfect.com`)
so Cloudflare's free edge SSL (`*.minfect.com`) covers it. Full copy-paste CLI is in
**[DEPLOY-API.md](DEPLOY-API.md)**: save the wildcard origin cert at
`/etc/nginx/ssl/minfect.com.{pem,key}`, `cp` the nginx conf, `nginx -t && reload`.

Verify end-to-end (through Cloudflare):
```bash
curl -s https://6gate-api.minfect.com/api/providers -H "x-system-secret: $SYSTEM_SECRET" | head -c 200
```

### 5. Redeploying later
```bash
cd ~/6gate && git pull && cd app
npm ci && npm run build
pm2 reload 6gate-api
```

---

## Part B — UI on Vercel

1. **Import** the repo in Vercel → **New Project**.
2. **Root Directory**: `ui` (Vercel auto-detects Next.js).
   - Build/Install commands: leave default. The `@sixgate/api-client` dependency is now
     vendored at `ui/vendor/sixgate-api-client`, so `npm install` works on a clean clone.
3. **Environment Variables** (Production + Preview):
   | Name | Value |
   |------|-------|
   | `API_URL` | `https://6gate-api.minfect.com` |
4. **Deploy.** Then add your UI domain (e.g. `6gate.minfect.com`) under Project → Domains.

`API_URL` drives both the `/api/*` rewrite and server-side rendering fetches
([next.config.ts](../ui/next.config.ts), [api-client.ts](../ui/src/lib/api-client.ts),
[proxy.ts](../ui/src/proxy.ts)). Log in with the `SYSTEM_SECRET` value.

---

## Caveats on the Vercel split

- **Large uploads / SSE through Vercel.** The job-log stream (`/api/post-jobs/:id/events`)
  and any large request body are proxied by Vercel when called as `/api/*` on the UI origin.
  Vercel imposes body-size and connection-duration limits that self-hosting doesn't. If you
  hit truncated uploads or dropped log streams, point those specific calls **directly** at
  `https://6gate-api.minfect.com` from the browser — the API already sends permissive CORS
  (`origin: *`) in [main.ts](../app/src/main.ts), so cross-origin calls work.
- **SYSTEM_SECRET parity.** Same value in the VPS `app/.env` and what users enter at login.
- The `Dockerfile`s in `app/` and `ui/` are from the earlier Docker plan and are **not used**
  by this pm2 + Vercel deploy. Safe to ignore or delete.
