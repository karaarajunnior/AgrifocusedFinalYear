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
				mumbai: { lat: 19.076, lon: 72.8777 },
				delhi: { lat: 28.7041, lon: 77.1025 },
				bangalore: { lat: 12.9716, lon: 77.5946 },
				chennai: { lat: 13.0827, lon: 80.2707 },
				kolkata: { lat: 22.5726, lon: 88.3639 },
				hyderabad: { lat: 17.385, lon: 78.4867 },
				pune: { lat: 18.5204, lon: 73.8567 },
				ahmedabad: { lat: 23.0225, lon: 72.5714 },
				jaipur: { lat: 26.9124, lon: 75.7873 },
				lucknow: { lat: 26.8467, lon: 80.9462 },
				kanpur: { lat: 26.4499, lon: 80.3319 },
				nagpur: { lat: 21.1458, lon: 79.0882 },
				indore: { lat: 22.7196, lon: 75.8577 },
				thane: { lat: 19.2183, lon: 72.9781 },
				bhopal: { lat: 23.2599, lon: 77.4126 },
				visakhapatnam: { lat: 17.6868, lon: 83.2185 },
				pimpri: { lat: 18.6298, lon: 73.7997 },
				patna: { lat: 25.5941, lon: 85.1376 },
				vadodara: { lat: 22.3072, lon: 73.1812 },
				ghaziabad: { lat: 28.6692, lon: 77.4538 },
			};

			const normalizedLocation = location.toLowerCase().split(",")[0].trim();
			const coordinates = cityCoordinates[normalizedLocation];

			if (coordinates) {
				this.geocodeCache.set(location, coordinates);
				return coordinates;
			}

			// Default coordinates for unknown locations (Mumbai)
			const defaultCoords = { lat: 19.076, lon: 72.8777 };
			this.geocodeCache.set(location, defaultCoords);
			return defaultCoords;
		} catch (error) {
			console.error("Geocoding error:", error);
			// Return default coordinates (Mumbai) on error
			return { lat: 19.076, lon: 72.8777 };
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
			mumbai: ["Mumbai", "Thane", "Navi Mumbai", "Pune"],
			delhi: ["Delhi", "Gurgaon", "Noida", "Ghaziabad", "Faridabad"],
			bangalore: ["Bangalore", "Mysore", "Mangalore"],
			chennai: ["Chennai", "Coimbatore", "Madurai"],
			kolkata: ["Kolkata", "Howrah", "Durgapur"],
			hyderabad: ["Hyderabad", "Secunderabad", "Warangal"],
			pune: ["Pune", "Mumbai", "Nashik", "Aurangabad"],
		};

		const normalizedLocation = location.toLowerCase().split(",")[0].trim();
		return locationGroups[normalizedLocation] || [location];
	}

	// Auto-detect user location (browser geolocation simulation)
	async autoDetectLocation() {
		// In a real app, this would use browser geolocation API

		return {
			location: "Mumbai, Maharashtra",
			coordinates: { lat: 19.076, lon: 72.8777 },
		};
	}
}

export default new LocationService();
