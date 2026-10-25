import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

const API_DESCRIPTION = `
Team 10 · NestJS + PostgreSQL (Prisma)

Every response uses the same top-level shape:

- Success: \`{ success: true, statusCode, message, data, meta? }\` (\`meta\` only on paged lists)
- Error: \`{ success: false, statusCode, error, message, errors?, path, timestamp }\`

The schemas below describe \`data\`.
`;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  const corsOrigins = config
    .get<string>('CORS_ORIGINS', 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  configureApp(app, corsOrigins);

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Үл хөдлөх хөрөнгийн платформ — API')
    .setDescription(API_DESCRIPTION)
    .setVersion('1.0')
    .addBearerAuth()
    .addSecurityRequirements('bearer')
    .build();
  SwaggerModule.setup('api/docs', app, () =>
    SwaggerModule.createDocument(app, swaggerConfig),
  );

  const port = config.get<number>('PORT', 3000);
  await app.listen(port);
  console.log(`API:  http://localhost:${port}/api`);
  console.log(`Docs: http://localhost:${port}/api/docs`);
}

void bootstrap();
