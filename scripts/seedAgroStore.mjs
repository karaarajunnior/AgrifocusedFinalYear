import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seeding of Agro Store...');

  // 1. Create a Shop User
  const shopEmail = 'jinja.agro@example.com';
  const hashedPassword = await bcrypt.hash('password123', 10);

  let shop = await prisma.user.findUnique({
    where: { email: shopEmail }
  });

  if (!shop) {
    shop = await prisma.user.create({
      data: {
        name: 'Jinja Agro Center',
        email: shopEmail,
        password: hashedPassword,
        role: 'AGRO_SHOP',
        location: 'Jinja Main Street',
        verified: true,
        phone: '+256701234567'
      }
    });
    console.log('Created Agro Shop user:', shop.name);
  } else {
    console.log('Agro Shop user already exists');
  }

  // 2. Clear existing inputs for this shop (to avoid duplicates during development)
  await prisma.agroInput.deleteMany({
    where: { shopId: shop.id }
  });

  // 3. Seed Agro Inputs
  const inputs = [
    {
      name: 'NPK 17-17-17 Fertilizer',
      description: 'Balanced multi-purpose fertilizer for all crops. Improves yield and plant health.',
      price: 150000,
      unit: '50kg Bag',
      category: 'Fertilizer',
      shopId: shop.id
    },
    {
      name: 'Organic Compost (Premium)',
      description: 'High-quality decomposed organic matter. Fixes soil structure and nutrients.',
      price: 25000,
      unit: '25kg Bag',
      category: 'Fertilizer',
      shopId: shop.id
    },
    {
      name: 'Arabica Coffee Seedlings',
      description: 'Disease-resistant high-yield Arabica seedlings. 6 months old, ready for transplanting.',
      price: 2500,
      unit: 'Seedling',
      category: 'Seedling',
      shopId: shop.id
    },
    {
      name: 'Hybrid Maize Seeds (Longe 5)',
      description: 'Drought-tolerant hybrid maize seeds. High germination rate.',
      price: 12000,
      unit: '2kg Pack',
      category: 'Seedling',
      shopId: shop.id
    },
    {
      name: 'Precision Hand Hoe',
      description: 'Forged steel blade with ergonomic wooden handle. Durable and lightweight.',
      price: 15000,
      unit: 'Item',
      category: 'Tools',
      shopId: shop.id
    },
    {
      name: 'Knapsack Sprayer (16L)',
      description: 'Manual pressure sprayer for pesticides and fertilizers. Comfortable straps.',
      price: 85000,
      unit: 'Item',
      category: 'Tools',
      shopId: shop.id
    },
    {
      name: 'Bio-Guard Pest Control',
      description: 'Eco-friendly pesticide effective against common crop pests. Safe for pollinators.',
      price: 45000,
      unit: '500ml Bottle',
      category: 'Pesticide',
      shopId: shop.id
    }
  ];

  for (const input of inputs) {
    await prisma.agroInput.create({
      data: input
    });
  }

  console.log(`Successfully seeded ${inputs.length} agro-input items.`);
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
