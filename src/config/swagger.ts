import { SwaggerOptions } from '@fastify/swagger'
import { FastifySwaggerUiOptions } from '@fastify/swagger-ui'
import { jsonSchemaTransform } from 'fastify-type-provider-zod'
import { Config } from '@/config'

export const swaggerConfig: SwaggerOptions = {
  transform: jsonSchemaTransform,
  openapi: {
    info: {
      title: 'Fastify Service Template API',
      description: 'API documentation for Fastify Service Template',
      version: Config.SERVICE_VERSION,
    },
    externalDocs: {
      url: 'https://github.com/your-org/fastify-service-template',
      description: 'Find more info here',
    },
    servers: [
      {
        url:
          Config.NODE_ENV === 'production'
            ? 'https://api.example.com'
            : `http://localhost:${Config.PORT}`,
        description: Config.NODE_ENV === 'production' ? 'Production' : 'Development',
      },
    ],
    tags: [
      { name: 'System', description: 'System endpoints' },
      { name: 'Auth', description: 'Authentication endpoints' },
      { name: 'Users', description: 'User management endpoints' },
      { name: 'Items', description: 'Item management endpoints' },
    ],
    components: {
      securitySchemes: {
        Bearer: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter the token with the `Bearer ` prefix, e.g. "Bearer your_token"',
        },
      },
    },
  },
}

export const swaggerUiConfig: FastifySwaggerUiOptions = {
  routePrefix: '/docs',
  uiConfig: {
    docExpansion: 'list',
    deepLinking: true,
    tryItOutEnabled: true,
    displayRequestDuration: true,
    filter: true,
  },
  staticCSP: false,
  transformStaticCSP: header => header,
}
