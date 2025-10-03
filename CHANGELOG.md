# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### 🔒 Security

- **JWT_SECRET now required**: Removed default value for JWT_SECRET. Application will crash on startup if not set. Generate with: `openssl rand -base64 64`
- **Improved CORS validation**: Now validates each origin in comma-separated list. Rejects wildcards in production. Enforces HTTPS in production (except localhost).

### ✨ Features

- **Soft delete support**: Added `deletedAt` field to `User` and `Item` models for soft delete functionality
- **Email verification**: Added `emailVerified`, `emailVerifiedAt` fields to User model
- **User tracking**: Added `lastLoginAt` field to track user login activity
- **Commands documentation**: Added comprehensive `docs/COMMANDS.md` with all Docker and utility commands

### 📝 Configuration

- **Environment template**: Added `.env.example` with all required environment variables and detailed comments
- **Cleaner scripts**: Reduced package.json scripts from 73 to 22 by removing duplicates and rarely-used commands

### 🐛 Fixes

- **CI/CD rollback**: Fixed rollback job in GitHub Actions to use dynamic environment outputs instead of hardcoded values
- **Proper dispose**: InMemoryTokenRepository already has proper dispose() implementation to prevent memory leaks

### 📚 Documentation

- Updated README.md with JWT secret generation step
- Added docs/COMMANDS.md for Docker and advanced commands
- Improved inline documentation in config files

### ⚠️ Breaking Changes

- `JWT_SECRET` environment variable is now **required** - no default value
- Removed 51 npm scripts - check `docs/COMMANDS.md` for Docker commands
- Database schema changes require migration (run `npm run prisma:migrate`)

### 📊 Database Schema Changes

```sql
-- User table
+ emailVerified: boolean (default: false)
+ emailVerifiedAt: DateTime? (nullable)
+ lastLoginAt: DateTime? (nullable)
+ deletedAt: DateTime? (nullable, indexed)

-- Item table
+ deletedAt: DateTime? (nullable, indexed)
```

### 🔄 Migration Guide

1. **Update .env file**:
   ```bash
   cp .env.example .env.new
   # Copy your existing values
   # Generate new JWT_SECRET: openssl rand -base64 64
   mv .env.new .env
   ```

2. **Run database migration**:
   ```bash
   npm run prisma:generate
   npm run prisma:migrate
   ```

3. **Update package.json scripts** (if you have custom ones):
   - Check `docs/COMMANDS.md` for Docker commands
   - Removed duplicate scripts like `dev:all`, `start:api`, etc.

4. **Update CI/CD secrets** (if using GitHub Actions):
   - Ensure `DEPLOY_HOST_STAGING` and `DEPLOY_HOST_PRODUCTION` are set
   - Update any hardcoded paths in deployment scripts

---

## [1.0.0] - 2024-01-01

Initial release with:
- Fastify API with Zod validation
- BullMQ workers with retry logic
- Docker Swarm deployment
- CI/CD with GitHub Actions
- Unit + E2E testing
- Prometheus metrics
- Bull Board UI

