# Production Deployment Guide

Complete guide for deploying API and Worker services to production with external databases.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Environment Configuration](#environment-configuration)
- [Deployment Options](#deployment-options)
- [Security Checklist](#security-checklist)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)

---

## Architecture Overview

### Production Setup

```
┌─────────────────────────────────────────────────────┐
│                  Load Balancer                       │
│              (nginx, AWS ALB, etc.)                  │
└────────────────────┬────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
    ┌────▼────┐            ┌────▼────┐
    │ API #1  │            │ API #2  │
    │ (Docker)│            │ (Docker)│
    └────┬────┘            └────┬────┘
         │                       │
         └───────────┬───────────┘
                     │
         ┌───────────▼───────────┐
         │                       │
    ┌────▼────┐            ┌────▼────┐
    │ Worker  │            │ Worker  │
    │  #1-5   │            │  #6-10  │
    │ (Docker)│            │ (Docker)│
    └────┬────┘            └────┬────┘
         │                       │
         └───────────┬───────────┘
                     │
         ┌───────────▼───────────────────┐
         │                               │
    ┌────▼─────┐                  ┌─────▼────┐
    │PostgreSQL│                  │  Redis   │
    │ (External│                  │(External)│
    │Managed)  │                  │Managed)  │
    └──────────┘                  └──────────┘
```

### Key Principles

1. **API and Workers are separate** - Scale independently
2. **PostgreSQL is external** - Managed service (AWS RDS, DigitalOcean, etc.)
3. **Redis is external** - Managed service (ElastiCache, Redis Cloud, etc.)
4. **Stateless services** - Can scale horizontally
5. **Shared configuration** - Same DATABASE_URL and REDIS_URL

---

## Prerequisites

### 1. External Services

**PostgreSQL (Managed Database):**
- AWS RDS PostgreSQL
- DigitalOcean Managed PostgreSQL
- Supabase
- Neon
- Any PostgreSQL 12+

**Redis (Managed Cache):**
- AWS ElastiCache
- Redis Cloud
- DigitalOcean Managed Redis
- Upstash
- Any Redis 6+

### 2. Environment Setup

Create `.env.production` file:

```bash
# Copy example
cp .env.example .env.production

# Edit with your production values
nano .env.production
```

**Critical values to set:**
```bash
DATABASE_URL=postgresql://user:pass@external-db-host:5432/production_db
REDIS_URL=redis://default:pass@external-redis-host:6379
JWT_SECRET=<generate-with-openssl-rand-base64-64>
CORS_ORIGIN=https://yourapp.com
```

### 3. Build Application

```bash
npm run build
```

---

## Deployment Options

### Option 1: Separate API + Workers (Recommended)

**Best for:** Production with independent scaling

#### Deploy API

```bash
# Build API image
docker build -t myapp-api:latest .

# Run API instances
docker compose -f docker-compose.prod.api.yml up -d

# Scale API (3 instances)
docker compose -f docker-compose.prod.api.yml up -d --scale api=3
```

#### Deploy Workers

```bash
# Build Worker image
docker build -f Dockerfile.worker -t myapp-worker:latest .

# Run worker instances
docker compose -f docker-compose.prod.worker.yml up -d

# Scale workers (5 instances)
docker compose -f docker-compose.prod.worker.yml up -d --scale worker=5
```

**Environment variables (in .env):**
```bash
# For API
MODE=api
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=...
CORS_ORIGIN=https://yourapp.com

# For Workers
MODE=worker
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
QUEUE_CONCURRENCY=10
```

---

### Option 2: All-in-One (MVP/Small Projects)

**Best for:** Simple deployments, low traffic

```bash
# Run API + Workers in one container
docker compose -f docker-compose.prod.yml up -d
```

**Environment:**
```bash
MODE=all  # Both API and workers
```

---

### Option 3: Cloud Platform

#### AWS (ECS + RDS + ElastiCache)

**1. Create managed services:**
```bash
# PostgreSQL (RDS)
aws rds create-db-instance \
  --db-instance-identifier myapp-db \
  --engine postgres \
  --engine-version 16.1 \
  --db-instance-class db.t3.micro \
  --allocated-storage 20

# Redis (ElastiCache)
aws elasticache create-cache-cluster \
  --cache-cluster-id myapp-redis \
  --engine redis \
  --cache-node-type cache.t3.micro \
  --num-cache-nodes 1
```

**2. Deploy containers (ECS):**
```bash
# Build and push to ECR
docker build -t myapp-api .
docker tag myapp-api:latest {aws-account}.dkr.ecr.{region}.amazonaws.com/myapp-api:latest
docker push {aws-account}.dkr.ecr.{region}.amazonaws.com/myapp-api:latest

# Create ECS task definition
aws ecs register-task-definition --cli-input-json file://task-definition.json

# Create ECS service
aws ecs create-service \
  --cluster myapp-cluster \
  --service-name api \
  --task-definition myapp-api \
  --desired-count 3
```

**3. Workers:**
```bash
# Same steps but with Dockerfile.worker
# Set desired-count to number of workers needed
```

#### DigitalOcean (App Platform + Managed DB)

**1. Create managed services:**
- Create Managed PostgreSQL database
- Create Managed Redis database

**2. Deploy via App Spec:**

```yaml
# app-spec.yaml
name: myapp
services:
  # API Service
  - name: api
    dockerfile_path: Dockerfile
    source_dir: /
    envs:
      - key: MODE
        value: "api"
      - key: DATABASE_URL
        value: ${db.DATABASE_URL}
      - key: REDIS_URL
        value: ${redis.REDIS_URL}
      - key: JWT_SECRET
        value: ${JWT_SECRET}
        type: SECRET
    instance_count: 3
    instance_size_slug: basic-xs
    http_port: 3000
    health_check:
      http_path: /health

  # Worker Service
  - name: worker
    dockerfile_path: Dockerfile.worker
    source_dir: /
    envs:
      - key: MODE
        value: "worker"
      - key: DATABASE_URL
        value: ${db.DATABASE_URL}
      - key: REDIS_URL
        value: ${redis.REDIS_URL}
      - key: QUEUE_CONCURRENCY
        value: "10"
    instance_count: 5
    instance_size_slug: basic-sm
```

```bash
doctl apps create --spec app-spec.yaml
```

#### Railway / Render / Fly.io

Similar approach:
1. Create PostgreSQL and Redis add-ons
2. Deploy API service with `MODE=api`
3. Deploy Worker service with `MODE=worker`
4. Set environment variables

---

## Environment Configuration

### Production .env File

Create `.env.production`:

```bash
# ==============================================
# External Services
# ==============================================
DATABASE_URL=postgresql://user:pass@db-host.region.provider.com:5432/production_db?sslmode=require
REDIS_URL=redis://default:pass@redis-host.region.provider.com:6379

# ==============================================
# Security
# ==============================================
JWT_SECRET=<generated-with-openssl-rand-base64-64>
CORS_ORIGIN=https://app.example.com,https://admin.example.com

# ==============================================
# Service Mode
# ==============================================
MODE=api              # For API service
# MODE=worker         # For Worker service

# ==============================================
# Queue Settings (for workers)
# ==============================================
QUEUE_CONCURRENCY=10
QUEUE_REMOVE_ON_COMPLETE=100
QUEUE_REMOVE_ON_FAIL=1000

# ==============================================
# External APIs
# ==============================================
REPLICATE_API_KEY=r8_xxxxx
OPENAI_API_KEY=sk-xxxxx
```

### Secrets Management

**Don't hardcode secrets!** Use:

**AWS Secrets Manager:**
```bash
aws secretsmanager create-secret \
  --name myapp/jwt-secret \
  --secret-string "$(openssl rand -base64 64)"
```

**Docker Secrets:**
```yaml
services:
  api:
    secrets:
      - jwt_secret
      - database_url
    environment:
      JWT_SECRET_FILE: /run/secrets/jwt_secret

secrets:
  jwt_secret:
    external: true
  database_url:
    external: true
```

**Kubernetes Secrets:**
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
type: Opaque
data:
  jwt-secret: <base64-encoded>
  database-url: <base64-encoded>
```

---

## Scaling Strategy

### API Scaling

**Horizontal scaling** based on CPU/Memory:

```bash
# Docker Compose
docker compose -f docker-compose.prod.api.yml up -d --scale api=5

# Kubernetes
kubectl scale deployment api --replicas=5

# Auto-scaling (Kubernetes HPA)
kubectl autoscale deployment api --min=2 --max=10 --cpu-percent=70
```

**Metrics to watch:**
- CPU usage > 70% → scale up
- Memory usage > 80% → scale up
- Request latency > 500ms → scale up
- Request rate > 100 req/s per instance → scale up

### Worker Scaling

**Horizontal scaling** based on queue length:

```bash
# Docker Compose
docker compose -f docker-compose.prod.worker.yml up -d --scale worker=10

# Based on queue metrics
# If queue length > 100 → add workers
# If queue length < 10 → remove workers
```

**Metrics to watch:**
- Queue length > 100 → scale up
- Queue wait time > 60s → scale up
- Worker CPU > 80% → scale up
- Failed jobs increasing → investigate, then scale

---

## Security Checklist

### Before Production

- [ ] **Generate strong JWT_SECRET** (64+ chars, high entropy)
- [ ] **Set specific CORS_ORIGIN** (never use `*` in production)
- [ ] **Disable Swagger** (`ENABLE_SWAGGER=false`)
- [ ] **Enable rate limiting** (`ENABLE_RATE_LIMIT=true`)
- [ ] **Use SSL/TLS** for database and Redis connections
- [ ] **Set up firewall rules** (only allow necessary traffic)
- [ ] **Use non-root Docker user** (already configured in Dockerfile)
- [ ] **Enable security headers** (Helmet - already configured)
- [ ] **Validate all environment variables** (Config validation - done)
- [ ] **Set up monitoring** (logs, metrics, alerts)
- [ ] **Configure backup strategy** (database, Redis if needed)
- [ ] **Test disaster recovery** (restore from backup)

### Environment Variables Security

```bash
# ❌ BAD - Hardcoded in Dockerfile
ENV JWT_SECRET=my-secret

# ✅ GOOD - From environment
ENV JWT_SECRET=${JWT_SECRET}

# ✅ BETTER - From secrets manager
ENV JWT_SECRET_FILE=/run/secrets/jwt_secret
```

---

## Docker Commands

### Build

```bash
# API image
docker build -t myapp-api:latest .

# Worker image
docker build -f Dockerfile.worker -t myapp-worker:latest .

# With specific tag
docker build -t myapp-api:v1.2.3 .
```

### Run

```bash
# API with external services
docker run -d \
  --name api \
  -p 3000:3000 \
  -e MODE=api \
  -e DATABASE_URL="postgresql://..." \
  -e REDIS_URL="redis://..." \
  -e JWT_SECRET="..." \
  myapp-api:latest

# Worker with external services
docker run -d \
  --name worker \
  -e MODE=worker \
  -e DATABASE_URL="postgresql://..." \
  -e REDIS_URL="redis://..." \
  -e QUEUE_CONCURRENCY=10 \
  myapp-worker:latest
```

### Docker Compose

```bash
# All-in-one (API + Workers)
docker compose -f docker-compose.prod.yml up -d

# API only
docker compose -f docker-compose.prod.api.yml up -d

# Workers only
docker compose -f docker-compose.prod.worker.yml up -d

# Scale API
docker compose -f docker-compose.prod.api.yml up -d --scale api=3

# Scale Workers
docker compose -f docker-compose.prod.worker.yml up -d --scale worker=5

# View logs
docker compose -f docker-compose.prod.api.yml logs -f api
docker compose -f docker-compose.prod.worker.yml logs -f worker

# Stop services
docker compose -f docker-compose.prod.api.yml down
docker compose -f docker-compose.prod.worker.yml down
```

---

## Monitoring

### Health Checks

**API Health:**
```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "healthy",
  "services": {
    "database": "available",
    "redis": "available"
  }
}
```

**Worker Health:**
```bash
# Workers don't expose HTTP, monitor via:
# - Redis queue metrics
# - Docker health checks
# - Application logs
```

### Logs

```bash
# Docker logs
docker logs api -f
docker logs worker -f

# Docker Compose logs
docker compose -f docker-compose.prod.api.yml logs -f
docker compose -f docker-compose.prod.worker.yml logs -f

# Filter errors only
docker logs worker 2>&1 | grep ERROR
```

### Metrics

**Queue Metrics (Redis):**
```bash
# Queue length
redis-cli -u $REDIS_URL LLEN "bull:webhook-processor:wait"

# Failed jobs
redis-cli -u $REDIS_URL LLEN "bull:webhook-processor:failed"

# Active jobs
redis-cli -u $REDIS_URL LLEN "bull:webhook-processor:active"
```

**Application Metrics:**
- Enable Prometheus: `ENABLE_METRICS=true`
- Access: `http://localhost:3000/metrics`
- Scrape with Prometheus/Datadog/New Relic

---

## Database Migrations

**Run migrations before deploying:**

```bash
# Option 1: Run locally (if you have access)
DATABASE_URL="postgresql://..." npm run prisma:migrate

# Option 2: Run in temporary container
docker run --rm \
  -e DATABASE_URL="postgresql://..." \
  myapp-api:latest \
  npx prisma migrate deploy

# Option 3: Init container (Kubernetes)
# See k8s-init-job.yaml example below
```

### Kubernetes Init Job

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: db-migrate
spec:
  template:
    spec:
      restartPolicy: Never
      containers:
      - name: migrate
        image: myapp-api:latest
        command: ["npx", "prisma", "migrate", "deploy"]
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: database-url
```

---

## Example: AWS Deployment

### Prerequisites

```bash
# 1. Create RDS PostgreSQL
DATABASE_URL=postgresql://user:pass@myapp.xxxxx.us-east-1.rds.amazonaws.com:5432/production

# 2. Create ElastiCache Redis
REDIS_URL=redis://myapp.xxxxx.cache.amazonaws.com:6379

# 3. Create ECR repositories
aws ecr create-repository --repository-name myapp-api
aws ecr create-repository --repository-name myapp-worker
```

### Build & Push Images

```bash
# Login to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin {account}.dkr.ecr.us-east-1.amazonaws.com

# Build and push API
docker build -t myapp-api:latest .
docker tag myapp-api:latest {account}.dkr.ecr.us-east-1.amazonaws.com/myapp-api:latest
docker push {account}.dkr.ecr.us-east-1.amazonaws.com/myapp-api:latest

# Build and push Worker
docker build -f Dockerfile.worker -t myapp-worker:latest .
docker tag myapp-worker:latest {account}.dkr.ecr.us-east-1.amazonaws.com/myapp-worker:latest
docker push {account}.dkr.ecr.us-east-1.amazonaws.com/myapp-worker:latest
```

### Deploy to ECS

```bash
# Create cluster
aws ecs create-cluster --cluster-name myapp-production

# Register task definitions
aws ecs register-task-definition --cli-input-json file://ecs-api-task.json
aws ecs register-task-definition --cli-input-json file://ecs-worker-task.json

# Create services
aws ecs create-service \
  --cluster myapp-production \
  --service-name api \
  --task-definition myapp-api \
  --desired-count 3 \
  --launch-type FARGATE

aws ecs create-service \
  --cluster myapp-production \
  --service-name worker \
  --task-definition myapp-worker \
  --desired-count 5 \
  --launch-type FARGATE
```

---

## Example: DigitalOcean Deployment

### Prerequisites

```bash
# 1. Create Managed PostgreSQL
doctl databases create myapp-db --engine pg --region nyc1

# 2. Create Managed Redis
doctl databases create myapp-redis --engine redis --region nyc1

# 3. Get connection strings
doctl databases connection myapp-db
doctl databases connection myapp-redis
```

### Deploy with Docker

```bash
# 1. Create Droplet (or use existing)
doctl compute droplet create worker-01 \
  --size s-2vcpu-4gb \
  --image docker-20-04 \
  --region nyc1

# 2. SSH to droplet
doctl compute ssh worker-01

# 3. Clone repo and deploy
git clone <your-repo>
cd ts-service-template

# 4. Set environment variables
export DATABASE_URL="postgresql://..."
export REDIS_URL="redis://..."
export JWT_SECRET="$(openssl rand -base64 64)"

# 5. Deploy
docker compose -f docker-compose.prod.worker.yml up -d --scale worker=5
```

---

## Security Checklist

### Pre-Deployment

- [ ] Strong JWT_SECRET (64+ chars)
- [ ] CORS restricted to specific domains
- [ ] Swagger disabled (`ENABLE_SWAGGER=false`)
- [ ] SSL/TLS for DB and Redis
- [ ] Rate limiting enabled
- [ ] No default passwords
- [ ] Environment variables via secrets
- [ ] Docker images scanned for vulnerabilities

### Post-Deployment

- [ ] Monitor error logs
- [ ] Set up alerts (failed jobs, errors)
- [ ] Configure backups
- [ ] Test health checks
- [ ] Verify rate limiting works
- [ ] Test authentication flow
- [ ] Monitor resource usage

---

## Troubleshooting

### API won't connect to external DB

```bash
# Test connection
psql "$DATABASE_URL" -c "SELECT 1"

# Check firewall rules
# - API server IP must be whitelisted in DB security group
# - Port 5432 must be open

# Check SSL requirement
# Add ?sslmode=require to DATABASE_URL if needed
```

### Workers not processing jobs

```bash
# Check Redis connection
redis-cli -u "$REDIS_URL" ping

# Check queue exists
redis-cli -u "$REDIS_URL" KEYS "bull:*"

# Check worker logs
docker logs worker -f

# Verify MODE is set
docker inspect worker | grep MODE
```

### High latency

1. **Database:** Use connection pooling (already configured in Prisma)
2. **Redis:** Use Redis cluster or read replicas
3. **API:** Add caching layer (Redis)
4. **Workers:** Increase concurrency or scale horizontally

---

## Rollback Strategy

### Quick Rollback

```bash
# API rollback
docker compose -f docker-compose.prod.api.yml down
docker pull myapp-api:previous-version
docker compose -f docker-compose.prod.api.yml up -d

# Worker rollback
docker compose -f docker-compose.prod.worker.yml down
docker pull myapp-worker:previous-version
docker compose -f docker-compose.prod.worker.yml up -d
```

### Database Rollback

```bash
# Restore from backup
pg_restore -d $DATABASE_URL backup.sql

# Or use Prisma migrate
npx prisma migrate resolve --rolled-back <migration-name>
```

---

## Performance Optimization

### API Optimization

1. **Enable HTTP/2** (nginx/load balancer)
2. **Use CDN** for static assets
3. **Enable gzip compression** (nginx)
4. **Cache responses** (Redis)
5. **Connection pooling** (Prisma - already configured)

### Worker Optimization

1. **Adjust concurrency** based on job type
   - CPU-heavy: `QUEUE_CONCURRENCY=2`
   - I/O-heavy: `QUEUE_CONCURRENCY=20`
2. **Scale horizontally** (more workers)
3. **Optimize job processors** (reduce API calls, batch operations)
4. **Use job priorities** (urgent jobs first)

---

## Backup Strategy

### Database Backups

```bash
# Automated daily backups
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# Upload to S3
aws s3 cp backup-$(date +%Y%m%d).sql s3://mybucket/backups/
```

### Redis Backups

```bash
# Redis Cloud / ElastiCache have automatic backups

# Manual backup (if self-hosted)
redis-cli -u $REDIS_URL BGSAVE
```

---

## Next Steps

- 📖 Read [API.md](./API.md) for API service details
- ⚙️ Read [WORKER.md](./WORKER.md) for worker service details
- 🔍 Set up monitoring (Datadog, New Relic, Sentry)
- 📊 Configure alerts (PagerDuty, Slack)
- 🔒 Regular security audits
- 📈 Load testing

---

**Questions?** Check [README](../README.md) or open an issue!
