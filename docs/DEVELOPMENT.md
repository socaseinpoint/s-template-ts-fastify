# Development Guide

Complete guide for developing with the TypeScript Service Template.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Setup environment
cp .env.example .env
# Edit .env and set: DATABASE_URL, JWT_SECRET

# 3. Start infrastructure
npm run docker:up

# 4. Setup database
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed

# 5. Start development server
npm run dev
```

**Your service is running at http://localhost:3000**

- API Docs: http://localhost:3000/docs
- Test Login: `admin@example.com` / `password123`

## Daily Workflow

```bash
npm run docker:up    # Start PostgreSQL + Redis
npm run dev          # Start with hot reload
npm test             # Run unit tests
```

## Project Structure

```
src/
├── app.ts              # Fastify app factory
├── server.ts           # Entry point
├── container.ts        # DI container
│
├── dto/                # Data Transfer Objects
│   ├── auth.dto.ts
│   ├── user.dto.ts
│   └── item.dto.ts
│
├── routes/             # HTTP endpoints
│   ├── auth.routes.ts
│   ├── user.routes.ts
│   └── item.routes.ts
│
├── services/           # Business logic
│   ├── auth.service.ts
│   ├── user.service.ts
│   └── item.service.ts
│
├── repositories/       # Data access layer
│   ├── base.repository.ts
│   ├── user.repository.ts
│   └── item.repository.ts
│
├── middleware/         # Custom middleware
├── schemas/            # Zod schemas
├── utils/              # Utilities
└── plugins/            # Fastify plugins
```

## Path Aliases

Use `@/` to import from `src/`:

```typescript
// ✅ Good
import { Logger } from '@/utils/logger'
import { UserService } from '@/services/user.service'

// ❌ Avoid
import { Logger } from '../../../utils/logger'
```

## Dependency Injection

Services are registered as SINGLETON in the container:

```typescript
// Access in routes
const userService = fastify.diContainer.cradle.userService

// Use service
const users = await userService.getAllUsers({ page: 1, limit: 10 })
```

## Creating New Endpoint

**1. Create DTO**

```typescript
// src/dto/product.dto.ts
import { z } from 'zod'

export interface ProductResponseDto {
  id: string
  name: string
  price: number
}

export const createProductDtoSchema = z.object({
  name: z.string().min(1),
  price: z.number().positive(),
})

export type CreateProductDto = z.infer<typeof createProductDtoSchema>
```

**2. Create Repository**

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

**3. Create Service**

```typescript
// src/services/product.service.ts
export class ProductService {
  constructor(private productRepository: IProductRepository) {}

  async createProduct(dto: CreateProductDto) {
    return await this.productRepository.create(dto)
  }
}
```

**4. Create Route**

```typescript
// src/routes/product.routes.ts
import { createProductDtoSchema } from '@/dto/product.dto'
import { NotFoundError } from '@/utils/errors'

export default async function productRoutes(fastify: FastifyInstance) {
  const productService = fastify.diContainer.cradle.productService

  fastify.post('/', {
    schema: { body: createProductDtoSchema }
  }, async (request, reply) => {
    const product = await productService.createProduct(request.body)
    return reply.code(201).send(product)
  })

  fastify.get('/:id', async (request, reply) => {
    const product = await productService.getProductById(request.params.id)
    if (!product) throw new NotFoundError('Product not found')
    return reply.send(product)
  })
}
```

**5. Register in Container**

```typescript
// src/container.ts
container.register({
  productRepository: asClass(ProductRepository, { lifetime: Lifetime.SINGLETON }),
  productService: asClass(ProductService, { lifetime: Lifetime.SINGLETON }),
})

// Add to ICradle interface
export interface ICradle {
  productRepository: IProductRepository
  productService: ProductService
  // ...
}
```

**6. Register Route**

```typescript
// src/routes/index.ts
import productRoutes from './product.routes'

await api.register(productRoutes, { prefix: '/products' })
```

## Database

### Migrations

```bash
# Update schema.prisma, then:
npm run prisma:migrate

# Visual database editor
npm run prisma:studio
```

### Raw Queries

```typescript
// Raw SQL
const users = await prisma.$queryRaw`
  SELECT * FROM "User" WHERE email LIKE ${'%@example.com'}
`
```

## Error Handling

Use custom errors - they're handled automatically:

```typescript
import { 
  ValidationError, 
  NotFoundError, 
  UnauthorizedError,
  BusinessError,
  AlreadyExistsError,
} from '@/utils/errors'

