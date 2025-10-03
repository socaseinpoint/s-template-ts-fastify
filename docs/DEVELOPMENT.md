# Development Guide

Complete guide for developing with the TypeScript Service Template.

## Table of Contents

- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Path Aliases](#path-aliases)
- [Dependency Injection](#dependency-injection)
- [API Development](#api-development)
- [Database Development](#database-development)
- [Debugging](#debugging)

## Development Setup

### Prerequisites

- **Node.js** >= 18.0.0
- **npm** or yarn
- **Docker Desktop** (for PostgreSQL and Redis)
- **Git**

### First-Time Setup

```bash
# 1. Clone repository
git clone <repository-url>
cd ts-service-template

# 2. Install dependencies
npm install

# 3. Copy environment template
cp .env.example .env

# 4. Generate secure JWT secret
openssl rand -base64 64
# Copy output to .env as JWT_SECRET

# 5. Start Docker services
npm run docker:up

# 6. Setup database
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed

# 7. Start development server
npm run dev
```

### Daily Development Workflow

```bash
# Start infrastructure (if not running)
npm run docker:up

# Start dev server with hot reload
npm run dev

# In separate terminal: run tests on changes
npm run test:watch

# Check logs
npm run docker:logs
```

## Project Structure

```
ts-service-template/
├── src/
│   ├── app.ts              # Fastify app factory
│   ├── server.ts           # Entry point
│   ├── container.ts        # DI container setup
│   │
│   ├── config/             # Configuration
│   │   ├── index.ts        # Environment validation
│   │   └── swagger.ts      # API docs config
│   │
│   ├── routes/             # HTTP endpoints
│   │   ├── index.ts        # Route registration
│   │   ├── auth.routes.ts  # /v1/auth/*
│   │   ├── user.routes.ts  # /v1/users/*
│   │   └── item.routes.ts  # /v1/items/*
│   │
│   ├── services/           # Business logic
│   │   ├── auth.service.ts
│   │   ├── user.service.ts
│   │   └── item.service.ts
│   │
│   ├── repositories/       # Data access layer
│   │   ├── base.repository.ts
│   │   ├── user.repository.ts
│   │   ├── item.repository.ts
│   │   └── token.repository.ts
│   │
│   ├── middleware/         # Custom middleware
│   │   ├── auth.middleware.ts
│   │   ├── error-handler.middleware.ts
│   │   └── validation.middleware.ts
│   │
│   ├── schemas/            # Zod validation schemas
│   │   ├── auth.schemas.ts
│   │   ├── user.schemas.ts
│   │   └── item.schemas.ts
│   │
│   ├── types/              # TypeScript definitions
│   │   ├── index.ts
│   │   └── fastify.d.ts
│   │
│   ├── utils/              # Utilities
│   │   ├── logger.ts
│   │   ├── errors.ts
│   │   ├── password.ts
│   │   └── helpers.ts
│   │
│   └── plugins/            # Fastify plugins
│       ├── jwt.plugin.ts
│       └── request-context.plugin.ts
│
├── prisma/
│   ├── schema.prisma       # Database schema
│   ├── migrations/         # Migration history
│   └── seed.ts             # Test data seeder
│
├── tests/
│   ├── unit/               # Unit tests
│   ├── e2e/                # E2E tests
│   ├── fixtures/           # Test data
│   ├── mocks/              # Mock implementations
│   └── helpers/            # Test utilities
│
└── docs/                   # Documentation
    ├── TESTING.md
    ├── DEPLOYMENT.md
    └── DEVELOPMENT.md
```

## Path Aliases

Use `@/` to import from `src/`:

```typescript
// ❌ Bad - relative paths
import { Logger } from '../../../utils/logger'
import { UserService } from '../../services/user.service'

// ✅ Good - clean imports
import { Logger } from '@/utils/logger'
import { UserService } from '@/services/user.service'

// Also works for tests
import { testUsers } from '@tests/fixtures/users.fixture'
```

Configured in:
- `tsconfig.json` - For TypeScript
- `vitest.config.mts` - For tests
- `package.json` - For runtime (tsconfig-paths)

## Dependency Injection

The project uses **Awilix** for DI with SINGLETON lifetime.

### Container Setup

```typescript:src/container.ts
// Repositories and services are registered as SINGLETON
// They're stateless - safe and efficient
container.register({
  userRepository: asClass(UserRepository, { lifetime: Lifetime.SINGLETON }),
  userService: asClass(UserService, { lifetime: Lifetime.SINGLETON }),
})
```

### Using DI in Routes

```typescript
// Access container from fastify instance
const container = fastify.diContainer

// Get service
const userService = container.cradle.userService

// Use service
const users = await userService.getAllUsers({ page: 1, limit: 10 })
```

### Adding New Services

1. **Create service class:**
```typescript
// src/services/email.service.ts
export class EmailService {
  constructor(
    private config: ConfigType  // Auto-injected
  ) {}

  async send(to: string, subject: string, body: string) {
    // Implementation
  }
}
```

2. **Register in container:**
```typescript
// src/container.ts
container.register({
  emailService: asClass(EmailService, { lifetime: Lifetime.SINGLETON }),
})
```

3. **Update ICradle interface:**
```typescript
export interface ICradle {
  emailService: EmailService
  // ... other services
}
```

4. **Use in routes/services:**
```typescript
const emailService = container.cradle.emailService
await emailService.send('user@example.com', 'Welcome', 'Hello!')
```

## API Development

### Creating New Endpoint

**1. Create Zod Schema:**
```typescript
// src/schemas/product.schemas.ts
import { z } from 'zod'

export const createProductSchema = z.object({
  name: z.string().min(1).max(100),
  price: z.number().positive(),
  description: z.string().optional(),
})

export type CreateProductDto = z.infer<typeof createProductSchema>
```

**2. Create Repository:**
```typescript
// src/repositories/product.repository.ts
export class ProductRepository extends BaseRepository<Product> {
  constructor(prisma: PrismaClient) {
    super(prisma, 'Product')
  }

  protected getModel() {
    return this.prisma.product
  }
}
```

**3. Create Service:**
```typescript
// src/services/product.service.ts
export class ProductService {
  constructor(private productRepository: IProductRepository) {}

  async createProduct(dto: CreateProductDto) {
    return await this.productRepository.create(dto)
  }
}
```

**4. Create Route:**
```typescript
// src/routes/product.routes.ts
export default async function productRoutes(fastify: FastifyInstance) {
  const productService = fastify.diContainer.cradle.productService

  fastify.post('/products', {
    schema: {
      body: createProductSchema,
      response: { 201: productSchema },
    },
  }, async (request, reply) => {
    const product = await productService.createProduct(request.body)
    return reply.code(201).send(product)
  })
}
```

**5. Register Route:**
```typescript
// src/routes/index.ts
import productRoutes from './product.routes'

await api.register(productRoutes, { prefix: '/products' })
```

### API Versioning

```typescript
// v1 routes (current)
await fastify.register(async (api) => {
  await api.register(authRoutes, { prefix: '/auth' })
}, { prefix: '/v1' })

// v2 routes (future)
await fastify.register(async (api) => {
  await api.register(authRoutesV2, { prefix: '/auth' })
}, { prefix: '/v2' })
```

## Database Development

### Creating Migrations

```bash
# 1. Update schema.prisma
# Add new model or fields

# 2. Create migration
npm run prisma:migrate

# 3. Migration will be created in prisma/migrations/
```

### Prisma Studio

Visual database editor:

```bash
npm run prisma:studio
# Opens at http://localhost:5555
```

### Database Reset

```bash
# Reset database (DESTRUCTIVE!)
npx prisma migrate reset

# Re-seed data
npm run prisma:seed
```

### Custom Queries

```typescript
// Raw SQL
const users = await prisma.$queryRaw`
  SELECT * FROM "User" WHERE email LIKE ${'%@example.com'}
`

// Typed raw query
import { Prisma } from '@prisma/client'

const users = await prisma.$queryRaw<User[]>`
  SELECT * FROM "User" WHERE role = ${Prisma.Role.ADMIN}
`
```

## Debugging

### VS Code Launch Configuration

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Server",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "start:dev"],
      "skipFiles": ["<node_internals>/**"],
      "env": {
        "NODE_ENV": "development"
      }
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Tests",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "test:watch"],
      "skipFiles": ["<node_internals>/**"]
    }
  ]
}
```

### Chrome DevTools

```bash
# Start with inspector
node --inspect -r tsconfig-paths/register src/server.ts

# Open chrome://inspect in Chrome
```

### Logging

```typescript
import { Logger } from '@/utils/logger'

const logger = new Logger('MyComponent')

logger.debug('Detailed info')    // Development only
logger.info('General info')       // Always logged
logger.warn('Warning message')    // Warnings
logger.error('Error occurred', error) // Errors with stack
```

### Database Query Logging

```typescript
// In src/container.ts
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'], // Enable query logging
})
```

## Code Quality Tools

### Pre-commit Hook

Automatically runs before every commit:

```bash
# Defined in package.json
"precommit": "npm run lint:check && npm run format:check && npm run type-check && npm run test"
```

### Manual Checks

```bash
# Linting
npm run lint:check    # Check only
npm run lint          # Auto-fix

