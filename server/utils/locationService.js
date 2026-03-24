// Location service for distance calculations and location management
import axios from "axios";

class LocationService {
	constructor() {
		this.geocodeCache = new Map();
	}

	// Calculate distance between two coordinates using Haversine formula
	calculateDistance(lat1, lon1, lat2, lon2) {
		const R = 6371; // Earth's radius in kilometers
		const dLat = this.toRadians(lat2 - lat1);
		const dLon = this.toRadians(lon2 - lon1);

		const a =
			Math.sin(dLat / 2) * Math.sin(dLat / 2) +
			Math.cos(this.toRadians(lat1)) *
				Math.cos(this.toRadians(lat2)) *
				Math.sin(dLon / 2) *
				Math.sin(dLon / 2);

		const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
		const distance = R * c;

		return Math.round(distance * 10) / 10; // Round to 1 decimal place
	}

	toRadians(degrees) {
		return degrees * (Math.PI / 180);
	}

	// Geocode location to get coordinates
	async geocodeLocation(location) {
		if (this.geocodeCache.has(location)) {
			return this.geocodeCache.get(location);
		}

		try {
			// For demo purposes, we'll use predefined coordinates for common Indian cities
			const cityCoordinates = {
				jinja: { lat: 0.4472, lon: 33.2027 },
				mbale: { lat: 1.0716, lon: 34.1816 },
				soroti: { lat: 1.7146, lon: 33.6111 },
				fortportal: { lat: 0.6931, lon: 30.2731 },
				kampala: { lat: 0.3476, lon: 32.5825 },
				masaka: { lat: -0.3333, lon: 31.7333 },
				ntungamo: { lat: -0.8756, lon: 30.2636 },
				kasese: { lat: 0.1833, lon: 30.0833 },
				kimaka: { lat: 0.4578, lon: 33.1906 },
				mbarara: { lat: -0.6133, lon: 30.6583 },
				kanungu: { lat: -0.8931, lon: 29.7897 },
				bushenyi: { lat: -0.5475, lon: 30.1867 },
				amuria: { lat: 2.0294, lon: 33.6428 },
				kapchwora: { lat: 1.3931, lon: 34.4531 },
				serere: { lat: 1.5036, lon: 33.4531 },
				kisonga: { lat: 0.5133, lon: 30.1333 },
				sebei: { lat: 1.3431, lon: 34.4531 },
				ibanda: { lat: -0.1333, lon: 30.4833 },
				nakapiriprit: { lat: 1.9167, lon: 34.5333 },
				hamjoshcity: { lat: 0.4472, lon: 33.2027 },
			};

			const normalizedLocation = location.toLowerCase().split(",")[0].trim();
			const coordinates = cityCoordinates[normalizedLocation];

			if (coordinates) {
				this.geocodeCache.set(location, coordinates);
				return coordinates;
			}

			// Default coordinates for unknown locations (Kampala)
			const defaultCoords = { lat: 0.3476, lon: 32.5825 };
			this.geocodeCache.set(location, defaultCoords);
			return defaultCoords;
		} catch (error) {
			console.error("Geocoding error:", error);
			// Return default coordinates (Kampala) on error
			return { lat: 0.3476, lon: 32.5825 };
		}
	}

	// Get products within specified radius
	async getProductsWithinRadius(userLocation, products, radiusKm = 50) {
		try {
			const userCoords = await this.geocodeLocation(userLocation);
			const productsWithDistance = [];

			for (const product of products) {
				const productCoords = await this.geocodeLocation(product.location);
				const distance = this.calculateDistance(
					userCoords.lat,
					userCoords.lon,
					productCoords.lat,
					productCoords.lon,
				);

				if (distance <= radiusKm) {
					productsWithDistance.push({
						...product,
						distance: distance,
						distanceText:
							distance < 1 ? "Less than 1 km" : `${distance} km away`,
					});
				}
			}

			// Sort by distance (closest first)
			return productsWithDistance.sort((a, b) => a.distance - b.distance);
		} catch (error) {
			console.error("Location filtering error:", error);
			return products; // Return all products if location filtering fails
		}
	}

	// Get nearby locations for suggestions
	getNearbyLocations(location) {
		const locationGroups = {
			jinja: ["jinja", "mpumude", "bugembe", "magamaga"],
			kampala: ["kampala", "masaka", "mpigi", "mukono", "entebbe"],
			soroti: ["amuria", "soroti", "tororo"],
			mbarara: ["kizungu", "nkokojeru", "mbarara"],
			mbale: ["mbale", "Howrah", "Durgapur"],
			hyderabad: ["Hyderabad", "Secunderabad", "Warangal"],
			fortportal: ["fortportal", "rwenzori", "kasese", "congo"],
		};

		const normalizedLocation = location.toLowerCase().split(",")[0].trim();
		return locationGroups[normalizedLocation] || [location];
	}

	// Auto-detect user location (browser geolocation simulation)
	async autoDetectLocation() {
		// In a real app, this would use browser geolocation API

		return {
			location: "jinja, lubus",
			coordinates: { lat: 19.076, lon: 72.8777 },
		};
	}
}

export default new LocationService();
