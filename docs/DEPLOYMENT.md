# Deployment Guide

Guide for deploying the TypeScript Service Template to production.

## Table of Contents

- [Building for Production](#building-for-production)
- [Environment Variables](#environment-variables)
- [Docker Deployment](#docker-deployment)
- [Security Checklist](#security-checklist)
- [Performance Optimization](#performance-optimization)
- [Monitoring](#monitoring)

## Building for Production

### 1. Build the Application

```bash
# Build TypeScript to JavaScript
npm run build

# Output will be in dist/ directory
```

### 2. Test Production Build

```bash
# Set production environment
export NODE_ENV=production
export DATABASE_URL="your-production-db-url"
export JWT_SECRET="$(openssl rand -base64 64)"

# Run the built application
npm start
```

## Environment Variables

### Required Variables

```bash
# Application
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Database (REQUIRED)
DATABASE_URL=postgresql://user:password@host:5432/database

# Security (REQUIRED)
JWT_SECRET=<64-char-random-string>
```

### Generate Secure JWT Secret

```bash
# Option 1: OpenSSL (recommended)
openssl rand -base64 64

# Option 2: Node.js
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"

# Option 3: Use secrets manager
# AWS Secrets Manager, HashiCorp Vault, etc.
```

### Optional Variables

```bash
# Redis (recommended for production)
REDIS_URL=redis://host:6379
REDIS_PASSWORD=your-redis-password

# CORS (set to your frontend domains)
CORS_ORIGIN=https://app.example.com,https://admin.example.com

# Rate limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_TIMEWINDOW=60000

# Feature flags
ENABLE_SWAGGER=false  # Disable in production for security
ENABLE_METRICS=true   # Enable for monitoring
ENABLE_RATE_LIMIT=true
```

## Docker Deployment

### Using Provided Dockerfile

```bash
# Build production image
docker build -t fastify-service:latest .

# Run container
docker run -d \
  --name fastify-service \
  -p 3000:3000 \
  --env-file .env.production \
  fastify-service:latest
```

### Multi-stage Build (Optimized)

The provided `Dockerfile` uses multi-stage builds:

- **Base** - Alpine Linux with Node.js 20
- **Dependencies** - Production dependencies only
- **Builder** - TypeScript compilation
- **Production** - Minimal runtime image (~150MB)

### Docker Compose (Production)

```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      target: production
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/prod_db
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: prod_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

## Cloud Platforms

### AWS ECS / Fargate

```bash
# 1. Build and push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com
docker build -t fastify-service .
docker tag fastify-service:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/fastify-service:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/fastify-service:latest

# 2. Deploy to ECS using task definition
aws ecs update-service --cluster <cluster> --service fastify-service --force-new-deployment
```

### Google Cloud Run

```bash
# 1. Build and push to GCR
gcloud builds submit --tag gcr.io/<project-id>/fastify-service

# 2. Deploy
gcloud run deploy fastify-service \
  --image gcr.io/<project-id>/fastify-service \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production \
  --set-secrets DATABASE_URL=db-url:latest,JWT_SECRET=jwt-secret:latest
```

### Heroku

```bash
# 1. Create Heroku app
heroku create fastify-service

# 2. Add PostgreSQL and Redis
heroku addons:create heroku-postgresql:hobby-dev
heroku addons:create heroku-redis:hobby-dev

# 3. Set environment variables
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=$(openssl rand -base64 64)

# 4. Deploy
git push heroku main

# 5. Run migrations
heroku run npm run prisma:migrate
```

### Railway

```bash
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Login and initialize
railway login
railway init

# 3. Add PostgreSQL and Redis
railway add postgresql
railway add redis

# 4. Deploy
railway up
```

## Security Checklist

Before deploying to production:

### ✅ Environment Variables

- [ ] Change `JWT_SECRET` to strong random value (64+ chars)
- [ ] Set `NODE_ENV=production`
- [ ] Configure `CORS_ORIGIN` to specific domains (not `*`)
- [ ] Set strong database password
- [ ] Set Redis password if used
- [ ] Disable Swagger (`ENABLE_SWAGGER=false`)

### ✅ Code Security

- [ ] Update all dependencies (`npm audit fix`)
- [ ] Enable HTTPS (use reverse proxy like Nginx)
- [ ] Enable rate limiting (`ENABLE_RATE_LIMIT=true`)
- [ ] Configure Helmet security headers
- [ ] Review and update CSP policies

### ✅ Infrastructure

- [ ] Use connection pooling (Prisma configured for 20 connections)
- [ ] Set up database backups
- [ ] Configure Redis persistence
- [ ] Set up monitoring and alerting
- [ ] Configure log aggregation

### ✅ Access Control

- [ ] Limit database access to application only
- [ ] Use VPC/private networks
- [ ] Enable firewall rules
- [ ] Use IAM roles (not hardcoded credentials)
- [ ] Rotate secrets regularly

## Performance Optimization

### 1. Database Optimization

```typescript
// Connection pooling (already configured)
// Production: 20 connections
// Development: 10 connections
```

### 2. Redis Caching

```bash
# Enable Redis in production
REDIS_URL=redis://your-redis-host:6379

# Configure Redis for optimal performance
REDIS_MAXMEMORY=256mb
REDIS_MAXMEMORY_POLICY=allkeys-lru
```

### 3. Response Compression

Add compression plugin:

```typescript
import compress from '@fastify/compress'

await fastify.register(compress, {
  global: true,
  threshold: 1024, // Compress responses > 1KB
})
```

### 4. Connection Keep-Alive

```typescript
// In server.ts
const fastify = Fastify({
  keepAliveTimeout: 5000,
  connectionTimeout: 10000,
})
```

## Monitoring

### Health Check Endpoint

```bash
# Check service health
curl http://your-service.com/health

# Response:
{
  "status": "healthy",
  "timestamp": "2025-10-03T00:00:00.000Z",
  "uptime": 3600,
  "database": "available"
}
```

### Logging

Structured JSON logs in production:

```typescript
// Automatically configured based on NODE_ENV
// Production: JSON format
// Development: Pretty format with colors
```

### Metrics (Future)

Consider adding:
- Prometheus metrics (`prom-client`)
- APM tools (New Relic, DataDog)
- Error tracking (Sentry)

## Database Migrations

### Running Migrations in Production

```bash
# Option 1: Run migrations as part of deployment
npm run prisma:migrate

# Option 2: Use Prisma migrate deploy (for CI/CD)
npx prisma migrate deploy

# Option 3: Run as init container in Kubernetes
# See Kubernetes example below
```

## Zero-Downtime Deployment

### Rolling Deployment

1. Deploy new version alongside old version
2. Run database migrations (backwards compatible!)
3. Gradually shift traffic to new version
4. Monitor for errors
5. Shut down old version

### Blue-Green Deployment

1. Deploy new version (green) completely separate
2. Run smoke tests on green
3. Switch traffic from blue to green
4. Keep blue running for quick rollback
5. After validation, shut down blue

## Reverse Proxy (Nginx)

```nginx
upstream fastify_backend {
  server 127.0.0.1:3000;
  keepalive 64;
}

server {
  listen 80;
  server_name api.example.com;

  # Redirect HTTP to HTTPS
  return 301 https://$server_name$request_uri;
}

server {
  listen 443 ssl http2;
  server_name api.example.com;

  ssl_certificate /etc/ssl/certs/api.example.com.crt;
  ssl_certificate_key /etc/ssl/private/api.example.com.key;

  location / {
    proxy_pass http://fastify_backend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
  }
}
```

## Scaling

### Horizontal Scaling

The service is **stateless** and scales horizontally:

1. **Shared Redis** - Token storage synchronized
2. **Database pooling** - Each instance has 20 connections
3. **No in-memory state** - Safe to run multiple instances

### Load Balancer Configuration

```bash
# Example: AWS ALB health check
Health check path: /health
Healthy threshold: 2
Unhealthy threshold: 3
Timeout: 5 seconds
Interval: 30 seconds
```

## Backup and Recovery

### Database Backups

```bash
# Automated backup script
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore from backup
psql $DATABASE_URL < backup_20250103_120000.sql
```

### Redis Persistence

```bash
# Enable Redis persistence
redis-server --appendonly yes
```

## Rollback Strategy

```bash
# 1. Identify previous working version
git log --oneline

# 2. Revert to previous commit
git revert <commit-hash>

# 3. Rebuild and deploy
npm run build
docker build -t fastify-service:rollback .

# 4. Deploy rollback version
# Use your deployment method
```

## Cost Optimization

1. **Use smaller instances** - Service is lightweight
2. **Auto-scaling** - Scale down during low traffic
3. **Connection pooling** - Reduce database costs
4. **Caching** - Reduce database queries
5. **Compression** - Reduce bandwidth costs

## Support

For production issues:
1. Check application logs
2. Check health endpoint
3. Verify environment variables
4. Check database connectivity
5. Review monitoring dashboards

