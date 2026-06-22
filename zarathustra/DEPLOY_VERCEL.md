# Vercel + GitHub Deployment

## Architecture

```
GitHub ──push──► Vercel (static frontend)
                        │
                  Monaco Editor UI
                        │
                   fetch(API)
                        │
                        ▼
              Backend Server (VPS)
              ┌──────────────────┐
              │  zarathustra CLI │
              │  Node.js API     │
              └──────────────────┘
```

## Deploy Frontend to Vercel

### Option 1: Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy from the zarathustra/web directory
cd zarathustra/web
vercel --prod
```

### Option 2: GitHub Integration

1. Push the repo to GitHub
2. Go to [vercel.com](https://vercel.com) → Import GitHub repo
3. Set:
   - Root directory: `zarathustra/web`
   - Build command: (none — static)
   - Output directory: `public`
4. Deploy

### Option 3: GitHub Actions (auto-deploy)

Create `.github/workflows/deploy-vercel.yml`:

```yaml
name: Deploy Zarathustra to Vercel
on:
  push:
    branches: [main]
    paths:
      - 'zarathustra/web/**'
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          working-directory: zarathustra/web
          vercel-args: '--prod'
```

## Connect to Backend

The frontend connects to your backend API automatically (same origin in dev).

For production, set the API URL via:

1. **Query param:** `https://zarathustra.vercel.app?api=http://your-server:4000`
2. **Global JS var:** Set `window.ZARATHUSTRA_API = 'http://your-server:4000'` before loading the page

## Run Backend Server (VPS)

```bash
# On your VPS
git clone <your-repo>
cd zarathustra

# Start with PM2
npm install -g pm2
pm2 start web/ecosystem.config.js

# Or Docker
docker compose -f web/docker-compose.yml up -d

# Set up Nginx reverse proxy (optional)
```

### Nginx config example:
```nginx
server {
    listen 80;
    server_name zarathustra-api.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Host $host;
    }
}
```
