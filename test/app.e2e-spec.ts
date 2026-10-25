// Needs a migrated + seeded database (DATABASE_URL in .env).
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { ApiError, ApiSuccess } from './../src/common/http/api-response';

describe('API (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app, []);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('wraps success responses', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/health')
      .expect(200);
    expect(res.body).toEqual({
      success: true,
      statusCode: 200,
      message: 'Success',
      data: { database: 'up' },
    });
  });

  it('returns seeded districts in data', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/districts')
      .expect(200);
    const body = res.body as ApiSuccess<unknown[]>;
    expect(body.data).toHaveLength(9);
  });

  it('wraps errors with a code', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/users/me')
      .expect(401);
    expect(res.body).toMatchObject({
      success: false,
      statusCode: 401,
      error: 'UNAUTHORIZED',
    });
  });

  it('lists validation errors per field', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'not-an-email', password: '1', fullName: 'X' })
      .expect(400);
    const body = res.body as ApiError;
    expect(body.error).toBe('VALIDATION_ERROR');
    const fields = (body.errors ?? []).map((e) => e.field);
    expect(fields).toEqual(
      expect.arrayContaining(['email', 'password', 'fullName']),
    );
  });
});
