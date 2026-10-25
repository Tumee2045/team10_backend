import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

/** `@Param('id', ParseBigIntPipe) id: bigint` — ids are bigserial in Postgres. */
@Injectable()
export class ParseBigIntPipe implements PipeTransform<string, bigint> {
  transform(value: string): bigint {
    if (!/^\d{1,18}$/.test(value)) {
      throw new BadRequestException('Invalid id');
    }
    return BigInt(value);
  }
}
