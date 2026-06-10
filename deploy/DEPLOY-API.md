# Deploy the 6Gate API to the VPS (pm2 + nginx + Cloudflare Origin TLS)

Copy-paste CLI. Run on the **VPS** unless noted. TLS uses a **Cloudflare Origin
Certificate** (no certbot) — the domain must be Cloudflare-proxied (orange cloud)
with SSL/TLS mode **Full (strict)**.

> Replace placeholders: `<REPO_URL>`, `<VPS_IP>`, and the secrets in step 3.

---

## 0. Cloudflare DNS (dashboard or API, one-time)
- Add an **A record**: `api` → `<VPS_IP>`, **Proxy status: Proxied** (orange cloud).
- SSL/TLS → Overview → set mode to **Full (strict)**.
- SSL/TLS → **Origin Server** → **Create Certificate** (default RSA, covers
  `api.6gate.minfect.com`). Copy the **Origin Certificate** and **Private Key** —
  you'll paste them in step 5.

Verify DNS resolves (Cloudflare IP is expected, since it's proxied):
```bash
dig +short api.6gate.minfect.com
```

---

## 1. Get the code
```bash
cd ~
git clone <REPO_URL> 6gate     # or: cd ~/6gate && git pull
cd ~/6gate/app
```

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

## 5. Install the Cloudflare Origin certificate
```bash
sudo mkdir -p /etc/ssl/cloudflare

# Paste the Origin CERTIFICATE (the cert block), save & exit:
sudo tee /etc/ssl/cloudflare/api.6gate.minfect.com.pem >/dev/null <<'EOF'
-----BEGIN CERTIFICATE-----
... paste Cloudflare Origin Certificate here ...
-----END CERTIFICATE-----
EOF

# Paste the Origin PRIVATE KEY, save & exit:
sudo tee /etc/ssl/cloudflare/api.6gate.minfect.com.key >/dev/null <<'EOF'
-----BEGIN PRIVATE KEY-----
... paste Cloudflare Origin Private Key here ...
-----END PRIVATE KEY-----
EOF

sudo chmod 600 /etc/ssl/cloudflare/api.6gate.minfect.com.key
```

## 6. nginx site
```bash
sudo cp ~/6gate/deploy/nginx/api.6gate.minfect.com.conf \
        /etc/nginx/sites-available/api.6gate.minfect.com
sudo ln -sf /etc/nginx/sites-available/api.6gate.minfect.com \
            /etc/nginx/sites-enabled/api.6gate.minfect.com
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
curl -s https://api.6gate.minfect.com/api/providers -H "x-system-secret: $SECRET" | head -c 200; echo
```
Expect a JSON array of providers.

---

## Redeploy later
```bash
cd ~/6gate && git pull && cd app
npm ci && npm run build
pm2 reload 6gate-api
```

## Notes
- **1 pm2 instance only** (set in `ecosystem.config.js`) — the job runner + SSE keep
  in-memory state; cluster mode would break live logs and duplicate the dispatcher.
- **Cloudflare upload cap**: 100 MB per request on Free/Pro. Video uploads larger than
  that won't pass through the proxied hostname. If needed, add a second **DNS-only**
  (grey-cloud) subdomain pointing at the VPS for large uploads (and request a real cert
  for it, since the Origin cert is only trusted by Cloudflare).
- Optional hardening: enable Cloudflare **Authenticated Origin Pulls** so nginx only
  accepts connections coming from Cloudflare.