# Formatting
npm run format:check  # Check only
npm run format        # Auto-fix

# Type checking
npm run type-check    # TypeScript compilation check

# All checks
npm run precommit
```

## Environment Variables

### Local Development

```bash
# .env (git-ignored)
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ts_service_db
REDIS_URL=redis://localhost:6379
JWT_SECRET=dev-secret-key-at-least-64-chars-for-security-validation-to-pass
ENABLE_SWAGGER=true
```

### Loading Order

1. `.env` file (if exists)
2. Environment variables (override .env)
3. Defaults from `src/config/index.ts`

## Error Handling

### Custom Errors

```typescript
import { ValidationError, NotFoundError, UnauthorizedError } from '@/utils/errors'

// Throw custom errors
throw new ValidationError('Invalid input')
throw new NotFoundError('User not found')
throw new UnauthorizedError('Invalid token')

// Automatically handled by error-handler middleware
```

### Error Responses

```json
// Development
{
  "error": "User not found",
  "code": 404,
  "stack": "Error: User not found\n    at ..."
}

// Production
{
  "error": "User not found",
  "code": 404
}
```

## Hot Reload

Development server uses `tsx watch` for instant reload:

```bash
npm run dev

# Changes to any .ts file automatically restart server
# No manual restart needed!
```

## Code Generation

### Generate New Route

```bash
# Manually create files:
# 1. src/routes/product.routes.ts
# 2. src/services/product.service.ts
# 3. src/repositories/product.repository.ts
# 4. src/schemas/product.schemas.ts

