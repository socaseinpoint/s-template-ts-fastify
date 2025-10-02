# Fastify TypeScript Service Template

A production-ready Fastify service template with TypeScript, Swagger, authentication, and comprehensive tooling.

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

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm or yarn
- PostgreSQL (optional, for database)
- Redis (optional, for caching)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd ts-service-template
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Initialize Husky hooks:
```bash
npm run prepare
```

5. (Optional) Set up database:
```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate
```

## Development

### Available Scripts

```bash
# Development mode with hot reload
npm run dev

# Build the project
npm run build

# Start production server
npm start

# Start in development mode (without hot reload)
npm run start:dev

# Run linting
npm run lint          # Auto-fix issues
npm run lint:check    # Check without fixing

# Format code
npm run format        # Auto-format
npm run format:check  # Check formatting

# Type checking
npm run type-check

# Run tests
npm run test          # Run once
npm run test:watch    # Watch mode
npm run test:ui       # UI mode
npm run test:coverage # With coverage

# Prisma commands (if using database)
npm run prisma:generate  # Generate Prisma client
npm run prisma:migrate   # Run migrations
npm run prisma:studio    # Open Prisma Studio
```

## API Documentation

When the server is running, Swagger documentation is available at:

```
http://localhost:3000/docs
```

### Available Endpoints

#### System
- `GET /` - Welcome endpoint
- `GET /health` - Health check

#### Authentication
- `POST /auth/login` - User login
- `POST /auth/register` - User registration
- `POST /auth/refresh` - Refresh access token
- `POST /auth/logout` - User logout

#### Users (Protected)
- `GET /users` - Get all users (paginated)
- `GET /users/:id` - Get user by ID
- `PUT /users/:id` - Update user
- `DELETE /users/:id` - Delete user

#### Items (Protected)
- `GET /items` - Get all items (paginated, filtered)
- `GET /items/:id` - Get item by ID
- `POST /items` - Create new item
- `PUT /items/:id` - Update item
- `DELETE /items/:id` - Delete item
- `POST /items/batch-delete` - Delete multiple items

## Configuration

### Environment Variables

Configure your service using environment variables. See `.env.example`:

```env
# Node environment
NODE_ENV=development

# Server configuration
PORT=3000
HOST=0.0.0.0
LOG_LEVEL=info

# Service info
SERVICE_NAME=fastify-service
SERVICE_VERSION=1.0.0

# Database (PostgreSQL)
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# Redis
REDIS_URL=redis://localhost:6379
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=

# Security
JWT_SECRET=your-super-secret-jwt-key
API_KEY=your-api-key

# CORS
CORS_ORIGIN=*

# Feature flags
ENABLE_METRICS=false
ENABLE_HEALTH_CHECK=true
ENABLE_SWAGGER=true
```

## Authentication & Authorization

The template uses Bearer token authentication with role-based access control (RBAC).

### User Roles

- **admin** - Full access to all resources
- **moderator** - Can create and update items, view users
- **user** - Can view items and own profile

### Test Credentials

```
Admin:
  Email: admin@example.com
  Password: password123

Moderator:
  Email: moderator@example.com
  Password: password123

Regular User:
  Email: user@example.com
  Password: password123
```

### Authorization Header

Include the token in the Authorization header:

```http
Authorization: Bearer your-access-token
```

### Public Endpoints

Endpoints that don't require authentication:
- `/health`
- `/docs`
- `/auth/*`
- `/`

### Protected Endpoints by Role

| Endpoint | Method | Required Role |
|----------|--------|--------------|
| `/items` | GET | Any authenticated user |
| `/items/:id` | GET | Any authenticated user |
| `/items` | POST | Moderator or Admin |
| `/items/:id` | PUT | Moderator or Admin |
| `/items/:id` | DELETE | Admin only |
| `/items/batch-delete` | POST | Admin only |
| `/users` | GET | Admin only |
| `/users/:id` | GET | Own profile or Admin |
| `/users/:id` | PUT | Own profile or Admin |
| `/users/:id` | DELETE | Admin only |

## Path Aliases

The template supports TypeScript path aliases for cleaner imports:

```typescript
// Instead of:
import { Logger } from '../../../utils/logger'

// You can use:
import { Logger } from '@/utils/logger'
```

The `@/` alias points to the `src/` directory.

## Database (Optional)

The template includes Prisma ORM setup for PostgreSQL:

1. Configure `DATABASE_URL` in `.env`
2. Modify `prisma/schema.prisma` for your needs
3. Generate Prisma client: `npm run prisma:generate`
4. Run migrations: `npm run prisma:migrate`
5. Open Prisma Studio: `npm run prisma:studio`

