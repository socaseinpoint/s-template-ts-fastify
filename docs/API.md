# API Service

RESTful API service with authentication and job queue integration.

---

## What It Does

- Handles HTTP requests (REST API)
- JWT authentication & authorization
- Creates background jobs
- Swagger documentation
- Rate limiting & security

---

## Running

### Development
```bash
npm run dev              # API + Workers
npm run dev:api          # API only
```

### Production
```bash
MODE=api npm run start
```

---

## Endpoints

### System
- `GET /health` - Health check
- `GET /` - Welcome
- `GET /docs` - Swagger UI (dev only)

### Authentication
- `POST /v1/auth/register` - Register
- `POST /v1/auth/login` - Login
- `POST /v1/auth/refresh` - Refresh token
- `POST /v1/auth/logout` - Logout
- `GET /v1/auth/me` - Current user

### Users (Admin only)
- `GET /v1/users` - List users
- `GET /v1/users/:id` - Get user
- `PATCH /v1/users/:id` - Update user
- `DELETE /v1/users/:id` - Delete user

### Items (Example)
- `GET /v1/items` - List (any user)
- `GET /v1/items/:id` - Get (any user)
- `POST /v1/items` - Create (moderator+)
- `PUT /v1/items/:id` - Update (moderator+)
- `DELETE /v1/items/:id` - Delete (admin)

**Full docs:** http://localhost:3000/docs

---

## Authentication

### Login

```bash
curl -X POST http://localhost:3000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password123"}'
```

Response:
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "user": { "id": "1", "email": "admin@example.com", "role": "admin" }
}
```

### Use Token

```bash
curl http://localhost:3000/v1/items \
  -H "Authorization: Bearer <access-token>"
```

### Refresh Token

```bash
curl -X POST http://localhost:3000/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<refresh-token>"}'
```

---

## Roles

- **USER** - Basic access
- **MODERATOR** - Can create/update items
- **ADMIN** - Full access

---

## Creating Background Jobs

Add jobs from API controllers:

```typescript
export async function createJobHandler(request, reply) {
  const container = request.server.diContainer
  const myQueue = container.cradle.myQueue

  const job = await myQueue.add('process', {
    userId: request.user.id,
    data: request.body,
  })

  return reply.code(202).send({
    jobId: job.id,
    status: 'queued',
  })
}
```

---

## Configuration

### Environment

```bash
MODE=api
PORT=3000
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=<64-chars>
CORS_ORIGIN=https://yourapp.com
ENABLE_SWAGGER=false            # Production
ENABLE_RATE_LIMIT=true
```

### Security

**JWT:**
- Minimum 64 characters
- Generate: `openssl rand -base64 64`

**CORS:**
- Development: `CORS_ORIGIN=*`
- Production: `CORS_ORIGIN=https://yourapp.com`

**Swagger:**
- Development: enabled
- Production: disabled (`ENABLE_SWAGGER=false`)

---

## Scaling

### Horizontal

```bash
# Run multiple instances
PORT=3000 MODE=api npm start  # Instance 1
PORT=3001 MODE=api npm start  # Instance 2
PORT=3002 MODE=api npm start  # Instance 3

# Or with Docker
docker compose -f docker-compose.prod.api.yml up -d --scale api=3
```

**Requirements:**
- Redis for distributed rate limiting
- Load balancer (nginx, ALB, etc.)

---

## Health Check

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

Use for:
- Docker healthcheck
- Kubernetes probes
- Monitoring

---

## Docker

### Build
```bash
docker build -t myapp-api .
```

### Run
```bash
docker run -p 3000:3000 \
  -e MODE=api \
  -e DATABASE_URL="postgresql://..." \
  -e REDIS_URL="redis://..." \
  -e JWT_SECRET="..." \
  myapp-api
```

### Deploy
```bash
docker compose -f docker-compose.prod.api.yml up -d
```

---

## Monitoring

### Logs
```bash
docker logs api -f
docker compose -f docker-compose.prod.api.yml logs -f
```

### Metrics
Enable: `ENABLE_METRICS=true`  
Access: http://localhost:3000/metrics

---

## Troubleshooting

**Won't start:**
```bash
npm run docker:up
npm run docker:logs
```

**401 errors:**
- Check JWT_SECRET same across instances
- Verify Redis connection

**503 Queue errors:**
- Ensure MODE=all or workers running separately
- Check Redis connection

---

## Next Steps

- 📖 [Worker Service](./WORKER.md) - Add background jobs
- 🚀 [Production Setup](./PRODUCTION_SETUP.md) - Deploy
- 🧪 [Testing](./TESTING.md) - Write tests
