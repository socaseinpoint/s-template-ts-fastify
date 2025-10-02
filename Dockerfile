# Multi-stage Dockerfile for TypeScript Service

# Base stage
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

# Dependencies stage
FROM base AS deps
COPY package*.json ./
RUN npm ci --only=production

# Development dependencies stage
FROM base AS dev-deps
COPY package*.json ./
RUN npm ci

# Build stage
FROM base AS builder
COPY package*.json ./
COPY --from=dev-deps /app/node_modules ./node_modules
COPY tsconfig*.json ./
COPY src ./src
COPY prisma ./prisma
RUN npm run build
RUN npx prisma generate

# Development stage
FROM base AS development
ENV NODE_ENV=development
COPY package*.json ./
COPY --from=dev-deps /app/node_modules ./node_modules
COPY tsconfig*.json ./
COPY prisma ./prisma
RUN npx prisma generate
EXPOSE 3000
CMD ["npm", "run", "dev"]

# Production stage
FROM base AS production
ENV NODE_ENV=production
COPY package*.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma
EXPOSE 3000
CMD ["npm", "start"]
