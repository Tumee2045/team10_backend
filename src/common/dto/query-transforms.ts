import { Transform } from 'class-transformer';

/** Query `?ids=1,2` or `?ids=1&ids=2` → [1, 2]. */
export const ToNumberArray = () =>
  Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === null || value === '') return undefined;
    const raw: unknown[] = Array.isArray(value)
      ? value
      : typeof value === 'string'
        ? value.split(',')
        : [value];
    return raw.map((v) => Number(v));
  });

/** Query `?flag=true|false|1|0` → boolean. */
export const ToBoolean = () =>
  Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === '') return undefined;
    if (typeof value === 'boolean') return value;
    return value === 'true' || value === '1';
  });
