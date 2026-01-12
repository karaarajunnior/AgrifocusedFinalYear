import React, { useEffect, useState } from "react";
import api from "../services/api";
import { CloudRain, Sun, Wind } from "lucide-react";

type Alert = {
  id: string;
  severity: string;
  title: string;
  body: string;
  validTo: string;
};

function iconFor(title: string) {
  const t = title.toLowerCase();
  if (t.includes("rain")) return <CloudRain className="h-5 w-5 text-blue-600" />;
  if (t.includes("heat") || t.includes("temperature")) return <Sun className="h-5 w-5 text-yellow-600" />;
  if (t.includes("wind")) return <Wind className="h-5 w-5 text-gray-700" />;
  return <CloudRain className="h-5 w-5 text-blue-600" />;
}

export default function ClimateAlertsCard({ location }: { location: string }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!location) return;
    let mounted = true;
    setLoading(true);
    api
      .get(`/climate/alerts?location=${encodeURIComponent(location)}`)
      .then((res) => {
        if (!mounted) return;
        setAlerts(res.data?.alerts || []);
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
  }, [location]);

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Weather & risk alerts</h3>
        {loading ? <span className="text-xs text-gray-500">Loading…</span> : null}
      </div>
      <p className="text-xs text-gray-500 mt-1">Location: {location}</p>
      <div className="mt-3 space-y-2">
        {alerts.slice(0, 3).map((a) => (
          <div key={a.id} className="flex items-start gap-3 bg-gray-50 border border-gray-200 rounded-lg p-3">
            <div className="mt-0.5">{iconFor(a.title)}</div>
            <div>
              <div className="text-sm font-medium text-gray-900">{a.title}</div>
              <div className="text-xs text-gray-600">{a.body}</div>
            </div>
          </div>
        ))}
        {alerts.length === 0 && !loading ? (
          <div className="text-sm text-gray-600">No alerts yet.</div>
        ) : null}
      </div>
    </div>
  );
}

