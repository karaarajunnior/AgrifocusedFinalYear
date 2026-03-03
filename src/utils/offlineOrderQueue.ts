/**
 * Offline Order Queue Utility
 * Handles queuing of orders when the user is offline.
 */

export interface OfflineOrderDraft {
    id: string;
    createdAt: string;
    payload: {
        productId: string;
        quantity: number;
        notes: string;
    };
    productName: string; // For UI display
}

const KEY = "agri.offlineQueue.orders.v1";

function safeParse<T>(raw: string | null, fallback: T): T {
    if (!raw) return fallback;
    try {
        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
}

export function getOfflineOrderQueue(): OfflineOrderDraft[] {
    if (typeof window === "undefined") return [];
    return safeParse<OfflineOrderDraft[]>(window.localStorage.getItem(KEY), []);
}

export function setOfflineOrderQueue(items: OfflineOrderDraft[]) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(KEY, JSON.stringify(items));
}

export function enqueueOfflineOrderDraft(
    payload: OfflineOrderDraft["payload"],
    productName: string
) {
    const items = getOfflineOrderQueue();
    const next: OfflineOrderDraft[] = [
        ...items,
        {
            id: `order_${Date.now()}_${Math.random().toString(16).slice(2)}`,
            createdAt: new Date().toISOString(),
            payload,
            productName
        },
    ];
    setOfflineOrderQueue(next);
    return next;
}

export function removeOfflineOrderDraft(id: string) {
    const items = getOfflineOrderQueue();
    const next = items.filter((i) => i.id !== id);
    setOfflineOrderQueue(next);
    return next;
}

export function getOfflineOrderCount(): number {
    return getOfflineOrderQueue().length;
}
