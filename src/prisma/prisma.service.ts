import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

// passwordHash is never returned unless a query explicitly asks for it
// with `omit: { passwordHash: false }` (only the auth flow does).
const options = {
  omit: { user: { passwordHash: true } },
} satisfies Prisma.PrismaClientOptions;

@Injectable()
export class PrismaService
  extends PrismaClient<typeof options>
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super(options);
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
