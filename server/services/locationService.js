import axios from 'axios';

class LocationService {
	constructor() {
		this.apiKey = process.env.IPLocate_API_Key;
	}

	async detectLocation(ip) {
		try {
			// If no IP is provided, the API detect's the caller's IP
			const url = this.apiKey 
				? `https://www.iplocate.io/api/lookup/${ip || ''}?apikey=${this.apiKey}`
				: `https://www.iplocate.io/api/lookup/${ip || ''}`;
			
			const response = await axios.get(url);
			return {
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
			// Fallback to Kampala so callers still receive a valid map/search center.
			return {
				city: "Kampala",
				country: "Uganda",
				latitude: 0.3476,
				longitude: 32.5825
			};
		}
	}

	getMapUrl(location, latitude, longitude) {
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
