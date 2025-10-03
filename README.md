# Fastify TypeScript Service Template

A production-ready Fastify service template with TypeScript, Swagger, authentication, and comprehensive tooling.

## 🚀 Quick Start (2 minutes)

```bash
# 1. Install dependencies
npm install

# 2. Setup environment
cp .env.example .env
# Edit .env and set at least: DATABASE_URL, JWT_SECRET

# 3. Start infrastructure (PostgreSQL + Redis)
npm run docker:up

# 4. Setup database
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed

# 5. Start development server
npm run dev
```

**Your service is now running!** 🎉

- 📚 API Docs: http://localhost:3000/docs
- ❤️ Health Check: http://localhost:3000/health
- 🔐 Test Login: `admin@example.com` / `password123`

**Run tests:**
```bash
npm test              # Unit tests (43 tests, ~1s)
npm run test:e2e:full # E2E tests (15 tests, ~2min)
```

**Troubleshooting:**
```bash
npm run reset         # Clean everything and start fresh
npm run docker:logs   # Check Docker logs
```

📖 **For detailed documentation, see:**
- [Testing Guide](./docs/TESTING.md)
- [Deployment Guide](./docs/DEPLOYMENT.md)
- [Development Guide](./docs/DEVELOPMENT.md)

---

## Features

- ⚡ **Fastify** - High-performance web framework
- 🚀 **TypeScript** - Type-safe development with path aliases
- 📝 **Swagger/OpenAPI** - Auto-generated API documentation
- 🔐 **Authentication** - JWT-based auth with refresh tokens
- 🎯 **Path Aliases** - Use `@/` for clean imports from `src/`
- 📊 **Health Checks** - Built-in health monitoring endpoints
- 🗄️ **Prisma ORM** - Type-safe database access (optional)
- 🔄 **Redis Support** - Caching and session management (optional)
- 📦 **Modular Architecture** - Clean service-based structure
- 🪝 **Git Hooks** - Husky for pre-commit checks
- 🧪 **Testing** - Vitest for unit testing
- 📝 **ESLint & Prettier** - Code quality and formatting
- 🔧 **Environment Config** - Dotenv configuration
- 🌐 **CORS** - Configurable CORS settings
- 📖 **Logging** - Structured logging with levels

## Project Structure

```
ts-service-template/
├── src/
│   ├── config/          # Configuration management
│   │   ├── index.ts     # Environment variables
│   │   └── swagger.ts   # Swagger configuration
│   ├── routes/          # API routes
│   │   ├── index.ts     # Route registration
│   │   ├── auth.routes.ts
│   │   ├── user.routes.ts
│   │   └── item.routes.ts
│   ├── services/        # Business logic services
│   │   ├── auth.service.ts
│   │   ├── user.service.ts
│   │   ├── item.service.ts
│   │   ├── database.service.ts
│   │   └── redis.service.ts
│   ├── schemas/         # Request/Response schemas
│   │   ├── auth.schemas.ts
│   │   ├── user.schemas.ts
│   │   └── item.schemas.ts
│   ├── types/           # TypeScript type definitions
│   │   ├── index.ts
│   │   └── fastify.d.ts
│   ├── utils/           # Utility functions
│   │   ├── logger.ts
│   │   ├── errors.ts
│   │   └── helpers.ts
│   └── server.ts        # Application entry point
├── prisma/              # Prisma ORM (optional)
│   └── schema.prisma
├── dist/                # Compiled output
├── .husky/              # Git hooks
├── .env.example         # Environment variables template
├── tsconfig.json        # TypeScript configuration
├── vitest.config.ts     # Test configuration
└── package.json
```

## Documentation

- 📖 [**Development Guide**](./docs/DEVELOPMENT.md) - Setup, project structure, best practices
- 🧪 [**Testing Guide**](./docs/TESTING.md) - Unit tests, E2E tests, coverage
- 🚀 [**Deployment Guide**](./docs/DEPLOYMENT.md) - Docker, cloud platforms, production setup

## Available Scripts

### Development
```bash
npm run dev           # Start with hot reload
npm run start:dev     # Start without hot reload
npm run docker:up     # Start PostgreSQL + Redis
npm run docker:logs   # View Docker logs
```

### Testing
```bash
npm test              # Unit tests (fast)
npm run test:e2e:full # E2E tests (automated)
npm run test:coverage # Coverage report
npm run test:ui       # Interactive UI
```

### Code Quality
```bash
npm run lint          # Fix linting issues
npm run format        # Format code
npm run type-check    # TypeScript validation
```

