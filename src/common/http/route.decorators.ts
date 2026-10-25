import { applyDecorators, HttpCode, HttpStatus, Param } from '@nestjs/common';
import { ParseBigIntPipe } from '../pipes/parse-bigint.pipe';
import { ResponseMessage } from './response-message.decorator';

/** `@IdParam() id: bigint` — a route id parsed to bigint (400 if not a number). */
export const IdParam = (name = 'id') => Param(name, ParseBigIntPipe);

/** For POST actions that change something existing: 200 instead of 201, plus a success message. */
export const Action = (message: string) =>
  applyDecorators(HttpCode(HttpStatus.OK), ResponseMessage(message));