# Or copy from existing route and modify
```

## Performance Profiling

### Built-in Profiler

```bash
# Start with profiler
node --prof -r tsconfig-paths/register src/server.ts

# Generate flamegraph
node --prof-process isolate-*.log > profile.txt
```

### Memory Leaks

```bash
# Monitor memory usage
node --inspect --expose-gc -r tsconfig-paths/register src/server.ts

# Take heap snapshot in Chrome DevTools
```

## Troubleshooting

### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>

# Or change port in .env
PORT=3001
```

### Database Connection Issues

```bash
# Check PostgreSQL is running
docker compose -f docker-compose.dev.yml ps

# Check logs
docker compose -f docker-compose.dev.yml logs postgres

# Restart database
npm run docker:restart

# Reset database
npm run docker:clean
npm run docker:up
```

### Prisma Issues

```bash
# Regenerate Prisma client
npm run prisma:generate

# Reset database and migrations
npx prisma migrate reset

# Format schema file
npx prisma format
```

### Hot Reload Not Working

```bash
# Stop server
# Clear tsx cache
rm -rf node_modules/.tsx

# Restart
npm run dev
```

### Type Errors After git pull

```bash
# Reinstall dependencies
npm install

# Regenerate Prisma client
npm run prisma:generate

# Clear TypeScript cache
rm -rf dist

# Rebuild
npm run build
```

## Git Workflow

### Committing Changes

```bash
# Pre-commit hook runs automatically:
# 1. Lint check
# 2. Format check
# 3. Type check
# 4. Unit tests

# If any fail, commit is blocked
# Fix issues and try again
```

