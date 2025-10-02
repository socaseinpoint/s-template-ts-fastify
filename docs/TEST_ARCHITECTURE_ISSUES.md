# Анализ проблем с тестовой архитектурой

**Дата:** 2025-10-02  
**Статус:** Требует рефакторинга  
**Приоритет:** Высокий

## Executive Summary

**Хорошие новости:** Тесты технически работают - все 43 unit теста и все 15 e2e тестов проходят успешно.

**Плохие новости:** Архитектура переусложнена, что делает тесты хрупкими и неудобными для использования.

---

## 🔴 Критические проблемы

### 1. **Over-engineered DI Container** 

**Файл:** `src/container.ts` (177 строк)

**Проблемы:**
- Слишком много шагов инициализации (8 STEP)
- Синхронизация инициализации Prisma для DI
- Хак `serviceRegistry._prismaClient` для ручного disposal
- Сложная логика проверки `prisma.user === 'undefined'`
- ServiceRegistry добавляет сложность без реальной пользы

**Пример текущей проблемы:**
```typescript
// STEP 1: Initialize Prisma FIRST (synchronously for DI)
let prismaClient: PrismaClient

if (!process.env.DATABASE_URL) {
  if (process.env.NODE_ENV === 'test') {
    prismaClient = {} as PrismaClient // Mock для unit тестов
  } else {
    throw new Error('DATABASE_URL is required')
  }
} else {
  prismaClient = new PrismaClient(...)
  await prismaClient.$connect()
}

// STEP 8: Store prisma client for manual disposal (HACK!)
serviceRegistry._prismaClient = prismaClient
```

**Почему это плохо:**
- Трудно понять порядок инициализации
- Легко сломать при добавлении новых сервисов
- Невозможно переиспользовать контейнер для разных типов тестов
- ServiceRegistry создает лишний слой абстракции

### 2. **DatabaseService создает новый PrismaClient на каждый health check**

**Файл:** `src/services/database.service.ts:63-79`

```typescript
async healthCheck(): Promise<boolean> {
  // ❌ ПРОБЛЕМА: Создает новое подключение каждый раз!
  const healthClient = new PrismaClient()
  await healthClient.$queryRaw`SELECT 1`
  await healthClient.$disconnect()
  return true
}
```

**Impact:**
- Health check запускается каждые 30 секунд
- Каждый раз создается новое подключение к БД
- Потребление ресурсов растет линейно со временем
- Connection pool загрязняется

**Правильный подход:**
```typescript
// Использовать существующий prisma client из DI
async healthCheck(): Promise<boolean> {
  await this.prisma.$queryRaw`SELECT 1`
  return true
}
```

### 3. **RedisService - это не сервис, а in-memory mock**

**Файл:** `src/services/redis.service.ts`

**Проблемы:**
```typescript
export class RedisService {
  private cache: Map<string, { value: any; expiry?: number }> // ❌ In-memory, не Redis!
  
  async checkConnection(): Promise<boolean> {
    // ❌ Создает новый socket каждый раз
    const socket = new net.Socket()
    return new Promise(...)
  }
  
  startCleanup(): void {
    setInterval(...) // ❌ Никогда не вызывается, потенциальный memory leak
  }
}
```

**Почему это плохо:**
- Называется "RedisService" но не использует Redis
- checkConnection создает сокет каждые 30 секунд (утечка ресурсов)
- Нет реального Redis клиента (ioredis или node-redis)
- startCleanup никогда не вызывается
- Тесты не проверяют реальное поведение Redis

### 4. **ServiceRegistry - избыточный слой абстракции**

**Файл:** `src/services/service-registry.service.ts`

**Проблемы:**
- Периодические health checks каждые 30 секунд (накладные расходы)
- Дублирует ответственность DatabaseService и RedisService
- Добавляет сложность без реальной пользы
- Хранит `_prismaClient` для manual disposal (плохая практика)

