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

## Authentication

The template uses Bearer token authentication. Include the token in the Authorization header:

```http
Authorization: Bearer your-access-token
```

Public endpoints that don't require authentication:
- `/health`
- `/docs`
- `/auth/*`
- `/`

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

Redis support is included for caching and session management:

1. Configure Redis connection in `.env`
2. The server will automatically detect and use Redis if available
3. Falls back gracefully if Redis is unavailable

## Testing

The template uses Vitest for testing:

```bash
# Run tests
npm test

# Watch mode for development
npm run test:watch

# Generate coverage report
npm run test:coverage
```

Test files should be placed next to source files with `.test.ts` or `.spec.ts` extension.

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
