# Deployment Guide

Production deployment with Docker Swarm and GitHub Actions.

---

## Quick Deploy

```bash
# 1. Setup GitHub secrets
# 2. Push to branch
git push origin main      # → Production
git push origin develop   # → Staging

# Auto-deploys via GitHub Actions!
```

---

## Manual Deployment

### Prerequisites

- PostgreSQL (managed)
- Redis (managed)
- Docker Swarm server

### Steps

```bash
# 1. Build images
docker build -t myapp-api .
docker build -f Dockerfile.worker -t myapp-worker .
docker build -f Dockerfile.ffmpeg -t myapp-worker-ffmpeg .

# 2. Run migrations
DATABASE_URL="..." npx prisma migrate deploy

# 3. Deploy stack
docker stack deploy -c swarm.production.yml myapp-production
```

---

## Environments

### Staging

**Branch:** `develop`  
**Stack:** `myapp-staging`  
**Config:** `swarm.staging.yml`  
**Features:** Swagger enabled, debug logs

### Production

**Branch:** `main`  
**Stack:** `myapp-production`  
**Config:** `swarm.production.yml`  
**Features:** Swagger disabled, minimal logs

---

## Scaling

```bash
# Presets
./scripts/scale.sh minimal production     # Low traffic
./scripts/scale.sh normal production      # Standard
./scripts/scale.sh high-load production   # Traffic spike

# Manual
docker service scale myapp-production_api=5
docker service scale myapp-production_worker-io=10
```

---

## Monitoring

```bash
# Services
docker service ls

# Logs
docker service logs -f myapp-production_api

# Queues
./scripts/check-queues.sh $REDIS_URL

# Health
curl https://api.yourapp.com/health
```

---

## Secrets

### GitHub Secrets (Required)

```
DATABASE_URL_STAGING
DATABASE_URL_PRODUCTION
REDIS_URL_STAGING  
REDIS_URL_PRODUCTION
JWT_SECRET_STAGING
JWT_SECRET_PRODUCTION
DEPLOY_HOST_STAGING
DEPLOY_HOST_PRODUCTION
DEPLOY_USER
DEPLOY_SSH_KEY
API_URL_STAGING
API_URL_PRODUCTION
```

### Docker Secrets (Alternative)

```yaml
secrets:
  jwt_secret:
    external: true
  database_url:
    external: true

services:
  api:
    secrets:
      - jwt_secret
      - database_url
```

---

## Rollback

```bash
# Auto-rollback on health check failure (GitHub Actions)

# Manual rollback
docker service update --rollback myapp-production_api
```

---

## Multi-Server Setup

```bash
# Manager node
docker swarm init

# Worker nodes
docker swarm join --token TOKEN manager-ip:2377

# Label nodes
docker node update --label-add worker-type=io node2
docker node update --label-add worker-type=ffmpeg node3

# Deploy - workers auto-distribute!
docker stack deploy -c swarm.production.yml myapp-production
```

---

## Security Checklist

- [ ] Strong JWT_SECRET (64+ chars)
- [ ] CORS restricted (not *)
- [ ] Swagger disabled in production
- [ ] Database SSL enabled
- [ ] Rate limiting enabled
- [ ] Secrets in environment (not hardcoded)

---

**Full guide:** [See QUICK_DEPLOY.md](../QUICK_DEPLOY.md)
