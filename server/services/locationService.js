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
			// Fallback mock for development if API fails
			return {
				city: "Kampala",
				country: "Uganda",
				latitude: 0.3476,
				longitude: 32.5825
			};
		}
	}

	getMapUrl(location) {
		if (!location) return null;
		// If location looks like coordinates
		if (location.includes(',') && !isNaN(parseFloat(location))) {
			return `https://www.google.com/maps/search/?api=1&query=${location}`;
		}
		// Otherwise text search
		return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
	}
}

export default new LocationService();