### Bypass Hooks (NOT RECOMMENDED)

```bash
# Only in emergencies
git commit --no-verify -m "emergency fix"
```

## IDE Setup

### VS Code Extensions

Recommended extensions:

- **ESLint** - Linting
- **Prettier** - Formatting
- **Prisma** - Schema syntax highlighting
- **Error Lens** - Inline error display
- **GitLens** - Git integration
- **Rest Client** - API testing

### VS Code Settings

Create `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.preferences.importModuleSpecifier": "non-relative",
  "files.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/.git": true
  }
}
```

## Testing API Endpoints

### Using cURL

```bash
# Health check
curl http://localhost:3000/health

# Login
curl -X POST http://localhost:3000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password123"}'

# Get items (authenticated)
curl http://localhost:3000/v1/items \
  -H "Authorization: Bearer <your-token>"
```

### Using HTTPie

```bash
# Login
http POST :3000/v1/auth/login email=admin@example.com password=password123

# Get items
http :3000/v1/items Authorization:"Bearer <token>"
```

### Using Swagger UI

Open http://localhost:3000/docs

1. Click "Authorize" button
2. Login to get token
3. Paste token and click "Authorize"
4. Try any endpoint directly from browser

## Common Tasks

### Add New Environment Variable

1. **Add to config schema:**
```typescript
// src/config/index.ts
const envSchema = z.object({
  // ... existing vars
  NEW_FEATURE_FLAG: z.string().default('false').transform(val => val === 'true'),
})
```

2. **Add to .env.example:**
```bash
# Feature flags
NEW_FEATURE_FLAG=false
```

3. **Use in code:**
```typescript
import { Config } from '@/config'

if (Config.NEW_FEATURE_FLAG) {
  // Feature enabled
}
```

### Add New Database Model

1. **Update Prisma schema:**
```prisma
model Product {
  id        String   @id @default(uuid())
  name      String
  price     Float
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

2. **Create migration:**
```bash
npm run prisma:migrate
```

3. **Generate client:**
```bash
npm run prisma:generate
```

4. **Create repository, service, routes** (see above)

### Update Dependencies

```bash
# Check for updates
npm outdated

# Update all to latest
npm update

# Update specific package
npm install <package>@latest

# Check for security issues
npm audit
npm audit fix
```

## Best Practices

### 1. **Always Use Types**

```typescript
// ❌ Bad
async function getUser(id: any): Promise<any> {
  return await userRepo.findById(id)
}

// ✅ Good
async function getUser(id: string): Promise<User | null> {
  return await userRepository.findById(id)
}
```

### 2. **Use Path Aliases**

```typescript
// ❌ Bad
import { Logger } from '../../../utils/logger'

// ✅ Good
import { Logger } from '@/utils/logger'
```

### 3. **Keep Services Stateless**

```typescript
// ❌ Bad - stateful service
class UserService {
  private currentUser: User // State!

  async setCurrentUser(user: User) {
    this.currentUser = user
  }
}

// ✅ Good - stateless service
class UserService {
  async getUser(id: string) {
    return await this.userRepository.findById(id)
  }
}
```

### 4. **Use Centralized Error Handling**

```typescript
// ❌ Bad - manual try-catch everywhere
async (request, reply) => {
  try {
    const user = await userService.getUser(id)
    return reply.send(user)
  } catch (error) {
    return reply.code(500).send({ error: 'Failed' })
  }
}

// ✅ Good - throw errors, let middleware handle
async (request, reply) => {
  const user = await userService.getUser(id)
  if (!user) {
    throw new NotFoundError('User not found')
  }
  return reply.send(user)
}
```

### 5. **Log Appropriately**

```typescript
logger.debug('Detailed info')      // Only in development
logger.info('User logged in')      // General info
logger.warn('Rate limit reached')  // Warnings
logger.error('DB error', error)    // Errors with stack
```

## Resources

- [Fastify Documentation](https://www.fastify.io/)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Vitest Documentation](https://vitest.dev/)
- [Zod Documentation](https://zod.dev/)
- [Awilix Documentation](https://github.com/jeffijoe/awilix)

