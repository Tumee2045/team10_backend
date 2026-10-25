// JSON.stringify can't handle BigInt (bigserial ids, MNT amounts) and Prisma
// returns numeric columns as Decimal objects. Make both serialize as plain numbers.
// Imported once at the top of main.ts.
import { Prisma } from '@prisma/client';

declare global {
  interface BigInt {
    toJSON(): number | string;
  }
}

BigInt.prototype.toJSON = function (this: bigint) {
  return this <= BigInt(Number.MAX_SAFE_INTEGER) &&
    this >= BigInt(Number.MIN_SAFE_INTEGER)
    ? Number(this)
    : this.toString();
};

(Prisma.Decimal.prototype as unknown as { toJSON: () => number }).toJSON =
  function (this: Prisma.Decimal) {
    return this.toNumber();
  };
