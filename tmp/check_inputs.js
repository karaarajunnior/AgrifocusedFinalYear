import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const shops = await prisma.user.findMany({
    where: { role: 'AGRO_SHOP' },
    select: { id: true, name: true }
  });
  console.log('Agro Shops in DB:', shops);

  const inputs = await prisma.agroInput.findMany({
    select: {
      category: true
    }
  });
  console.log('Categories in DB:', [...new Set(inputs.map(i => i.category))]);
  console.log('Sample records count:', inputs.length);
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
