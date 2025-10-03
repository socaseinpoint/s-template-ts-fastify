# Documentation

## Core Docs (Start Here)

- **[Architecture](./ARCHITECTURE_PRINCIPLES.md)** - How API and Workers separate responsibilities
- **[Workers](./WORKER_PATTERNS.md)** - Worker best practices and patterns
- **[Deployment](./DEPLOYMENT.md)** - Production deployment guide
- **[Scaling](./SCALING_GUIDE.md)** - How to scale your service
- **[Testing](./TESTING.md)** - Testing guide

---

## Quick Reference

### Worker Role
Worker calls external APIs (Replicate, OpenAI, etc.) and returns data.  
API event handlers save results to database.

### Deployment
```bash
git push origin develop  # → Staging
git push origin main     # → Production
```

### Scaling
```bash
./scripts/scale.sh high-load production
```

### Monitoring
```
Bull Board:  /admin/queues
Metrics:     /metrics
Health:      /health
```

---

See individual docs for details.

