/**
 * Offline Cache Utility
 * Provides simple localStorage-based caching for dashboard data segments.
 */

const PREFIX = 'agri.cache.';

interface CacheEntry<T> {
    data: T;
    timestamp: string;
    version: string;
}

/**
 * Saves data to local storage with a timestamp.
 */
export function saveToCache<T>(key: string, data: T, version: string = 'v1') {
    if (typeof window === 'undefined') return;

    const entry: CacheEntry<T> = {
        data,
        timestamp: new Date().toISOString(),
        version
    };

    try {
        window.localStorage.setItem(`${PREFIX}${key}`, JSON.stringify(entry));
    } catch (e) {
        console.error(`OfflineCache: Failed to save ${key}`, e);
        // If quota exceeded, we could clear old caches here
    }
}

/**
 * Retrieves data from cache if it exists.
 */
export function getFromCache<T>(key: string): { data: T; timestamp: string } | null {
    if (typeof window === 'undefined') return null;

    const raw = window.localStorage.getItem(`${PREFIX}${key}`);
    if (!raw) return null;

    try {
        const entry = JSON.parse(raw) as CacheEntry<T>;
        return {
            data: entry.data,
            timestamp: entry.timestamp
        };
    } catch (e) {
        return null;
    }
}

/**
 * Utility to check if we are currently offline
 */
export function isOffline(): boolean {
    return typeof window !== 'undefined' && !window.navigator.onLine;
}

/**
 * Clears all dashboard related caches
 */
export function clearAllCaches() {
    if (typeof window === 'undefined') return;

    const keys = Object.keys(window.localStorage);
    keys.forEach(key => {
        if (key.startsWith(PREFIX)) {
            window.localStorage.removeItem(key);
        }
    });
}