**Что делает:**
```typescript
private startHealthChecks(): void {
  this.healthCheckInterval = setInterval(async () => {
    await Promise.all([this.checkPostgres(), this.checkRedis()])
  }, 30000) // Каждые 30 секунд создает новые подключения!
}
```

### 5. **E2E тесты требуют внешний сервер**

**Проблема:**
- `npm run test:e2e` падает если сервер не запущен
- Нужно запускать `npm run test:e2e:full` для полного цикла
- Требует Docker, PostgreSQL, Redis для простого теста
- Невозможно запустить быстро локально

**Лучшая практика:**
- E2E тесты должны использовать `fastify.inject()` для HTTP запросов
- Не требуют реального `listen()` на порту
- Работают с in-memory базой или временной БД
- Быстрые и изолированные

---

## 🟡 Средние проблемы

### 6. **Отсутствие интеграционных тестов**

Сейчас есть только:
- **Unit тесты** - изолированные, с моками (✅ правильно)
- **E2E тесты** - полный стек с Docker (❌ слишком тяжелые)

**Нет интеграционных тестов:**
- Тестирование реальных HTTP запросов без внешнего сервера
- Использование `fastify.inject()` для HTTP тестов
- Тестирование middleware, routes, validation
- Баланс между unit и e2e

### 7. **Конфигурация тестовой БД не соответствует скрипту**

**`.env.test`:**
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ts_service_db
```

**`scripts/test-e2e.sh`:**
```bash
TEST_DATABASE_URL="postgresql://testuser:testpassword@localhost:5433/fastify_test"
```

**`docker-compose.test.yml`:**
```yaml
ports:
  - '5433:5432'
environment:
  POSTGRES_USER: testuser
  POSTGRES_PASSWORD: testpassword
  POSTGRES_DB: fastify_test
```

**Проблема:** Несоответствие конфигураций приводит к confusion

### 8. **Моки не переиспользуются**

**Файл:** `tests/mocks/prisma.mock.ts`

```typescript
export const prismaMock = mockDeep<PrismaClient>()

// Mock the prisma service module
vi.mock('@/services/prisma.service', ...)
```

**Проблемы:**
- Мокается несуществующий файл `@/services/prisma.service`
- Mock не используется в unit тестах
- Unit тесты создают свои моки вручную
- Дублирование кода моков

---

## 🟢 Что работает хорошо

1. ✅ **Unit тесты правильно изолированы** - создают моки вручную
2. ✅ **Используется Vitest** - современный и быстрый test runner
3. ✅ **E2E скрипт полностью автоматизирован** - setup, seed, run, cleanup
4. ✅ **Тесты покрывают основные сценарии** - auth flow, validation, RBAC
5. ✅ **Docker compose для тестовой БД** - изолированная среда

---

## 📋 Рекомендации по рефакторингу

### Priority 1: Упростить DI Container

**Было (177 строк, 8 STEP):**
```typescript
// Сложная логика с ServiceRegistry, manual disposal, etc.
export async function createDIContainer() {
  // STEP 1-8...
  serviceRegistry._prismaClient = prismaClient // HACK
}
```

**Должно быть (~50 строк):**
```typescript
export async function createDIContainer(options?: ContainerOptions) {
  const prisma = options?.prisma || new PrismaClient()
  
  container.register({
    prisma: asValue(prisma),
    userRepository: asClass(UserRepository).singleton(),
    authService: asClass(AuthService).singleton(),
  })
  
  return { container, dispose: () => container.dispose() }
}
```

### Priority 2: Исправить health checks

**DatabaseService:**
```typescript
export class DatabaseService {
  constructor(private prisma: PrismaClient) {} // Inject Prisma
  
  async healthCheck(): Promise<boolean> {
    await this.prisma.$queryRaw`SELECT 1` // Use injected client
    return true
  }
}
```

### Priority 3: Использовать реальный Redis или убрать его

**Вариант A:** Использовать реальный Redis
```typescript
import Redis from 'ioredis'

export class RedisService {
  private client: Redis
  
