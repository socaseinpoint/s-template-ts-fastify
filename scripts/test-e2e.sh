#!/bin/bash

# E2E Test Runner Script
# Manages test database and server lifecycle
#
# Usage:
#   npm run test:e2e:full              # Normal run (keeps volumes for speed)
#   CLEAN=true npm run test:e2e:full   # Full cleanup (removes volumes)
#
# The script keeps Docker volumes by default to speed up repeated runs.
# Use CLEAN=true to completely reset the database.

set -e

echo "🧪 Starting E2E Test Setup..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test database connection
export TEST_DATABASE_URL="postgresql://testuser:testpassword@localhost:5433/fastify_test"

# Check if full cleanup requested
FULL_CLEANUP=${CLEAN:-false}

# Cleanup function
cleanup() {
  echo -e "\n${YELLOW}🧹 Cleaning up...${NC}"
  
  # Kill test server if running
  if [ ! -z "$SERVER_PID" ]; then
    echo "Stopping test server (PID: $SERVER_PID)..."
    kill $SERVER_PID 2>/dev/null || true
    wait $SERVER_PID 2>/dev/null || true
  fi
  
  # Docker cleanup strategy
  if [ "$FULL_CLEANUP" = "true" ]; then
    echo "🗑️  Full cleanup: removing containers and volumes..."
    docker compose -f docker-compose.test.yml down -v
  else
    echo "💾 Soft cleanup: stopping containers (keeping volumes for next run)..."
    echo "   Tip: Use CLEAN=true for full cleanup"
    docker compose -f docker-compose.test.yml stop
  fi
  
  echo -e "${GREEN}✅ Cleanup complete${NC}"
}

# Trap EXIT to ensure cleanup
trap cleanup EXIT INT TERM

# Step 1: Start test database
echo -e "${YELLOW}📦 Step 1: Starting test database...${NC}"
docker compose -f docker-compose.test.yml up -d postgres-test redis-test

# Wait for database to be healthy
echo "⏳ Waiting for database to be ready..."
for i in {1..30}; do
  if docker compose -f docker-compose.test.yml exec -T postgres-test pg_isready -U testuser -d fastify_test > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Database ready${NC}"
    break
  fi
  if [ $i -eq 30 ]; then
    echo -e "${RED}❌ Database failed to start${NC}"
    exit 1
  fi
  sleep 1
done

# Step 2: Push schema to database
echo -e "\n${YELLOW}📊 Step 2: Pushing schema to database...${NC}"
export DATABASE_URL="$TEST_DATABASE_URL"

if [ "$FULL_CLEANUP" = "true" ]; then
  echo "🔄 Full reset: pushing schema with force-reset..."
  npx prisma db push --force-reset --skip-generate --accept-data-loss
else
  echo "⚡ Quick reset: pushing schema (preserving data structure)..."
  npx prisma db push --skip-generate --accept-data-loss 2>/dev/null || \
    npx prisma db push --force-reset --skip-generate --accept-data-loss
fi

echo -e "${GREEN}✅ Schema pushed to database${NC}"

# Step 3: Seed test data
echo -e "\n${YELLOW}🌱 Step 3: Seeding test data...${NC}"
DATABASE_URL="$TEST_DATABASE_URL" npm run prisma:seed
echo -e "${GREEN}✅ Test data seeded${NC}"

# Step 4: Start test server
echo -e "\n${YELLOW}🚀 Step 4: Starting test server on port 3001...${NC}"
NODE_ENV=test \
USE_ENV_FILE=true \
PORT=3001 \
npm run start:dev > test-server.log 2>&1 &

SERVER_PID=$!
echo "Server PID: $SERVER_PID"

# Wait for server to be ready
echo "⏳ Waiting for server to be ready..."
for i in {1..30}; do
  if curl -s http://localhost:3001/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Server ready on http://localhost:3001${NC}"
    break
  fi
  if [ $i -eq 30 ]; then
    echo -e "${RED}❌ Server failed to start. Check test-server.log for details${NC}"
    cat test-server.log
    exit 1
  fi
  sleep 1
done

# Step 5: Run E2E tests
echo -e "\n${YELLOW}🧪 Step 5: Running E2E tests...${NC}"
E2E_BASE_URL="http://localhost:3001" npm run test:e2e

# Success!
echo -e "\n${GREEN}✅ All E2E tests completed!${NC}"


