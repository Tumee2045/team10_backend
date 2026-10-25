import './common/json-serialization';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { HttpExceptionFilter } from './common/http/http-exception.filter';
import { ResponseInterceptor } from './common/http/response.interceptor';
import { toFieldErrors, ValidationException } from './common/http/validation';
import { SocketIoAdapter } from './realtime/socket-io.adapter';

/** Global app setup shared by main.ts and the e2e tests. */
export function configureApp(app: INestApplication, corsOrigins: string[]) {
  app.setGlobalPrefix('api');
  app.enableCors({ origin: corsOrigins });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) =>
        new ValidationException(toFieldErrors(errors)),
    }),
  );
  app.useGlobalInterceptors(new ResponseInterceptor(app.get(Reflector)));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useWebSocketAdapter(new SocketIoAdapter(app, corsOrigins));
}
