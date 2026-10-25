import { BadRequestException, ValidationError } from '@nestjs/common';
import { FieldError } from './api-response';

/** Thrown by the global ValidationPipe; the exception filter turns it into VALIDATION_ERROR. */
export class ValidationException extends BadRequestException {
  constructor(readonly errors: FieldError[]) {
    super('Validation failed');
  }
}

/** class-validator errors (possibly nested) → flat `[{ field, message }]`. */
export function toFieldErrors(
  errors: ValidationError[],
  parent = '',
): FieldError[] {
  return errors.flatMap((e) => {
    const field = parent ? `${parent}.${e.property}` : e.property;
    const own = Object.values(e.constraints ?? {}).map((message) => ({
      field,
      message,
    }));
    return [...own, ...toFieldErrors(e.children ?? [], field)];
  });
}
