import React from "react";

export type TrustScore = {
  score: number;
  band: "low" | "medium" | "high";
  reasons?: string[];
};

function bandStyle(band: TrustScore["band"]) {
  if (band === "high") return "bg-green-100 text-green-800 border-green-200";
  if (band === "medium") return "bg-yellow-100 text-yellow-800 border-yellow-200";
  return "bg-red-100 text-red-800 border-red-200";
}

export default function TrustBadge({
  trust,
  compact = false,
}: {
  trust: TrustScore | null | undefined;
  compact?: boolean;
}) {
  if (!trust) return null;
  return (
    <span
      title={(trust.reasons || []).join(" • ") || `Trust score: ${trust.score}`}
      className={`inline-flex items-center gap-2 border rounded-full ${
        compact ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm"
      } ${bandStyle(trust.band)}`.trim()}
    >
      <span className="font-semibold">Trust</span>
      <span>{trust.score}/100</span>
    </span>
  );
}

