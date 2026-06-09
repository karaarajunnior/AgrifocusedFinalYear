import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log('Seeding market prices...');

    // Clear existing prices
    await prisma.marketPrice.deleteMany({});

    const commodities = [
        { name: 'Arabica Coffee', local: 4500, regional: 6500, export: 9500 },
        { name: 'Robusta Coffee', local: 3500, regional: 5000, export: 7500 },
        { name: 'Maize', local: 900, regional: 1400, export: 2100 },
        { name: 'Beans', local: 3200, regional: 4200, export: 5600 },
        { name: 'Tomatoes', local: 800, regional: 1600, export: 2500 },
        { name: 'Bananas', local: 1000, regional: 1800, export: 2800 },
    ];
    const regions = ['Central', 'Western', 'Eastern', 'Nile'];

    const data = [];

    for (const commodity of commodities) {
        for (const region of regions) {
            // Local Middleman Price (Lowest)
            data.push({
                commodity: commodity.name,
                region,
                marketType: 'LOCAL',
                pricePerKg: commodity.local + Math.random() * 300,
                currency: 'UGX',
            });

            // DAFIS Direct Marketplace Price (Middle)
            data.push({
                commodity: commodity.name,
                region,
                marketType: 'REGIONAL',
                pricePerKg: commodity.regional + Math.random() * 400,
                currency: 'UGX',
            });

            // International Export Price (Highest)
            data.push({
                commodity: commodity.name,
                region,
                marketType: 'EXPORT',
                pricePerKg: commodity.export + Math.random() * 600,
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
