// Combined validation decorators, so a DTO field needs one line instead of four or five.
// Swagger types come from the CLI plugin (nest-cli.json). These decorators only add
// what the plugin can't see: ranges, enums and lengths.
import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

interface Range {
  min?: number;
  max?: number;
}

function range({ min, max }: Range, required?: boolean) {
  return [
    ...(min !== undefined ? [Min(min)] : []),
    ...(max !== undefined ? [Max(max)] : []),
    ApiProperty({ minimum: min, maximum: max, required }),
  ];
}

// ---------------------------------------------------------------- body fields

export const Int = (r: Range = {}) => applyDecorators(IsInt(), ...range(r));

export const OptionalInt = (r: Range = {}) =>
  applyDecorators(IsOptional(), Int(r));

/** Decimal number, e.g. area or coordinates. */
export const Decimal = (decimals: number, r: Range = {}) =>
  applyDecorators(IsNumber({ maxDecimalPlaces: decimals }), ...range(r));

export const Text = (min: number, max: number) =>
  applyDecorators(
    IsString(),
    Length(min, max),
    ApiProperty({ minLength: min, maxLength: max }),
  );

export const OptionalText = (max: number) =>
  applyDecorators(IsOptional(), Text(0, max));

export const OptionalBoolean = () => applyDecorators(IsOptional(), IsBoolean());

export const Enum = (e: object) =>
  applyDecorators(IsEnum(e), ApiProperty({ enum: e }));

export const OptionalEnum = (e: object) =>
  applyDecorators(
    IsOptional(),
    IsEnum(e),
    ApiProperty({ enum: e, required: false }),
  );

/** Trimmed + lowercased, so `Bat@Mail.mn ` and `bat@mail.mn` are the same account. */
export const Email = () =>
  applyDecorators(
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' ? value.trim().toLowerCase() : value,
    ),
    IsEmail(),
    MaxLength(255),
  );

/** Mongolian or international number: 8–15 digits, optional leading +. */
export const OptionalPhone = () =>
  applyDecorators(
    IsOptional(),
    Matches(/^\+?[0-9]{8,15}$/, { message: 'phone must be 8–15 digits' }),
  );

/** Trims surrounding whitespace before validation. */
export const Trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );

// ---------------------------------------------------------------- query params (arrive as strings)

export const QueryInt = (r: Range = {}) =>
  applyDecorators(
    IsOptional(),
    Type(() => Number),
    IsInt(),
    ...range(r, false),
  );

export const QueryNumber = (r: Range = {}) =>
  applyDecorators(
    IsOptional(),
    Type(() => Number),
    IsNumber(),
    ...range(r, false),
  );

/** `?ids=1,2` or `?ids=1&ids=2` → [1, 2]. */
export const QueryIntArray = (maxSize = 20) =>
  applyDecorators(
    IsOptional(),
    Transform(({ value }: { value: unknown }) => toArray(value)?.map(Number)),
    IsInt({ each: true }),
    ArrayMaxSize(maxSize),
    ApiProperty({
      type: [Number],
      required: false,
      description: 'Comma-separated, e.g. 1,3',
    }),
  );

/** `?flag=true|false|1|0` → boolean. */
export const QueryBoolean = () =>
  applyDecorators(
    IsOptional(),
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'boolean' ? value : value === 'true' || value === '1',
    ),
    IsBoolean(),
  );

function toArray(value: unknown): unknown[] | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (Array.isArray(value)) return value as unknown[];
  return typeof value === 'string' ? value.split(',') : [value];
}
