export interface MapLocation {
	location?: string | null;
	latitude?: number | string | null;
	longitude?: number | string | null;
	zoom?: number;
}

function toNumber(value: number | string | null | undefined): number | null {
	if (value === null || value === undefined || value === "") return null;
	const parsed = typeof value === "number" ? value : Number(value);
	return Number.isFinite(parsed) ? parsed : null;
}

export function parseCoordinateText(location?: string | null): { latitude: number; longitude: number } | null {
	if (!location) return null;
	const match = location.trim().match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
	if (!match) return null;

	const latitude = Number(match[1]);
	const longitude = Number(match[2]);
	if (
		Number.isFinite(latitude) &&
		Number.isFinite(longitude) &&
		latitude >= -90 &&
		latitude <= 90 &&
		longitude >= -180 &&
		longitude <= 180
	) {
		return { latitude, longitude };
	}
	return null;
}

export function buildMapUrl({ location, latitude, longitude, zoom = 17 }: MapLocation): string | null {
	const lat = toNumber(latitude);
	const lng = toNumber(longitude);
	const parsed = lat !== null && lng !== null ? { latitude: lat, longitude: lng } : parseCoordinateText(location);

	if (parsed) {
		return `https://www.google.com/maps/search/?api=1&query=${parsed.latitude},${parsed.longitude}&z=${zoom}`;
	}

	const text = location?.trim();
	if (!text) return null;
	return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}`;
}

export function openMapLocation(input: MapLocation): boolean {
	const url = buildMapUrl(input);
	if (!url) return false;
	window.open(url, "_blank", "noopener,noreferrer");
	return true;
}
