/**
 * Standardized utility for capturing GPS coordinates with high accuracy.
 */

export interface GeoCoords {
    latitude: number;
    longitude: number;
    accuracy: number;
}

export const getCurrentPosition = (): Promise<GeoCoords> => {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error("Geolocation not supported by this browser."));
            return;
        }

        const options: PositionOptions = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        };

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                resolve({
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude,
                    accuracy: pos.coords.accuracy
                });
            },
            (err) => {
                let message = "Failed to detect exact location.";
                switch (err.code) {
                    case err.PERMISSION_DENIED:
                        message = "Location permission denied. Please enable it in browser settings.";
                        break;
                    case err.POSITION_UNAVAILABLE:
                        message = "Location information is unavailable.";
                        break;
                    case err.TIMEOUT:
                        message = "Location detection timed out.";
                        break;
                }
                reject(new Error(message));
            },
            options
        );
    });
};
