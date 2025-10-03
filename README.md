# TypeScript Service Template

Production-ready Fastify API with background job processing (BullMQ).

**Perfect for:** Video generation, AI agents, async data processing

---

## What's Inside

- **API Service** (Fastify) - RESTful API with auth, validation, Swagger
- **Worker Service** (BullMQ) - Background jobs with retry & scaling
- **Flexible Architecture** - One process for MVP, separate for production

---

## Quick Start (Development)

```bash
# 1. Install
npm install

# 2. Start infrastructure
npm run docker:up

# 3. Setup database
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed

# 4. Start service (API + Workers)
npm run dev
```

**✅ Done!**
- API: http://localhost:3000/docs
- Health: http://localhost:3000/health
- Login: `admin@example.com` / `password123`

---

## Quick Start (Production)

### Prerequisites

1. **PostgreSQL** (managed) - AWS RDS, DigitalOcean, etc.
2. **Redis** (managed) - ElastiCache, Redis Cloud, etc.

### Deploy

```bash
# 1. Configure
export DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require"
export REDIS_URL="redis://default:pass@host:6379"
export JWT_SECRET="$(openssl rand -base64 64)"
export CORS_ORIGIN="https://yourapp.com"

# 2. Build
docker build -t myapp-api .
docker build -f Dockerfile.worker -t myapp-worker .

# 3. Migrate
docker run --rm -e DATABASE_URL="$DATABASE_URL" myapp-api npx prisma migrate deploy

# 4. Deploy API
docker compose -f docker-compose.prod.api.yml up -d --scale api=3

# 5. Deploy Workers
docker compose -f docker-compose.prod.worker.yml up -d --scale worker=5
```

---

## Operating Modes

```bash
MODE=all      # API + Workers (MVP)
MODE=api      # API only (production)
MODE=worker   # Workers only (production)
```

**Development:**
```bash
npm run dev              # API + Workers
npm run dev:api          # API only
npm run dev:worker       # Workers only
```

**Production:**
```bash
npm run start            # API
npm run start:worker     # Workers
npm run start:all        # Both
```

---

## Example: Background Job

### Create Job

```typescript
// src/modules/jobs/video.queue.ts
export interface VideoJobData {
  userId: string
  scriptId: string
}
```

### Create Processor

```typescript
// src/modules/jobs/video.worker.ts
export async function processVideoJob(job: Job<VideoJobData>) {
  await job.updateProgress(50)
  const video = await generateVideo(job.data.scriptId)
  await job.updateProgress(100)
  return { videoUrl: video.url }
}
```

### Register

```typescript
// src/worker.ts
workerService.createWorker('video-generation', processVideoJob)
```

### Use in API

```typescript
const job = await videoQueue.add('generate', { userId, scriptId })
return { jobId: job.id, status: 'queued' }
```

---

## Environment Variables

### Required
```bash
DATABASE_URL=postgresql://user:pass@host:5432/db
REDIS_URL=redis://host:6379
JWT_SECRET=<64-char-string>        # openssl rand -base64 64
```

### Production
```bash
MODE=api
CORS_ORIGIN=https://yourapp.com    # NOT *
ENABLE_SWAGGER=false
QUEUE_CONCURRENCY=10
```

---

## Available Scripts

### Development
```bash
npm run dev              # API + Workers
npm run dev:api          # API only
npm run dev:worker       # Workers only
```

### Build & Run
```bash
npm run build            # Compile
npm run start            # API
npm run start:worker     # Workers
```

### Testing
```bash
npm test                 # Unit tests
npm run test:e2e:full    # E2E tests
npm run test:coverage    # Coverage
```

### Docker
```bash
npm run docker:up               # Dev (Postgres + Redis)
npm run docker:prod:api         # Prod API
npm run docker:prod:worker      # Prod Workers
```

### Database
```bash
npm run prisma:generate  # Generate client
npm run prisma:migrate   # Migrations
npm run prisma:studio    # Visual editor
```

---

## Production Architecture

```
Load Balancer
    ↓
API × 3 (MODE=api)
    ↓
Redis (managed)
    ↓
Workers × 5 (MODE=worker)
    ↓
PostgreSQL (managed)
```

---

## Scaling

```bash
# API
docker compose -f docker-compose.prod.api.yml up -d --scale api=3

# Workers
docker compose -f docker-compose.prod.worker.yml up -d --scale worker=5
```

---

## Documentation

- 📝 [API Service](./docs/API.md) - API docs
- ⚙️ [Worker Service](./docs/WORKER.md) - Workers docs
- 🔥 [Workers Guide](./docs/WORKERS.md) - BullMQ patterns
- 🚀 [Deployment](./docs/DEPLOYMENT.md) - Production guide
- 🧪 [Testing](./docs/TESTING.md) - Testing guide

---

## Troubleshooting

```bash
# Reset everything
npm run reset

# Check services
npm run docker:up
npm run docker:logs

# Check Redis
redis-cli ping

# Check workers
docker ps | grep worker
```

---

## Security Checklist

- [ ] Strong JWT_SECRET (64+ chars)
- [ ] CORS restricted (`https://yourapp.com`, NOT `*`)
- [ ] Swagger disabled (`ENABLE_SWAGGER=false`)
- [ ] Database SSL (`?sslmode=require`)
- [ ] Rate limiting enabled

---

## License

ISC
