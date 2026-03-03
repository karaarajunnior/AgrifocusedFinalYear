import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log('Seeding market prices...');

    // Clear existing prices
    await prisma.marketPrice.deleteMany({});

    const commodities = ['Arabic Coffee', 'Robusta Coffee'];
    const regions = ['Central', 'Western', 'Eastern', 'Nile'];

    const data = [];

    for (const commodity of commodities) {
        for (const region of regions) {
            // Local Middleman Price (Lowest)
            data.push({
                commodity,
                region,
                marketType: 'LOCAL',
                pricePerKg: commodity === 'Arabic Coffee' ? 4500 + Math.random() * 500 : 3500 + Math.random() * 500,
                currency: 'UGX',
            });

            // DAFIS Direct Marketplace Price (Middle)
            data.push({
                commodity,
                region,
                marketType: 'REGIONAL',
                pricePerKg: commodity === 'Arabic Coffee' ? 6500 + Math.random() * 500 : 5000 + Math.random() * 500,
                currency: 'UGX',
            });

            // International Export Price (Highest)
            data.push({
                commodity,
                region,
                marketType: 'EXPORT',
                pricePerKg: commodity === 'Arabic Coffee' ? 9500 + Math.random() * 1000 : 7500 + Math.random() * 1000,
                currency: 'UGX',
            });
        }
    }

    await prisma.marketPrice.createMany({ data });
    console.log('Successfully seeded market prices.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
