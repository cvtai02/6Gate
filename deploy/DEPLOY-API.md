# Deploy the 6Gate API to the VPS (pm2 + nginx + Cloudflare Origin TLS)

Copy-paste CLI. Run on the **VPS** unless noted. TLS uses a **Cloudflare Origin
Certificate** (no certbot) — the domain must be Cloudflare-proxied (orange cloud)
with SSL/TLS mode **Full (strict)**.

> Replace placeholders: `<REPO_URL>`, `<VPS_IP>`, and the secrets in step 3.

---

## 0. Cloudflare DNS (dashboard or API, one-time)
- Add an **A record**: `6gate-api` → `<VPS_IP>`, **Proxy status: Proxied** (orange cloud).
  Single-level subdomain so Cloudflare's free `*.minfect.com` SSL covers the edge cert.
- SSL/TLS → Overview → set mode to **Full (strict)**.
- SSL/TLS → **Origin Server** → **Create Certificate** with hostnames `minfect.com`
  and `*.minfect.com` (the wildcard covers `6gate-api.minfect.com` and every other
  app on this box). Save it once on the VPS as a **shared** cert:
  ```bash
  sudo mkdir -p /etc/nginx/ssl
  sudo tee /etc/nginx/ssl/minfect.com.pem >/dev/null   # paste Origin Certificate, Ctrl-D
  sudo tee /etc/nginx/ssl/minfect.com.key >/dev/null   # paste Private Key, Ctrl-D
  sudo chmod 600 /etc/nginx/ssl/minfect.com.key
  ```
  The nginx conf points `ssl_certificate` at this shared file — if it already exists
  (other sites use it), skip this.

Verify DNS resolves (Cloudflare IP is expected, since it's proxied):
```bash
dig +short 6gate-api.minfect.com
```

---

## 1. Get the code

## 2. Node + pm2 (skip anything already installed)
```bash
node -v || curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs
sudo npm i -g pm2
```

## 3. Secrets — create app/.env
```bash
cat > ~/6gate/app/.env <<'EOF'
SYSTEM_SECRET=<your-login-secret>
ENCRYPTION_KEY=<your-encryption-key>
DATABASE_URL=postgresql://minfect:<db-password>@postgre.minfect.com:5432/sixgate
DATABASE_SSL=require
EOF
chmod 600 ~/6gate/app/.env
```
> - `SYSTEM_SECRET` — what you log in with (also signs JWT sessions and the
>   `x-system-secret` header). Rotate it freely; it only invalidates sessions.
> - `ENCRYPTION_KEY` — **must equal the original value** used when the storage token
>   was encrypted, or the migrated Postgres token won't decrypt. Don't rotate it.

## 4. Build + start with pm2
```bash
cd ~/6gate/app
npm ci                         # if better-sqlite3 tries to compile:
                               #   sudo apt-get install -y build-essential python3
npm run build                  # -> dist/main.js (runs Postgres migrations on boot)
pm2 start ecosystem.config.js
pm2 save
pm2 startup                    # run the command it prints (enables boot persistence)
```
Smoke-test locally (the API listens on 127.0.0.1:20130):
```bash
pm2 logs 6gate-api --lines 30
SECRET=$(grep SYSTEM_SECRET ~/6gate/app/.env | cut -d= -f2)
curl -s -H "x-system-secret: $SECRET" http://127.0.0.1:20130/api/providers | head -c 200; echo
```

## 6. nginx site
```bash
sudo cp ~/6gate/deploy/nginx/6gate-api.minfect.com.conf \
        /etc/nginx/sites-available/6gate-api.minfect.com
sudo ln -sf /etc/nginx/sites-available/6gate-api.minfect.com \
            /etc/nginx/sites-enabled/6gate-api.minfect.com
sudo nginx -t && sudo systemctl reload nginx
```

## 7. Firewall (expose only 80/443; keep 20130 private)
```bash
sudo ufw allow 'Nginx Full' 2>/dev/null || true
sudo ufw deny 20130 2>/dev/null || true
```

## 8. Verify end-to-end (through Cloudflare)
```bash
SECRET=$(grep SYSTEM_SECRET ~/6gate/app/.env | cut -d= -f2)
curl -s https://6gate-api.minfect.com/api/providers -H "x-system-secret: $SECRET" | head -c 200; echo
```
Expect a JSON array of providers.

---

## Redeploy later (manual)
```bash
cd ~/6Gate && git pull && cd app
npm ci && npm run build
pm2 reload 6gate-api
```

## Continuous deploy (GitHub Actions → SSH, password auth)
On every push to `main` that touches `app/**`, a GitHub-hosted runner SSHes into the VPS
(`sshpass` password auth) and runs [deploy/remote-deploy.sh](remote-deploy.sh)
(pull → build → `pm2 reload`). See
[.github/workflows/deploy-api.yml](../.github/workflows/deploy-api.yml). `app/.env` is
gitignored, so the pull never touches it.

**One-time setup:**

1. Make sure the VPS allows password SSH for this user — in `/etc/ssh/sshd_config`:
   ```
   PasswordAuthentication yes
   PermitRootLogin yes        # only if deploying as root
   ```
   then `sudo systemctl restart ssh`.
2. GitHub → repo **Settings → Secrets and variables → Actions → New repository secret**:
   | Secret | Value |
   |--------|-------|
   | `VPS_HOST` | your VPS IP (e.g. `116.118.9.84`) |
   | `VPS_USER` | `root` |
   | `VPS_PASSWORD` | the SSH password for that user |
   | `VPS_PORT` | optional, only if SSH isn't on 22 |

3. `node`/`npm`/`pm2` resolution in a non-interactive SSH shell is handled by
   `remote-deploy.sh` (adds `/usr/local/bin` + sources nvm if present).

**Test it:** push any change under `app/` → **Actions** tab → "Deploy API (SSH)" runs and
the API reloads.

> Security: password auth + root is the weakest option (brute-forceable, password lives
> in CI). Prefer an SSH key and/or a non-root deploy user when you can. Rotate the
> password if it's ever exposed.

## Notes
- **1 pm2 instance only** (set in `ecosystem.config.js`) — the job runner + SSE keep
  in-memory state; cluster mode would break live logs and duplicate the dispatcher.
- **Cloudflare upload cap**: 100 MB per request on Free/Pro. Video uploads larger than
  that won't pass through the proxied hostname. If needed, add a second **DNS-only**
  (grey-cloud) subdomain pointing at the VPS for large uploads (and request a real cert
  for it, since the Origin cert is only trusted by Cloudflare).
- Optional hardening: enable Cloudflare **Authenticated Origin Pulls** so nginx only
  accepts connections coming from Cloudflare.
