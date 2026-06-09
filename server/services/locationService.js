import axios from 'axios';

class LocationService {
	constructor() {
		this.apiKey = process.env.IPLocate_API_Key;
	}

	async detectLocation(ip) {
		try {
			const lookupIp = this.getPublicLookupIp(ip);
			// If no IP is provided, the API detect's the caller's IP
			const url = this.apiKey 
				? `https://www.iplocate.io/api/lookup/${lookupIp || ''}?apikey=${this.apiKey}`
				: `https://www.iplocate.io/api/lookup/${lookupIp || ''}`;
			
			const response = await axios.get(url);
			if (!response.data?.city || !response.data?.latitude || !response.data?.longitude) {
				return { detected: false, error: "location_unavailable" };
			}

			return {
				detected: true,
				approximate: true,
				ip: response.data.ip,
				country: response.data.country,
				city: response.data.city,
				latitude: response.data.latitude,
				longitude: response.data.longitude,
				time_zone: response.data.time_zone,
				org: response.data.org
			};
		} catch (error) {
			console.error('Location detection error:', error);
			return { detected: false, error: "location_unavailable" };
		}
	}

	getPublicLookupIp(ip) {
		const firstIp = String(Array.isArray(ip) ? ip[0] : ip || "")
			.split(",")[0]
			.trim()
			.replace(/^::ffff:/, "");
		if (!firstIp) return "";
		if (["::1", "127.0.0.1", "localhost"].includes(firstIp)) return "";
		if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(firstIp)) return "";
		return firstIp;
	}

	getMapUrl(location, latitude, longitude) {
		if (latitude && typeof latitude === "object") {
			longitude = latitude.longitude;
			latitude = latitude.latitude;
		}
		const lat = Number(latitude);
		const lng = Number(longitude);
		if (Number.isFinite(lat) && Number.isFinite(lng)) {
			return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
		}
		if (!location) return null;
		const trimmed = String(location).trim();
		const coordinateMatch = trimmed.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
		if (coordinateMatch) {
			return `https://www.google.com/maps/search/?api=1&query=${coordinateMatch[1]},${coordinateMatch[2]}`;
		}
		return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmed)}`;
	}
}

export default new LocationService();
