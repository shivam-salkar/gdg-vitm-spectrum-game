# DigitalOcean VPS Deployment Guide

This guide explains how to deploy the Spectrum Game server on a DigitalOcean
Droplet and keep it running efficiently under concurrent player load.

---

## Architecture overview

```
Browser clients
     │  HTTPS + WebSocket
     ▼
  Nginx (reverse proxy, SSL, static files, gzip)
     │  HTTP proxy_pass + WebSocket upgrade
     ▼
  Node.js / Express + socket.io  (PM2 managed)
     │  optional pub/sub
     ▼
  Redis  (only needed for multi-process cluster mode)
```

---

## 1 – Provision a Droplet

| VPS size          | Recommended for              |
|-------------------|------------------------------|
| Basic 1 vCPU 1 GB | Development / low traffic    |
| Basic 2 vCPU 2 GB | Up to ~200 concurrent users  |
| CPU-Opt 4 vCPU    | 200 + users, cluster mode    |

Create an **Ubuntu 22.04 LTS** Droplet and add your SSH key.

---

## 2 – Install dependencies on the Droplet

```bash
# Node.js 20 LTS via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# PM2 (process manager)
sudo npm install -g pm2

# Nginx
sudo apt-get install -y nginx

# Redis (optional – only needed for cluster mode)
sudo apt-get install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server
```

---

## 3 – Clone and configure the project

```bash
git clone https://github.com/GDGVITM/spectrum-game.git
cd spectrum-game

# Install server dependencies
cd server && npm install && cd ..

# Install frontend dependencies and build
npm install
npm run build   # produces dist/
```

---

## 4 – Environment variables

```bash
cp .env.example server/.env
nano server/.env   # fill in PORT, CORS_ORIGIN, NIMDA_PASSWORD, etc.
```

Key variables to change before going live:

| Variable            | What to set                                      |
|---------------------|--------------------------------------------------|
| `CORS_ORIGIN`       | Your domain, e.g. `https://game.example.com`     |
| `NIMDA_PASSWORD`    | A strong random string                           |
| `REDIS_URL`         | `redis://127.0.0.1:6379` (cluster mode only)     |

---

## 5 – Start the server with PM2

```bash
# Single-process mode (no Redis needed)
pm2 start ecosystem.config.cjs

# Check it's running
pm2 list
pm2 logs

# Persist process list so it survives reboots
pm2 save
pm2 startup   # follow the printed command to enable the systemd unit
```

### Cluster mode (multi-core, requires Redis)

```bash
export REDIS_URL=redis://127.0.0.1:6379
pm2 start ecosystem.config.cjs
```

PM2 will spawn one worker per CPU core.  The Redis adapter keeps all workers
in sync so socket.io rooms work correctly across processes.

---

## 6 – Nginx reverse proxy

```bash
sudo cp nginx.conf /etc/nginx/sites-available/spectrum-game

# Edit the file: replace YOUR_DOMAIN with your actual domain
sudo nano /etc/nginx/sites-available/spectrum-game

# Enable the site
sudo ln -s /etc/nginx/sites-available/spectrum-game \
           /etc/nginx/sites-enabled/spectrum-game
sudo rm -f /etc/nginx/sites-enabled/default

sudo nginx -t            # verify syntax
sudo systemctl reload nginx
```

### Add HTTPS with Let's Encrypt

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d YOUR_DOMAIN
```

Certbot will automatically edit your Nginx config and schedule renewal.

---

## 7 – Serve the static frontend

Copy (or symlink) the Vite build output to the Nginx document root:

```bash
sudo mkdir -p /var/www/spectrum-game
sudo cp -r dist/* /var/www/spectrum-game/dist/
```

Or use a deploy script / CI/CD pipeline to do this on every build.

---

## 8 – Monitor and operate

| Task                          | Command                              |
|-------------------------------|--------------------------------------|
| View live logs                | `pm2 logs`                           |
| CPU / memory dashboard        | `pm2 monit`                          |
| Rolling restart (zero-down)   | `pm2 reload spectrum-game-server`    |
| Hard restart                  | `pm2 restart spectrum-game-server`   |
| Admin dashboard (browser)     | `https://YOUR_DOMAIN/nimda?password=…` |
| Health check                  | `curl https://YOUR_DOMAIN/health`    |
| Clear all sessions (soft)     | POST `/nimda/restart?password=…`     |

---

## 9 – Load-handling features in this branch

| Feature                          | Where                               |
|----------------------------------|-------------------------------------|
| Per-socket attack rate limiting  | `server/index.js` – `allowAttack()` |
| Idle session cleanup (30 min)    | `server/index.js` – cleanup interval|
| `/health` endpoint               | `server/index.js`                   |
| Graceful SIGTERM / SIGINT shutdown | `server/index.js`                 |
| Optional Redis adapter           | `server/index.js` (env-gated)       |
| PM2 ecosystem config             | `ecosystem.config.cjs`              |
| Nginx reverse proxy + gzip       | `nginx.conf`                        |

---

## 10 – Firewall (UFW)

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'   # ports 80 + 443
sudo ufw enable
sudo ufw status
```

Do **not** expose port 3000 directly to the internet – let Nginx handle all
external traffic.
