/**
 * Offline Handover Queue Utility
 * Handles queuing of order status updates (e.g. DELIVERED) when the user is offline.
 */

export interface OfflineHandoverAction {
    id: string;
    orderId: string;
    status: string;
    code?: string;
    timestamp: string;
}

const KEY = "agri.offlineQueue.handovers.v1";

function safeParse<T>(raw: string | null, fallback: T): T {
    if (!raw) return fallback;
    try {
        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
}

export function getOfflineHandoverQueue(): OfflineHandoverAction[] {
    if (typeof window === "undefined") return [];
    return safeParse<OfflineHandoverAction[]>(window.localStorage.getItem(KEY), []);
}

export function setOfflineHandoverQueue(items: OfflineHandoverAction[]) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(KEY, JSON.stringify(items));
}

export function enqueueOfflineHandover(orderId: string, status: string, code?: string) {
    const items = getOfflineHandoverQueue();
    // Prevent duplicate handovers for the same order in the queue
    if (items.find(i => i.orderId === orderId && i.status === status)) return items;

    const next: OfflineHandoverAction[] = [
        ...items,
        {
            id: `handover_${Date.now()}_${Math.random().toString(16).slice(2)}`,
            orderId,
            status,
            code,
            timestamp: new Date().toISOString()
        },
    ];
    setOfflineHandoverQueue(next);
    return next;
}

export function removeOfflineHandover(id: string) {
    const items = getOfflineHandoverQueue();
    const next = items.filter((i) => i.id !== id);
    setOfflineHandoverQueue(next);
    return next;
}

export function getOfflineHandoverCount(): number {
    return getOfflineHandoverQueue().length;
}
