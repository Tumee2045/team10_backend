import { BadRequestException } from '@nestjs/common';
import { ParseBigIntPipe } from './parse-bigint.pipe';

describe('ParseBigIntPipe', () => {
  const pipe = new ParseBigIntPipe();

  it('parses numeric ids', () => {
    expect(pipe.transform('42')).toBe(42n);
  });

  it.each(['abc', '-1', '1.5', '', '1234567890123456789'])(
    'rejects %p',
    (value) => {
      expect(() => pipe.transform(value)).toThrow(BadRequestException);
    },
  );
});
