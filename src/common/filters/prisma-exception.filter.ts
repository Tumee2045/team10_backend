import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '@prisma/client';

/** Turns common Prisma/Postgres errors into proper HTTP responses instead of 500s. */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter extends BaseExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    super.catch(this.toHttp(exception), host);
  }

  private toHttp(e: Prisma.PrismaClientKnownRequestError): Error {
    switch (e.code) {
      case 'P2002': // unique violation (incl. the partial "one pending request" index)
        return new ConflictException('Already exists');
      case 'P2003': // foreign key violation
        return new BadRequestException('Referenced record does not exist');
      case 'P2025': // record to update/delete not found
        return new NotFoundException('Not found');
      default:
        return e;
    }
  }
}
