// Needs a migrated + seeded database (DATABASE_URL in .env).
import '../src/common/json-serialization';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('API (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect({ status: 'ok', db: 'up' });
  });

  it('GET /api/districts returns seeded districts', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/districts')
      .expect(200);
    expect(res.body).toHaveLength(9);
  });

  it('protected route needs a token', () => {
    return request(app.getHttpServer()).get('/api/users/me').expect(401);
  });

  it('rejects unknown query params', () => {
    return request(app.getHttpServer())
      .get('/api/listings?foo=bar')
      .expect(400);
  });
});
