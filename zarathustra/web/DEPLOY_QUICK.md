# Quick Deploy — Zarathustra Web IDE

## Docker (Easiest)

```bash
docker compose up -d
# → http://localhost:4000
```

## PM2

```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save && pm2 startup
```

## Systemd

```bash
sudo cp zarathustra.service /etc/systemd/system/
sudo systemctl enable --now zarathustra
```

## Dev mode

```bash
npm start
# → http://localhost:4000
```
