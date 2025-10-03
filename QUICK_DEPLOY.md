# Quick Deploy (30 Minutes)

From zero to production.

---

## Step 1: Clone & Push (5 min)

```bash
git clone <this-repo> my-service
cd my-service
git remote set-url origin git@github.com:youruser/my-service.git
git push -u origin main
```

---

## Step 2: Setup Databases (10 min)

**PostgreSQL:** [Supabase](https://supabase.com) (free) or [Neon](https://neon.tech)  
**Redis:** [Upstash](https://upstash.com) (free) or [Redis Cloud](https://redis.com)  
**Server:** [Hetzner](https://hetzner.com) (€5/month) or [DigitalOcean](https://digitalocean.com) ($12/month)

---

## Step 3: GitHub Secrets (10 min)

`Settings → Secrets → Actions` - add:

```
DATABASE_URL_STAGING=postgresql://...
DATABASE_URL_PRODUCTION=postgresql://...
REDIS_URL_STAGING=redis://...
REDIS_URL_PRODUCTION=redis://...
JWT_SECRET_STAGING=<openssl rand -base64 64>
JWT_SECRET_PRODUCTION=<openssl rand -base64 64>
DEPLOY_HOST_STAGING=ip-address
DEPLOY_HOST_PRODUCTION=ip-address
DEPLOY_USER=root
DEPLOY_SSH_KEY=<private-key>
API_URL_STAGING=https://staging.yourapp.com
API_URL_PRODUCTION=https://yourapp.com
```

---

## Step 4: Prepare Server (5 min)

```bash
ssh root@your-server

# Install Docker
curl -fsSL https://get.docker.com | sh

# Init Swarm
docker swarm init

# Create directory
mkdir -p /opt/myapp-production

# Copy config
exit
scp swarm.production.yml root@your-server:/opt/myapp-production/
```

---

## Step 5: Deploy!

```bash
git push origin main
```

Done! Check: https://api.yourapp.com/health

---

## Monitor

```
Queues:  https://api.yourapp.com/admin/queues
Metrics: https://api.yourapp.com/metrics  
Docs:    https://api.yourapp.com/docs (if ENABLE_SWAGGER=true)
```

---

## Scale

```bash
ssh root@your-server
./scripts/scale.sh high-load production
```

---

**Total time: 30 minutes** ⚡
