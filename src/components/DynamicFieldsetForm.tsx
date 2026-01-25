import React from "react";
import type { FieldSet, FormField } from "../utils/formDefinitions";

function inputClass() {
  return "w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500";
}

function coerceValue(field: FormField, raw: unknown) {
  if (field.type === "checkbox") return Boolean(raw);
  if (field.type === "number") {
    const n = Number(raw);
    return Number.isFinite(n) ? n : "";
  }
  return typeof raw === "string" ? raw : raw == null ? "" : String(raw);
}

export default function DynamicFieldsetForm({
  fieldSets,
  values,
  onChange,
}: {
  fieldSets: FieldSet[];
  values: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  const setField = (id: string, v: unknown) => {
    onChange({ ...values, [id]: v });
  };

  return (
    <div className="space-y-4">
      {fieldSets.map((fs) => (
        <div key={fs.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
          <div className="font-semibold text-gray-900 mb-3">{fs.title}</div>
          <div className="space-y-3">
            {fs.fields.map((f) => {
              const val = coerceValue(f, values[f.id]);
              return (
                <div key={f.id}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {f.label} {f.required ? "*" : ""}
                  </label>

                  {f.type === "textarea" ? (
                    <textarea
                      className={inputClass()}
                      rows={3}
                      placeholder={f.placeholder || ""}
                      value={String(val)}
                      onChange={(e) => setField(f.id, e.target.value)}
                    />
                  ) : f.type === "select" ? (
                    <select
                      className={inputClass()}
                      value={String(val)}
                      onChange={(e) => setField(f.id, e.target.value)}
                    >
                      <option value="">Select…</option>
                      {(f.options || []).map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  ) : f.type === "checkbox" ? (
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        className="h-5 w-5"
                        checked={Boolean(values[f.id])}
                        onChange={(e) => setField(f.id, e.target.checked)}
                      />
                      <span className="text-sm text-gray-700">{f.placeholder || "Yes"}</span>
                    </div>
                  ) : (
                    <input
                      className={inputClass()}
                      type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                      inputMode={f.type === "number" ? "numeric" : undefined}
                      placeholder={f.placeholder || ""}
                      value={f.type === "number" ? String(val) : String(val)}
                      onChange={(e) => setField(f.id, f.type === "number" ? e.target.value : e.target.value)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

