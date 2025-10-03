# Unit Tests Structure

This directory mirrors the `src/` structure for easy navigation.

```
tests/unit/
├── modules/              # Mirror of src/modules
│   ├── auth/
│   │   ├── auth.service.test.ts
│   │   ├── auth.controller.test.ts (todo)
│   │   └── ...
│   ├── users/
│   │   ├── user.service.test.ts (todo)
│   │   ├── user.repository.test.ts (todo)
│   │   └── ...
│   └── items/
│       ├── item.service.test.ts (todo)
│       └── ...
│
└── shared/               # Mirror of src/shared
    ├── utils/
    │   ├── password.test.ts
    │   ├── helpers.test.ts
    │   └── ...
    ├── middleware/
    │   └── auth.middleware.test.ts (todo)
    └── ...
```

## Guidelines

1. **Mirror structure**: Test files should be in the same relative path as source files
2. **Naming**: `<filename>.test.ts` for the source file `<filename>.ts`
3. **Co-location benefits**: Easy to find tests for any module
4. **Module isolation**: Each module's tests are self-contained

## Example

```typescript
// src/modules/users/user.service.ts
// tests/unit/modules/users/user.service.test.ts

// src/shared/utils/logger.ts  
// tests/unit/shared/utils/logger.test.ts
```

