import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Response } from 'express';
import { map, Observable } from 'rxjs';
import { ApiSuccess } from './api-response';
import { Page } from './page';
import { RESPONSE_MESSAGE_KEY } from './response-message.decorator';

/** Wraps every successful result in the standard `ApiSuccess` shape. */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiSuccess<unknown>
> {
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiSuccess<unknown>> {
    const message =
      this.reflector.get<string | undefined>(
        RESPONSE_MESSAGE_KEY,
        context.getHandler(),
      ) ?? 'Success';
    const statusCode = context
      .switchToHttp()
      .getResponse<Response>().statusCode;

    return next.handle().pipe(
      map((result) => {
        if (result instanceof Page) {
          return {
            success: true,
            statusCode,
            message,
            data: result.items,
            meta: {
              total: result.total,
              page: result.page,
              limit: result.limit,
              totalPages: Math.ceil(result.total / result.limit),
            },
          };
        }
        return { success: true, statusCode, message, data: result ?? null };
      }),
    );
  }
}
