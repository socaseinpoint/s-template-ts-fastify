# Available Commands

This document contains all Docker and utility commands that are not frequently used enough to be in `package.json`.

## 📦 Quick Reference

For daily development, use commands from `package.json`:
```bash
npm run dev          # Start development server
npm run test         # Run tests
npm run lint         # Lint code
npm run build        # Build for production
```

---

## 🐳 Docker Commands

### Development Environment

Start development database and Redis:
```bash
docker compose -f docker-compose.dev.yml up -d
```

Stop and remove containers:
```bash
docker compose -f docker-compose.dev.yml down
```

View logs:
```bash
docker compose -f docker-compose.dev.yml logs -f

# Specific service
docker compose -f docker-compose.dev.yml logs -f postgres
docker compose -f docker-compose.dev.yml logs -f redis
```

Rebuild containers:
```bash
docker compose -f docker-compose.dev.yml build --no-cache
docker compose -f docker-compose.dev.yml up -d
```

Restart containers:
```bash
docker compose -f docker-compose.dev.yml restart
```

Clean everything (including volumes):
```bash
docker compose -f docker-compose.dev.yml down -v
```

---

### Testing Environment

Start test database:
```bash
docker compose -f docker-compose.test.yml up -d

# Wait for DB to be ready, then run migrations
sleep 5
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

Stop test environment:
```bash
docker compose -f docker-compose.test.yml down -v
```

---

### Production Environment

**⚠️ Warning:** These commands are for local production testing only. Use CI/CD for real deployments.

Start production API:
```bash
docker compose -f docker-compose.prod.api.yml up -d
```

Start production workers:
```bash
docker compose -f docker-compose.prod.worker.yml up -d
```

View production logs:
```bash
docker compose -f docker-compose.prod.api.yml logs -f
docker compose -f docker-compose.prod.worker.yml logs -f
```

Stop production services:
```bash
docker compose -f docker-compose.prod.api.yml down
docker compose -f docker-compose.prod.worker.yml down
```

---

## 🗄️ Database Commands

### Migrations

Check migration status:
```bash
npx prisma migrate status
```

Create new migration:
```bash
npx prisma migrate dev --name add_user_email_verified
```

Deploy migrations (production):
```bash
npx prisma migrate deploy
```

Reset database (⚠️ DESTRUCTIVE):
```bash
npx prisma migrate reset
```

---

### Database Management

Open Prisma Studio (GUI):
```bash
npm run prisma:studio
```

Run seed:
```bash
npm run prisma:seed
```

Generate Prisma Client:
```bash
npm run prisma:generate
```

---

### Database Backup & Restore

Backup database:
```bash
docker exec -t postgres-container pg_dump -U postgres tsservice > backup.sql
```

Restore database:
```bash
docker exec -i postgres-container psql -U postgres tsservice < backup.sql
```

---

## 🧹 Cleanup Commands

Clean build artifacts:
```bash
npm run clean
# or manually:
rm -rf dist coverage .vitest
```

Clean everything (including node_modules):
```bash
rm -rf dist coverage .vitest node_modules
npm install
```

Full reset (clean + Docker):
```bash
npm run clean
docker compose -f docker-compose.dev.yml down -v
docker compose -f docker-compose.test.yml down -v
npm install
```

---

## 🔍 Debugging Commands

### Inspect running containers

List containers:
```bash
docker compose -f docker-compose.dev.yml ps
```

Access container shell:
```bash
docker compose -f docker-compose.dev.yml exec postgres bash
docker compose -f docker-compose.dev.yml exec redis sh
```

### Database debugging

Connect to PostgreSQL:
```bash
docker compose -f docker-compose.dev.yml exec postgres psql -U postgres tsservice
```

Common SQL queries:
```sql
-- List all tables
\dt

-- Describe table structure
\d users

-- Count rows
SELECT COUNT(*) FROM users;

-- Check recent migrations
SELECT * FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 5;
```

### Redis debugging

Connect to Redis CLI:
```bash
docker compose -f docker-compose.dev.yml exec redis redis-cli
```

Common Redis commands:
```redis
# List all keys
KEYS *

# Get value
GET key_name

# Check queue jobs
LRANGE bull:webhook:waiting 0 -1

# Delete all keys (⚠️ CAREFUL)
FLUSHALL
```

---

## 📊 Monitoring Commands

### Check application health

```bash
curl http://localhost:3000/health | jq
```

### Check metrics

```bash
curl http://localhost:3000/metrics
```

### Check Bull Queue dashboard

Open in browser:
```
http://localhost:3000/admin/queues
```

### Check logs in production

```bash
# API logs
docker service logs -f myapp-production_api

# Worker logs
docker service logs -f myapp-production_worker-io
docker service logs -f myapp-production_worker-ffmpeg
```

---

## 🚀 Deployment Commands

**Note:** These are handled by CI/CD. Manual deployment is not recommended.

### Manual deployment (emergency only)

```bash
# SSH to server
ssh user@your-server.com

# Navigate to project
cd /opt/myapp-production

# Pull latest images
docker pull ghcr.io/yourorg/ts-service-template-api:latest
docker pull ghcr.io/yourorg/ts-service-template-worker:latest

# Deploy stack
docker stack deploy -c swarm.production.yml myapp-production --with-registry-auth

# Check status
docker service ls
docker service ps myapp-production_api
```

### Scaling services

```bash
# Scale API to 3 replicas
docker service scale myapp-production_api=3

# Scale IO workers to 5 replicas
docker service scale myapp-production_worker-io=5

# Auto-scale (use preset)
./scripts/scale.sh high-load production
```

### Rollback

```bash
# Rollback specific service
docker service rollback myapp-production_api

# Rollback all services in stack
docker service ls --filter "label=com.docker.stack.namespace=myapp-production" --format "{{.Name}}" | \
  xargs -n 1 docker service rollback
```

---

## 🧪 Testing Commands

### Run specific test files

```bash
# Single file
npx vitest run tests/unit/modules/auth/auth.service.test.ts

# Pattern
npx vitest run tests/unit/modules

# Watch mode
npx vitest watch tests/unit/modules/auth
```

### Coverage

```bash
# Full coverage report
npm run test:coverage

# View HTML report
open coverage/index.html
```

### E2E tests

```bash
# Run E2E tests
npm run test:e2e

# With full Docker setup
./scripts/test-e2e.sh
```

---

## 📝 Code Quality Commands

### Lint specific files

```bash
npx eslint src/modules/auth --fix
```

### Format specific files

```bash
npx prettier --write "src/modules/auth/**/*.ts"
```

### Type check only

```bash
npm run type-check
```

---

## 🔐 Security Commands

### Generate JWT secret

```bash
openssl rand -base64 64
```

### Generate random password

```bash
openssl rand -base64 32
```

### Scan for vulnerabilities

```bash
npm audit

# Fix automatically
npm audit fix
```

---

## 🎯 Performance Commands

### Analyze bundle size

```bash
npm run build
du -sh dist/*
```

### Memory profiling

```bash
node --inspect dist/server.js
# Open chrome://inspect in Chrome
```

---

## 💡 Tips

1. **Use `package.json` scripts** for daily tasks (dev, test, lint)
2. **Use this file** for Docker, deployment, and advanced operations
3. **Create aliases** in your `.bashrc`/`.zshrc` for frequently used Docker commands
4. **Document** any new important commands you discover

---

## 🆘 Need Help?

- Check README.md for getting started
- Check docs/ARCHITECTURE_PRINCIPLES.md for design decisions
- Check docs/DEPLOYMENT.md for production deployment
- Check docs/SCALING_GUIDE.md for scaling strategies

