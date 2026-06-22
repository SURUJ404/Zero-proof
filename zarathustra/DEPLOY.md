# Zarathustra Web IDE — Production Deployment

## Option 1: Docker (Recommended)

```bash
# Build and start
docker compose -f web/docker-compose.yml up -d

# Check logs
docker compose -f web/docker-compose.yml logs -f

# Stop
docker compose -f web/docker-compose.yml down
```

## Option 2: PM2 Process Manager

```bash
# Install PM2 globally
npm install -g pm2

# Start
pm2 start web/ecosystem.config.js

# Monitor
pm2 monit
pm2 logs zarathustra

# Save for auto-restart on reboot
pm2 save
pm2 startup
```

## Option 3: Systemd Service

```bash
# Copy files to /opt
sudo mkdir -p /opt/zarathustra
sudo cp -r ../zarathustra /opt/zarathustra/
sudo chown -R zarathustra:zarathustra /opt/zarathustra

# Install service
sudo cp web/zarathustra.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable zarathustra
sudo systemctl start zarathustra

# Check status
sudo systemctl status zarathustra
```

## Verification

```bash
curl http://localhost:4000/api/health
# {"status":"ok","zarathustra":true,"stdlib":true}

curl -X POST http://localhost:4000/api/compile \
  -H 'Content-Type: application/json' \
  -d '{"code":"def main() { return 1; }","curve":"bn128"}'
```
