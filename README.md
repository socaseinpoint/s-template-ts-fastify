# TypeScript Service Template

A production-ready TypeScript service template with ESLint, Prettier, Husky, and Vitest pre-configured.

## Features

- 🚀 **TypeScript** - Type-safe development with path aliases
- 📝 **ESLint & Prettier** - Code quality and formatting
- 🪝 **Husky** - Git hooks for pre-commit checks
- 🧪 **Vitest** - Fast unit testing and coverage
- 📊 **Health Checks** - Built-in health monitoring
- 📦 **Modular Architecture** - Clean service-based structure
- 🔧 **Environment Config** - Dotenv configuration
- 📖 **Logging** - Structured logging with levels
- 🔄 **Graceful Shutdown** - Proper cleanup on termination
- 🎯 **Path Aliases** - Use `@/` for clean imports from `src/`

## Project Structure

```
ts-service-template/
├── src/
│   ├── config/          # Configuration management
│   │   └── index.ts
│   ├── services/        # Business logic services
│   │   ├── app.service.ts
│   │   ├── health.service.ts
│   │   └── data.service.ts
│   ├── utils/           # Utility functions
│   │   ├── logger.ts
│   │   ├── errors.ts
│   │   └── helpers.ts
│   └── index.ts         # Application entry point
├── .husky/              # Git hooks
├── dist/                # Compiled output
├── coverage/            # Test coverage reports
├── .env.example         # Environment variables template
├── .eslintrc.js         # ESLint configuration
├── .prettierrc          # Prettier configuration
├── tsconfig.json        # TypeScript configuration
├── vitest.config.ts     # Vitest configuration
└── package.json
```

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm or yarn

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
```

4. Initialize Husky hooks:
```bash
npm run prepare
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
```

### Environment Variables

Configure your service using environment variables. See `.env.example` for all available options:

- `NODE_ENV` - Environment (development/production)
- `PORT` - Service port (default: 3000)
- `LOG_LEVEL` - Logging level (error/warn/info/debug)
- `SERVICE_NAME` - Service identifier
- `SERVICE_VERSION` - Service version
- `DATABASE_URL` - Database connection string
- `REDIS_URL` - Redis connection string
- `API_KEY` - API authentication key
- `ENABLE_METRICS` - Enable metrics collection
- `ENABLE_HEALTH_CHECK` - Enable health check endpoint

### Health Check

When `ENABLE_HEALTH_CHECK=true`, the service exposes a health endpoint at:

```
GET http://localhost:3001/health
```

Response example:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "service": "ts-service",
  "version": "1.0.0",
  "uptime": 123456,
  "checks": {
    "memory": {
      "status": "ok",
      "message": "Memory usage: 45.23%"
    },
    "database": {
      "status": "ok",
      "message": "Database connection healthy"
    },
    "redis": {
      "status": "ok",
      "message": "Redis connection healthy"
    }
  }
}
```

## Architecture

### Services

The template follows a service-oriented architecture:

- **AppService** - Main application orchestrator
- **HealthService** - Health monitoring and reporting
- **DataService** - Data management and caching

### Error Handling

Custom error classes are provided in `src/utils/errors.ts`:

```typescript
import { ValidationError, NotFoundError } from '@/utils/errors'

throw new ValidationError('Invalid input')
throw new NotFoundError('Resource not found')
```

### Logging

Structured logging with different levels:

```typescript
import { Logger } from '@/utils/logger'

const logger = new Logger('MyService')
logger.error('Error message', error)
logger.warn('Warning message')
logger.info('Info message')
logger.debug('Debug message')
```

### Path Aliases

The template supports TypeScript path aliases for cleaner imports:

```typescript
// Instead of:
import { Logger } from '../../../utils/logger'

// You can use:
import { Logger } from '@/utils/logger'
```

The `@/` alias points to the `src/` directory. This works in:
- Development mode (`npm run dev`)
- Production builds (`npm run build`)
- Tests (`npm test`)
- Type checking (`npm run type-check`)

### Helper Functions

Common utility functions in `src/utils/helpers.ts`:

- `sleep(ms)` - Delay execution
- `retry(fn, maxRetries)` - Retry with exponential backoff
- `deepClone(obj)` - Deep clone objects
- `isEmpty(value)` - Check for empty values
- `randomString(length)` - Generate random strings
- `chunk(array, size)` - Split arrays into chunks

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

Test files should be placed next to the source files with `.test.ts` or `.spec.ts` extension.

## Git Hooks

Pre-commit hooks automatically run:
1. Linting check
2. Format check
3. Type checking
4. Tests

To bypass hooks (not recommended):
```bash
git commit --no-verify
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

COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist
COPY .env.example .env

EXPOSE 3000

CMD ["npm", "start"]
```

Build and run:
```bash
npm run build
docker build -t ts-service .
docker run -p 3000:3000 --env-file .env ts-service
```

## Contributing

1. Create a feature branch
2. Make your changes
3. Ensure all tests pass
4. Submit a pull request

## License

ISC

## Support

For issues and questions, please open an issue in the repository.