## Redis (Optional)

Redis support is included for **distributed token storage**:

1. Configure Redis connection in `.env`:
   ```env
   REDIS_URL=redis://localhost:6379
   # OR
   REDIS_HOST=127.0.0.1
   REDIS_PORT=6379
   REDIS_PASSWORD=your-password
   ```
2. The server will automatically:
   - Use Redis for JWT token storage if available (recommended for production)
   - Fall back gracefully to in-memory storage if Redis is unavailable
3. Redis features:
   - Refresh token management with automatic TTL
   - Token blacklisting for logout
   - Multi-device session support
   - Distributed system ready

## Testing

### Test Structure

The project uses a **pragmatic two-tier testing strategy**:

```
tests/
├── unit/           # Unit tests - Fast, isolated, mocked
│   ├── services/   # Business logic tests
│   ├── utils/      # Utility function tests
│   ├── middleware/ # Middleware tests
│   └── routes/     # Route handler tests
├── e2e/            # End-to-end tests - Real server, real database
│   └── *.e2e.test.ts
├── fixtures/       # Test data
│   ├── users.fixture.ts
│   └── items.fixture.ts
├── mocks/          # Mock implementations
│   ├── redis.mock.ts
│   └── database.mock.ts
├── helpers/        # Test utilities
│   ├── test-server.ts
│   └── test-utils.ts
└── setup/          # Setup and teardown
    └── setup.ts
```

### Quick Start

```bash
# Run unit tests (fast, no setup required)
npm test

# Run E2E tests (requires Docker)
npm run test:e2e:full
```

### Test Types

**Unit Tests** (`tests/unit/`) - **43 tests ✅**
- ⚡ Fast execution (< 1 second)
- 🎯 Test business logic in isolation
- 🔧 Fully mocked dependencies
- ✅ Always pass (no external dependencies)
- 💯 High code coverage (70%+ required)

**E2E Tests** (`tests/e2e/`) - **15 tests**
- 🚀 Test complete user flows
- 🗄️ Real PostgreSQL database
- 🌐 Real HTTP requests
- 🐳 Managed via Docker Compose
- ⏱️ Slower execution (1-2 seconds per test)

### Running Tests

```bash
# Unit tests (default - fast, always works)
npm test                    # Run all unit tests
npm run test:unit           # Same as above
npm run test:unit:watch     # Watch mode
npm run test:coverage       # With coverage report

# E2E tests (requires setup)
npm run test:e2e:full       # Full automated E2E (recommended)
npm run test:e2e            # E2E only (server must be running)

# Development
npm run test:watch          # Watch mode for all tests
npm run test:ui             # Interactive UI
npm run test:changed        # Test only changed files

# CI/CD
npm run test:ci             # Unit tests with coverage for CI
```

### E2E Test Setup

E2E tests require a **real PostgreSQL database** (via Docker).

**Automated (Recommended):**
```bash
npm run test:e2e:full
```

This script automatically:
1. Starts PostgreSQL on port 5433 (Docker)
2. Runs migrations
3. Seeds test data
4. Starts test server on port 3001
5. Runs E2E tests
6. Cleans up

**Manual Setup:**
```bash
# 1. Start test database
npm run docker:test:up

# 2. Run migrations and seed
export DATABASE_URL="postgresql://testuser:testpassword@localhost:5433/fastify_test"
npm run prisma:migrate
npm run prisma:seed

# 3. Start test server (in separate terminal)
DATABASE_URL="postgresql://testuser:testpassword@localhost:5433/fastify_test" \
PORT=3001 npm run start:dev

# 4. Run E2E tests (in another terminal)
npm run test:e2e

# 5. Cleanup
npm run docker:test:down
```

**See `E2E_TESTING.md` for detailed E2E testing guide.**

### Test Coverage Goals

- **Unit Tests**: ≥ 80% coverage (enforced in CI)
- **E2E Tests**: Critical user flows covered

View coverage report:
```bash
npm run test:coverage
# Open coverage/index.html in browser
```

### Writing Tests

**Example Unit Test:**
```typescript
import { describe, it, expect } from 'vitest'
import { PasswordUtils } from '@/utils/password'

describe('PasswordUtils', () => {
  it('should validate strong password', () => {
    const result = PasswordUtils.validateStrength('Strong123!')
    expect(result.valid).toBe(true)
  })
})
```

**Example Integration Test:**
```typescript
import { describe, it, expect, beforeAll } from 'vitest'
import { getTestServer } from '@tests/helpers/test-server'

describe('POST /auth/login', () => {
  let server: FastifyInstance
  
  beforeAll(async () => {
    server = await getTestServer()
  })

  it('should login with valid credentials', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'test@example.com', password: 'Test123!' }
    })
    
    expect(response.statusCode).toBe(200)
    expect(response.json()).toHaveProperty('accessToken')
  })
})
```

