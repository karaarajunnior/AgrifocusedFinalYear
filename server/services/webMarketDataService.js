import axios from "axios";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function parseSourcesEnv() {
	// MARKET_DATA_SOURCES_JSON = JSON array of sources:
	// [{ "name":"example", "url":"https://...", "defaultCurrency":"UGX", "market":"local" }]
	const raw = process.env.MARKET_DATA_SOURCES_JSON;
	if (!raw) return [];
	try {
		const arr = JSON.parse(raw);
		return Array.isArray(arr) ? arr : [];
	} catch {
		return [];
	}
}

export async function refreshMarketWebPrices() {
	const sources = parseSourcesEnv();
	const results = [];

	for (const s of sources) {
		const name = String(s.name || "source");
		const url = String(s.url || "");
		if (!url) continue;

		try {
			const res = await axios.get(url, { timeout: 15000 });
			const data = res.data;

			// Expected data format: an array of records:
			// { category?, commodity?, market?, country?, location?, price, currency?, unit?, collectedAt?, sourceUrl? }
			if (!Array.isArray(data)) {
				results.push({ source: name, ok: false, error: "Expected array response" });
				continue;
			}

			let inserted = 0;
			for (const row of data.slice(0, 500)) {
				const price = Number(row.price);
				if (!Number.isFinite(price)) continue;

				await prisma.marketWebPrice.create({
					data: {
						category: row.category || null,
						commodity: row.commodity ? String(row.commodity) : null,
						market: row.market ? String(row.market) : String(s.market || "local"),
						country: row.country ? String(row.country) : String(s.country || null),
						location: row.location ? String(row.location) : null,
						price,
						currency: row.currency ? String(row.currency) : String(s.defaultCurrency || "UGX"),
						unit: row.unit ? String(row.unit) : null,
						source: name,
						sourceUrl: row.sourceUrl ? String(row.sourceUrl) : url,
						collectedAt: row.collectedAt ? new Date(row.collectedAt) : new Date(),
						raw: JSON.stringify(row),
					},
				});
				inserted++;
			}

			results.push({ source: name, ok: true, inserted });
		} catch (e) {
			results.push({ source: name, ok: false, error: e?.message || String(e) });
		}
	}

	return results;
}

