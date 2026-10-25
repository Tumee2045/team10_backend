import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { ApiError, ErrorCode, FieldError } from './api-response';
import { ValidationException } from './validation';

const CODE_BY_STATUS: Record<number, ErrorCode> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  503: 'SERVICE_UNAVAILABLE',
};

/** Prisma error codes that are really client errors, not 500s. */
const PRISMA_ERRORS: Record<string, { status: number; message: string }> = {
  P2002: { status: HttpStatus.CONFLICT, message: 'Already exists' },
  P2003: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Referenced record does not exist',
  },
  P2025: { status: HttpStatus.NOT_FOUND, message: 'Not found' },
};

interface NormalizedError {
  status: number;
  message: string;
  errors?: FieldError[];
}

/** Turns every thrown error into the standard `ApiError` shape. */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();
    const { status, message, errors } = this.normalize(exception);

    if (status >= 500) {
      this.logger.error(
        `${req.method} ${req.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ApiError = {
      success: false,
      statusCode: status,
      error: errors
        ? 'VALIDATION_ERROR'
        : (CODE_BY_STATUS[status] ??
          (status >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST')),
      message,
      ...(errors ? { errors } : {}),
      path: req.url,
      timestamp: new Date().toISOString(),
    };
    res.status(status).json(body);
  }

  private normalize(exception: unknown): NormalizedError {
    if (exception instanceof ValidationException) {
      return {
        status: HttpStatus.BAD_REQUEST,
        message: exception.message,
        errors: exception.errors,
      };
    }

    if (exception instanceof HttpException) {
      return {
        status: exception.getStatus(),
        message: this.messageOf(exception),
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const known = PRISMA_ERRORS[exception.code];
      if (known) return known;
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    };
  }

  /** HttpException responses can be a string or `{ message: string | string[] }`. */
  private messageOf(exception: HttpException): string {
    const response = exception.getResponse();
    if (typeof response === 'string') return response;
    const { message } = response as { message?: string | string[] };
    if (Array.isArray(message)) return message.join(', ');
    return message ?? exception.message;
  }
}
