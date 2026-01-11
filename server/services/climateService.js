import fetch from "node-fetch";
import prisma from "../db/prisma.js";
import locationService from "../utils/locationService.js";

function hoursFromNow(h) {
	return new Date(Date.now() + h * 60 * 60 * 1000);
}

function asAlert({ location, severity, title, body }) {
	return {
		location,
		severity,
		title,
		body,
		source: "open-meteo",
		validFrom: new Date(),
		validTo: hoursFromNow(24),
	};
}

export async function getClimateAlerts({ location }) {
	const loc = String(location || "").trim();
	if (!loc) return { ok: false, error: "location required" };

	// Cache: if recent alerts exist, use them
	const cached = await prisma.climateAlert.findMany({
		where: { location: loc, validTo: { gt: new Date() } },
		orderBy: { createdAt: "desc" },
		take: 10,
	});
	if (cached.length > 0) return { ok: true, alerts: cached, cached: true };

	const coords = await locationService.geocodeLocation(loc);
	const url =
		`https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(coords.lat)}` +
		`&longitude=${encodeURIComponent(coords.lon)}` +
		`&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max` +
		`&forecast_days=2&timezone=auto`;

	let data;
	try {
		const res = await fetch(url, { method: "GET" });
		data = await res.json();
	} catch (e) {
		return { ok: false, error: "weather_fetch_failed" };
	}

	const daily = data?.daily;
	if (!daily) return { ok: false, error: "weather_invalid_response" };

	const maxTemp = Number(daily.temperature_2m_max?.[0] ?? NaN);
	const rain = Number(daily.precipitation_sum?.[0] ?? NaN);
	const wind = Number(daily.wind_speed_10m_max?.[0] ?? NaN);

	const alerts = [];
	if (Number.isFinite(rain) && rain >= 20) {
		alerts.push(
			asAlert({
				location: loc,
				severity: "warning",
				title: "Heavy rain risk (24h)",
				body: "Possible heavy rain. Protect harvested crops and secure storage.",
			}),
		);
	}
	if (Number.isFinite(maxTemp) && maxTemp >= 33) {
		alerts.push(
			asAlert({
				location: loc,
				severity: "warning",
				title: "High heat risk (24h)",
				body: "High temperatures expected. Consider early irrigation and shade for seedlings.",
			}),
		);
	}
	if (Number.isFinite(wind) && wind >= 35) {
		alerts.push(
			asAlert({
				location: loc,
				severity: "info",
				title: "Strong wind risk (24h)",
				body: "Strong winds expected. Secure greenhouses and stacked produce.",
			}),
		);
	}
	if (alerts.length === 0) {
		alerts.push(
			asAlert({
				location: loc,
				severity: "info",
				title: "No major alerts",
				body: "No major weather risks detected for the next 24 hours.",
			}),
		);
	}

	// Persist cache
	const created = await prisma.climateAlert.createMany({
		data: alerts.map((a) => ({
			location: a.location,
			severity: a.severity,
			title: a.title,
			body: a.body,
			source: a.source,
			validFrom: a.validFrom,
			validTo: a.validTo,
		})),
	});

	const stored = await prisma.climateAlert.findMany({
		where: { location: loc, validTo: { gt: new Date() } },
		orderBy: { createdAt: "desc" },
		take: 10,
	});

	return { ok: true, alerts: stored, cached: false, createdCount: created.count };
}