  constructor() {
    this.client = new Redis(Config.REDIS_URL)
  }
  
  async get(key: string) {
    return this.client.get(key)
  }
}
```

**Вариант B:** Убрать RedisService если не нужен
- TokenRepository может работать без Redis
- Удалить ServiceRegistry
- Упростить архитектуру

### Priority 4: Добавить интеграционные тесты

**Файл:** `tests/integration/auth.routes.test.ts`
```typescript
import { getTestServer } from '@tests/helpers/test-server'

describe('Auth Routes Integration', () => {
  let app: FastifyInstance
  
  beforeAll(async () => {
    app = await getTestServer() // No listen()
  })
  
  it('should register user', async () => {
    const response = await app.inject({ // No HTTP, direct inject
      method: 'POST',
      url: '/v1/auth/register',
      payload: { email: 'test@test.com', password: 'Test123!' }
    })
    
    expect(response.statusCode).toBe(201)
  })
})
```

### Priority 5: Унифицировать конфигурацию тестов

Создать единый источник правды для тестовых переменных:

**`tests/config/test-config.ts`:**
```typescript
export const TEST_CONFIG = {
  database: {
    host: 'localhost',
    port: 5433,
    user: 'testuser',
    password: 'testpassword',
    database: 'fastify_test',
  },
  server: {
    port: 3001,
  },
}

export const TEST_DATABASE_URL = 
  `postgresql://${TEST_CONFIG.database.user}:${TEST_CONFIG.database.password}@` +
  `${TEST_CONFIG.database.host}:${TEST_CONFIG.database.port}/${TEST_CONFIG.database.database}`
```

---

## 🎯 Action Plan

### Phase 1: Critical Fixes (1-2 часа)
1. ✅ Исправить DatabaseService health check - использовать injected Prisma
2. ✅ Удалить ServiceRegistry или переписать без periodic checks
3. ✅ Упростить DI container - убрать лишние STEP

### Phase 2: Architecture Improvements (2-3 часа)
4. ✅ Добавить интеграционные тесты с `fastify.inject()`
5. ✅ Решить что делать с Redis - либо реальный клиент, либо удалить
6. ✅ Унифицировать конфигурацию тестов

### Phase 3: Nice to Have (1-2 часа)
7. ✅ Создать утилиты для создания тестовых контейнеров
8. ✅ Документировать стратегию тестирования
9. ✅ Добавить coverage thresholds по типам тестов

---

## 🔍 Метрики текущего состояния

| Метрика | Значение | Целевое |
|---------|----------|---------|
| Unit тесты | 43 passed ✅ | Хорошо |
| E2E тесты | 15 passed ✅ | Хорошо |
| Integration тесты | 0 ❌ | 20+ |
| DI Container LOC | 177 🔴 | ~50 |
| Health check overhead | Новый client каждые 30s 🔴 | Reuse existing |
| Время запуска e2e | ~60s 🟡 | ~5s с inject() |
| Test maintainability | 3/10 🔴 | 8/10 |

---

## 📚 Полезные ресурсы

- [Fastify Testing Guide](https://www.fastify.io/docs/latest/Guides/Testing/)
- [Awilix Best Practices](https://github.com/jeffijoe/awilix#best-practices)
- [Vitest Integration Testing](https://vitest.dev/guide/features.html#integration-testing)
- [Prisma Testing Guide](https://www.prisma.io/docs/guides/testing/unit-testing)

---

## Заключение

**TL;DR:** Тесты работают, но архитектура переусложнена. Нужен рефакторинг для упрощения и поддерживаемости.

**Главные проблемы:**
1. 🔴 Over-engineered DI container (177 строк → 50)
2. 🔴 DatabaseService создает новый PrismaClient на каждый health check
3. 🔴 RedisService - fake implementation с утечками ресурсов
4. 🟡 ServiceRegistry - избыточный слой абстракции
5. 🟡 Нет интеграционных тестов

**Рекомендация:** Начать с Phase 1 (критические исправления), затем Phase 2 (архитектура).