### Database
```bash
npm run prisma:generate  # Generate Prisma client
npm run prisma:migrate   # Run migrations
npm run prisma:studio    # Visual database editor
npm run prisma:seed      # Seed test data
```

### Maintenance
```bash
npm run clean         # Remove build artifacts
npm run reset         # Complete reset (everything)
npm run docker:clean  # Clean Docker volumes
```

See [package.json](./package.json) for all available scripts.

## API Documentation

When the server is running, **Swagger UI** is available at: **http://localhost:3000/docs**

### Quick API Overview

| Endpoint | Method | Auth Required | Description |
|----------|--------|---------------|-------------|
| `/health` | GET | ❌ | Health check |
| `/v1/auth/login` | POST | ❌ | User login |
| `/v1/auth/register` | POST | ❌ | User registration |
| `/v1/users` | GET | ✅ Admin | List users |
| `/v1/items` | GET | ✅ Any | List items |
| `/v1/items` | POST | ✅ Moderator+ | Create item |

📚 **Full API documentation:** http://localhost:3000/docs (interactive)

## Configuration

All configuration is done through environment variables. See `.env.example` for full list with documentation.

**Required variables:**
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret key for JWT (64+ chars, high entropy)

**Optional but recommended:**
- `REDIS_URL` - Redis for distributed token storage
- `CORS_ORIGIN` - Allowed origins (set to specific domains in production)

Generate secure JWT secret:
```bash
openssl rand -base64 64
```

📖 **Full configuration guide:** [Development Guide](./docs/DEVELOPMENT.md)

## Authentication & Authorization

JWT-based authentication with role-based access control (RBAC).

**Test Credentials:**
```
Admin:      admin@example.com     / password123
Moderator:  moderator@example.com / password123
User:       user@example.com      / password123
```

**Usage:**
```bash
# 1. Login
curl -X POST http://localhost:3000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password123"}'

# 2. Use token
curl http://localhost:3000/v1/items \
  -H "Authorization: Bearer <your-token>"
```

📖 **Full authentication guide:** See [API Documentation](http://localhost:3000/docs)

## Testing

**Two-tier testing strategy:**
- 🧪 **Unit Tests** - 43 tests, ~1s, fully mocked
- 🌐 **E2E Tests** - 15 tests, ~2min, real database

```bash
npm test              # Unit tests (fast)
npm run test:e2e:full # E2E tests (automated with Docker)
npm run test:coverage # Coverage report (80%+ required)
```

**E2E test options:**
```bash
npm run test:e2e:full         # Normal (keeps volumes for speed)
CLEAN=true npm run test:e2e:full  # Full cleanup (removes everything)
```

📖 **Full testing guide:** [Testing Guide](./docs/TESTING.md)

## Deployment

```bash
# Build for production
npm run build

# Run in production
NODE_ENV=production npm start

# Docker deployment
docker build -t fastify-service .
docker run -p 3000:3000 --env-file .env fastify-service
```

📖 **Full deployment guide:** [Deployment Guide](./docs/DEPLOYMENT.md)

## Architecture Highlights

- **Clean Architecture** - Separation of concerns (Routes → Services → Repositories)
- **Dependency Injection** - Awilix with SINGLETON lifetime for stateless services
- **Type Safety** - 100% TypeScript with strict mode, zero `any` types
- **Security First** - JWT entropy validation, rate limiting, CORS, Helmet
- **Graceful Degradation** - Redis optional, falls back to in-memory
- **Observability** - Structured logging, correlation IDs, health checks

## Project Principles

✅ **No global state** - Everything passed through DI container  
✅ **Type-safe** - Full TypeScript, strict mode enabled  
✅ **Well-tested** - 58 tests (unit + E2E), 80%+ coverage  
✅ **Production-ready** - Docker, monitoring, graceful shutdown  
✅ **Developer-friendly** - Hot reload, clear errors, good docs  

## Troubleshooting

```bash
# Something broke? Reset everything:
npm run reset

# Check what's running:
npm run docker:logs

# View test server logs:
cat test-server.log

# Full cleanup (including Docker volumes):
CLEAN=true npm run test:e2e:full
```

## Contributing

1. Fork and create a feature branch
2. Make your changes
3. Run `npm run precommit` (linting, formatting, type-check, tests)
4. Submit a pull request

## License

ISC

## Support

📖 Check documentation in [./docs/](./docs/)  
🐛 Report issues on GitHub  
💬 Questions? Open a discussion