// In services/routes:
throw new NotFoundError('User not found')
throw new ValidationError('Invalid input')
throw new BusinessError('Quantity cannot be negative')
throw new AlreadyExistsError('User', 'email')
```

### Error Response Format

```json
{
  "error": "User not found",
  "code": 404,
  "errorId": "uuid-for-tracking"
}
```

## Environment Variables

Required in `.env`:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/db_name
JWT_SECRET=your-secret-at-least-64-chars
```

Optional:

```bash
PORT=3000
NODE_ENV=development
LOG_LEVEL=debug
REDIS_URL=redis://localhost:6379
ENABLE_SWAGGER=true
```

Generate secure JWT secret:

```bash
openssl rand -base64 64
```

## Testing

```bash
npm test                  # Unit tests
npm run test:watch        # Watch mode
npm run test:coverage     # Coverage report
npm run test:e2e:full     # E2E tests (automated)
```

## Code Quality

```bash
npm run lint              # Fix linting issues
npm run format            # Format code
npm run type-check        # TypeScript validation
npm run precommit         # All checks (runs pre-commit)
```

## Available Scripts

### Development

```bash
npm run dev               # Start with hot reload
npm run docker:up         # Start PostgreSQL + Redis
npm run docker:logs       # View logs
```

### Database

```bash
npm run prisma:generate   # Generate Prisma client
npm run prisma:migrate    # Run migrations
npm run prisma:studio     # Visual editor
npm run prisma:seed       # Seed data
```

### Testing

```bash
npm test                  # Unit tests
npm run test:e2e:full     # E2E tests with setup
npm run test:coverage     # Coverage
```

### Maintenance

```bash
npm run clean             # Remove build artifacts
npm run reset             # Complete reset
```

## Best Practices

### 1. Use Path Aliases

```typescript
// ✅ Good
import { Logger } from '@/utils/logger'

// ❌ Avoid
import { Logger } from '../../../utils/logger'
```

### 2. Keep Services Stateless

```typescript
// ✅ Good
class UserService {
  async getUser(id: string) {
    return await this.userRepository.findById(id)
  }
}

// ❌ Avoid state
class UserService {
  private currentUser: User  // ❌ State!
}
```

### 3. Use Centralized Error Handling

```typescript
// ✅ Good - throw errors
async (request, reply) => {
  const user = await userService.getUser(id)
  if (!user) throw new NotFoundError('User not found')
  return reply.send(user)
}

// ❌ Avoid manual try-catch
async (request, reply) => {
  try {
    const user = await userService.getUser(id)
    return reply.send(user)
  } catch (error) {
    return reply.code(500).send({ error: 'Failed' })
  }
}
```

### 4. Always Type Everything

```typescript
// ✅ Good
async function getUser(id: string): Promise<User | null> {
  return await userRepository.findById(id)
}

// ❌ Avoid any
async function getUser(id: any): Promise<any> {
  return await userRepository.findById(id)
}
```

### 5. Use DTOs for Type Safety

```typescript
// ✅ Good - use DTOs
import { CreateUserDto, UserResponseDto } from '@/dto/user.dto'

async createUser(dto: CreateUserDto): Promise<UserResponseDto> {
  // ...
}

// ❌ Avoid inline types
async createUser(data: any): Promise<any> {
  // ...
}
```

## Troubleshooting

### Port Already in Use

```bash
lsof -i :3000
kill -9 <PID>
```

### Database Issues

```bash
npm run docker:restart    # Restart database
npm run docker:clean      # Reset database
npm run docker:up         # Start fresh
```

### Prisma Issues

```bash
npm run prisma:generate   # Regenerate client
npx prisma migrate reset  # Reset migrations
```

### Hot Reload Not Working

```bash
rm -rf node_modules/.tsx
npm run dev
```

## Logging

```typescript
import { Logger } from '@/utils/logger'

const logger = new Logger('MyComponent')

logger.debug('Detailed info')     // Development only
logger.info('General info')       // Always logged
logger.warn('Warning')            // Warnings
logger.error('Error', error)      // Errors with stack
```

## API Testing

### Using cURL

```bash
# Health check
curl http://localhost:3000/health

# Login
curl -X POST http://localhost:3000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password123"}'

# Authenticated request
curl http://localhost:3000/v1/items \
  -H "Authorization: Bearer <token>"
```

### Using Swagger UI

Open http://localhost:3000/docs

1. Click "Authorize"
2. Login to get token
3. Paste token
4. Test endpoints

## Resources

- [Fastify Documentation](https://www.fastify.io/)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Vitest Documentation](https://vitest.dev/)
- [Zod Documentation](https://zod.dev/)
