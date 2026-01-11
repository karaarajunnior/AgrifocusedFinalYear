export type OfflineProductDraft = {
  id: string;
  createdAt: string;
  payload: {
    name: string;
    description?: string;
    category: string;
    price: number;
    quantity: number;
    unit: string;
    location: string;
    organic?: boolean;
  };
};

const KEY = "agri.offlineQueue.products.v1";

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function uuid() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyCrypto = globalThis.crypto as any;
  return typeof anyCrypto?.randomUUID === "function"
    ? anyCrypto.randomUUID()
    : `draft_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function getOfflineProductQueue(): OfflineProductDraft[] {
  if (typeof window === "undefined") return [];
  return safeParse<OfflineProductDraft[]>(window.localStorage.getItem(KEY), []);
}

export function setOfflineProductQueue(items: OfflineProductDraft[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(items));
}

export function enqueueOfflineProductDraft(
  payload: OfflineProductDraft["payload"],
) {
  const items = getOfflineProductQueue();
  const next: OfflineProductDraft[] = [
    ...items,
    { id: uuid(), createdAt: new Date().toISOString(), payload },
  ];
  setOfflineProductQueue(next);
  return next;
}

export function removeOfflineProductDraft(id: string) {
  const items = getOfflineProductQueue();
  const next = items.filter((i) => i.id !== id);
  setOfflineProductQueue(next);
  return next;
}

