// Seeds lookup data (districts, amenities) and the first ADMIN account.
// Safe to run multiple times: everything is upserted.
// Run: npm run db:seed
import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DISTRICTS = [
  'Баянзүрх',
  'Сүхбаатар',
  'Хан-Уул',
  'Чингэлтэй',
  'Баянгол',
  'Сонгинохайрхан',
  'Налайх',
  'Багануур',
  'Багахангай',
];

const AMENITIES: { code: string; name: string }[] = [
  { code: 'PARKING', name: 'Авто зогсоол' },
  { code: 'ELEVATOR', name: 'Цахилгаан шат' },
  { code: 'FURNISHED', name: 'Тавилгатай' },
  { code: 'WIFI', name: 'Интернэт (Wi-Fi)' },
  { code: 'BALCONY', name: 'Тагт' },
  { code: 'PETS_ALLOWED', name: 'Тэжээвэр амьтан зөвшөөрнө' },
  { code: 'WASHING_MACHINE', name: 'Угаалгын машин' },
  { code: 'REFRIGERATOR', name: 'Хөргөгч' },
  { code: 'AIR_CONDITIONER', name: 'Агааржуулагч' },
  { code: 'CENTRAL_HEATING', name: 'Төвийн халаалт' },
  { code: 'SECURITY', name: 'Харуул хамгаалалт' },
  { code: 'CCTV', name: 'Хяналтын камер' },
  { code: 'PLAYGROUND', name: 'Хүүхдийн тоглоомын талбай' },
];

async function main() {
  for (const name of DISTRICTS) {
    await prisma.district.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  for (const a of AMENITIES) {
    await prisma.amenity.upsert({
      where: { code: a.code },
      update: { name: a.name },
      create: a,
    });
  }

  const email = (
    process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com'
  ).toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'Admin12345';
  await prisma.user.upsert({
    where: { email },
    update: { role: UserRole.ADMIN },
    create: {
      email,
      passwordHash: await bcrypt.hash(password, 10),
      fullName: 'Admin',
      role: UserRole.ADMIN,
    },
  });

  console.log(
    `Seeded ${DISTRICTS.length} districts, ${AMENITIES.length} amenities, admin <${email}>.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
