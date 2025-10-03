# TypeScript Service Template

Production-ready Fastify + BullMQ template with workers, monitoring, and CI/CD.

**Use for:** Background jobs, AI services, async processing, microservices

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Setup environment
cp .env.example .env

# 3. Generate JWT secret (REQUIRED!)
openssl rand -base64 64
# Copy output to JWT_SECRET in .env

# 4. Start Docker services (PostgreSQL + Redis)
docker compose -f docker-compose.dev.yml up -d

# 5. Verify Redis and PostgreSQL are running
docker compose -f docker-compose.dev.yml ps
# Both should show "healthy" status

# 6. Test Redis connection
docker compose -f docker-compose.dev.yml exec redis redis-cli ping
# Should return: PONG

# 7. Setup database
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed

# 8. Run development server
npm run dev
```

**API:** http://localhost:3000/docs  
**Queues:** http://localhost:3000/admin/queues  
**Redis UI:** http://localhost:8081 (Redis Commander)  
**Metrics:** http://localhost:3000/metrics

---

## ⚠️ Important: Redis is Required

**This service REQUIRES Redis to function.** It's not optional.

Redis is used for:
- ✅ BullMQ job queues (video generation, processing)
- ✅ Distributed rate limiting
- ✅ Token storage (JWT refresh tokens)
- ✅ Caching

**Without Redis, the application will not start.**

### Start Redis:
```bash
# Start Redis with Docker
docker compose -f docker-compose.dev.yml up -d redis

# Check Redis is running
docker compose -f docker-compose.dev.yml ps redis

# Test connection
redis-cli ping  # or: docker compose exec redis redis-cli ping
```

### Environment Variables:
```bash
# .env file (REQUIRED)
REDIS_URL=redis://localhost:6379

# OR use individual settings:
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=  # Optional for local dev
```

---

## What's Inside

✅ **Fastify API** - Auth, validation, Swagger, rate limiting  
✅ **BullMQ Workers** - Background jobs with retry  
✅ **Monitoring** - Prometheus metrics + Bull Board UI  
✅ **CI/CD** - GitHub Actions (staging + production)  
✅ **Docker Swarm** - Multi-server deployment ready  
✅ **Testing** - Unit + E2E with coverage

---

## Architecture

```
User → API (quick response)
        ↓
    [Redis Queue]
        ↓
    Worker (background processing)
        ↓
    External API (Replicate, OpenAI, etc.)
        ↓
    Result → Database
```

**Why Workers?** Non-blocking, retry logic, scalable independently

---

## Deployment

### Staging
```bash
git push origin develop  # Auto-deploy to staging
```

### Production
```bash
git push origin main  # Auto-deploy to production
```

### Scaling
```bash
./scripts/scale.sh high-load production  # Auto-scale to preset
docker service scale myapp_worker-io=10  # Manual scale
```

---

## Operating Modes

```bash
MODE=all     # API + Workers (one process) - MVP
MODE=api     # API only - Production
MODE=worker  # Workers only - Production
```

**Worker Types:**
```bash
WORKER_TYPE=io      # API calls (Replicate, OpenAI) - High concurrency
WORKER_TYPE=ffmpeg  # Video processing - Low concurrency (CPU-heavy)
WORKER_TYPE=gpu     # ML inference - Very low concurrency (GPU)
```

---

## Monitoring

```bash
# Queue dashboard
http://localhost:3000/admin/queues

# Prometheus metrics
http://localhost:3000/metrics

# Check queues
./scripts/check-queues.sh $REDIS_URL

# Health
curl http://localhost:3000/health
```

---

## Documentation

- 📖 [Architecture](./docs/ARCHITECTURE_PRINCIPLES.md) - Design principles
- ⚙️ [Workers](./docs/WORKER_PATTERNS.md) - Worker patterns
- 🚀 [Deployment](./docs/DEPLOYMENT.md) - Production guide
- 📈 [Scaling](./docs/SCALING_GUIDE.md) - How to scale
- 🧪 [Testing](./docs/TESTING.md) - Testing guide
- 💻 [Commands](./docs/COMMANDS.md) - Docker & utility commands

---

## GitHub Secrets (Required)

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
```

---

## License

ISC