**Example E2E Test:**
```typescript
import { describe, it, expect } from 'vitest'
import axios from 'axios'

describe('Complete Auth Flow', () => {
  it('should register, login, and access protected route', async () => {
    const api = axios.create({ baseURL: 'http://localhost:3000' })
    
    // 1. Register
    const registerRes = await api.post('/auth/register', {
      email: 'newuser@example.com',
      password: 'Password123!',
      name: 'New User'
    })
    expect(registerRes.status).toBe(201)
    
    // 2. Login
    const loginRes = await api.post('/auth/login', {
      email: 'newuser@example.com',
      password: 'Password123!'
    })
    const token = loginRes.data.accessToken
    
    // 3. Access protected route
    const protectedRes = await api.get('/items', {
      headers: { Authorization: `Bearer ${token}` }
    })
    expect(protectedRes.status).toBe(200)
  })
})
```

### Test Fixtures and Helpers

**Using Fixtures:**
```typescript
import { testUsers } from '@tests/fixtures/users.fixture'

// Use predefined test users
const adminUser = testUsers.admin
```

**Using Test Helpers:**
```typescript
import { getAuthToken, wait } from '@tests/helpers/test-utils'

// Get authenticated token
const token = await getAuthToken(server, 'admin@example.com', 'Admin123!')

// Wait for async operations
await wait(1000)
```

### Test Coverage Goals

- **Unit Tests**: ≥ 80% coverage (configured in `vitest.config.ts`)
- **Integration Tests**: All API endpoints covered
- **E2E Tests**: Critical user flows covered

View coverage report:
```bash
npm run test:coverage
# Open coverage/index.html in browser to see detailed report
```

### Test Environment

Tests run with a separate `.env.test` configuration:
- Separate test database
- Test Redis instance (or mocked)
- Test JWT secrets (never use production secrets!)
- Silent logging to reduce noise

### Continuous Integration

Tests are designed to run in CI/CD pipelines:

```bash
npm run test:ci  # Runs with JSON reporter for CI
```

Example GitHub Actions workflow:
```yaml
- name: Run tests
  run: npm run test:ci
  
- name: Upload coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/coverage-final.json
```

### Best Practices

1. **Arrange-Act-Assert**: Structure tests clearly
2. **Descriptive names**: Use `it('should do X when Y')` format
3. **One assertion focus**: Test one thing per test case
4. **Mock external dependencies**: Keep unit tests fast and isolated
5. **Clean up**: Use `afterEach` / `afterAll` for cleanup
6. **Use fixtures**: Reuse test data across tests
7. **Test edge cases**: Don't just test happy paths

## Error Handling

Custom error classes are provided:

```typescript
import { AppError, ValidationError, NotFoundError } from '@/utils/errors'

// Throw custom errors
throw new ValidationError('Invalid input')
throw new NotFoundError('Resource not found')
throw new AppError('Custom error', 500)
```

## Logging

Structured logging with different levels:

```typescript
import { Logger } from '@/utils/logger'

const logger = new Logger('MyService')
logger.error('Error message', error)
logger.warn('Warning message')
logger.info('Info message')
logger.debug('Debug message')
```

## Deployment

### Building for Production

```bash
npm run build
```

The compiled JavaScript will be in the `dist/` directory.

### Running in Production

```bash
NODE_ENV=production npm start
```

### Docker Support

Create a `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci --only=production
RUN npm run prisma:generate

# Copy built application
COPY dist ./dist

# Expose port
EXPOSE 3000

# Start server
CMD ["npm", "start"]
```

Build and run:
```bash
npm run build
docker build -t fastify-service .
docker run -p 3000:3000 --env-file .env fastify-service
```

## Performance Tips

1. **Connection Pooling**: Use connection pooling for database
2. **Caching**: Implement Redis caching for frequently accessed data
3. **Compression**: Enable compression for responses
4. **Rate Limiting**: Implement rate limiting for API endpoints
5. **Monitoring**: Use APM tools for production monitoring

## Security Best Practices

1. Always use HTTPS in production
2. Keep dependencies updated
3. Use strong JWT secrets
4. Implement rate limiting
5. Validate all inputs
6. Sanitize user data
7. Use CORS appropriately
8. Enable security headers

## Contributing

1. Create a feature branch
2. Make your changes
3. Ensure all tests pass
4. Submit a pull request

## License

ISC

## Support

For issues and questions, please open an issue in the repository.
