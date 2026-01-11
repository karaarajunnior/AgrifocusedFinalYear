import { useEffect, useState } from "react";
import api from "../services/api";

type Trust = {
  score: number;
  band: "low" | "medium" | "high";
  reasons: string[];
};

const cache = new Map<string, Trust>();

export function useTrustScore(userId?: string | null) {
  const [trust, setTrust] = useState<Trust | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;
    if (cache.has(userId)) {
      setTrust(cache.get(userId) || null);
      return;
    }

    let mounted = true;
    setLoading(true);
    api
      .get(`/trust/${userId}`)
      .then((res) => {
        const t: Trust | undefined = res.data?.trust;
        if (!t) return;
        cache.set(userId, t);
        if (mounted) setTrust(t);
      })
      .catch(() => {
        // ignore
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [userId]);

  return { trust, loading } as const;
}

