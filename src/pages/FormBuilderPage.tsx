import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "react-hot-toast";
import {
  PRODUCT_FORM_KEY,
  defaultProductFormDefinition,
  type FieldSet,
  type FormDefinition,
  type FormField,
} from "../utils/formDefinitions";

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function uid(prefix: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyCrypto = globalThis.crypto as any;
  return typeof anyCrypto?.randomUUID === "function"
    ? `${prefix}_${anyCrypto.randomUUID()}`
    : `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export default function FormBuilderPage() {
  const { user } = useAuth();
  const [def, setDef] = useState<FormDefinition>(defaultProductFormDefinition());

  useEffect(() => {
    const stored = safeParse<FormDefinition>(
      window.localStorage.getItem(PRODUCT_FORM_KEY),
      defaultProductFormDefinition(),
    );
    setDef(stored);
  }, []);

  if (!user) return null;
  if (user.role !== "ADMIN") {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-3xl mx-auto px-4">
          <div className="bg-white rounded-lg shadow p-6">
            <h1 className="text-xl font-bold text-gray-900">Form Builder</h1>
            <p className="text-gray-600 mt-2">Admins only.</p>
          </div>
        </div>
      </div>
    );
  }

  const save = () => {
    window.localStorage.setItem(PRODUCT_FORM_KEY, JSON.stringify(def));
    toast.success("Saved product form definition");
  };

  const reset = () => {
    const next = defaultProductFormDefinition();
    setDef(next);
    window.localStorage.setItem(PRODUCT_FORM_KEY, JSON.stringify(next));
    toast.success("Reset to default");
  };

  const addFieldset = () => {
    const fs: FieldSet = { id: uid("fs"), title: "New fieldset", fields: [] };
    setDef({ ...def, fieldSets: [...def.fieldSets, fs] });
  };

  const updateFieldset = (id: string, patch: Partial<FieldSet>) => {
    setDef({
      ...def,
      fieldSets: def.fieldSets.map((fs) => (fs.id === id ? { ...fs, ...patch } : fs)),
    });
  };

  const removeFieldset = (id: string) => {
    setDef({ ...def, fieldSets: def.fieldSets.filter((fs) => fs.id !== id) });
  };

  const addField = (fieldsetId: string) => {
    const f: FormField = { id: uid("f"), label: "New field", type: "text" };
    setDef({
      ...def,
      fieldSets: def.fieldSets.map((fs) =>
        fs.id === fieldsetId ? { ...fs, fields: [...fs.fields, f] } : fs,
      ),
    });
  };

  const updateField = (fieldsetId: string, fieldId: string, patch: Partial<FormField>) => {
    setDef({
      ...def,
      fieldSets: def.fieldSets.map((fs) =>
        fs.id === fieldsetId
          ? { ...fs, fields: fs.fields.map((f) => (f.id === fieldId ? { ...f, ...patch } : f)) }
          : fs,
      ),
    });
  };

  const removeField = (fieldsetId: string, fieldId: string) => {
    setDef({
      ...def,
      fieldSets: def.fieldSets.map((fs) =>
        fs.id === fieldsetId ? { ...fs, fields: fs.fields.filter((f) => f.id !== fieldId) } : fs,
      ),
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Dynamic Form Builder</h1>
              <p className="text-gray-600 mt-1">
                Admin can add custom fields + fieldsets. Farmers will see these when adding products.
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={addFieldset} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm">
                Add fieldset
              </button>
              <button onClick={reset} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm">
                Reset
              </button>
              <button onClick={save} className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm">
                Save
              </button>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {def.fieldSets.map((fs) => (
              <div key={fs.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between gap-3">
                  <input
                    className="flex-1 px-3 py-2 border rounded-lg"
                    value={fs.title}
                    onChange={(e) => updateFieldset(fs.id, { title: e.target.value })}
                  />
                  <button onClick={() => addField(fs.id)} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm">
                    Add field
                  </button>
                  <button onClick={() => removeFieldset(fs.id)} className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-sm">
                    Remove
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  {fs.fields.length === 0 ? (
                    <div className="text-sm text-gray-500">No fields yet.</div>
                  ) : (
                    fs.fields.map((f) => (
                      <div key={f.id} className="grid grid-cols-1 md:grid-cols-6 gap-2 items-center">
                        <input
                          className="md:col-span-2 px-3 py-2 border rounded-lg"
                          value={f.label}
                          onChange={(e) => updateField(fs.id, f.id, { label: e.target.value })}
                          placeholder="Label"
                        />
                        <select
                          className="md:col-span-1 px-3 py-2 border rounded-lg"
                          value={f.type}
                          onChange={(e) => updateField(fs.id, f.id, { type: e.target.value as FormField["type"] })}
                        >
                          <option value="text">text</option>
                          <option value="textarea">textarea</option>
                          <option value="number">number</option>
                          <option value="select">select</option>
                          <option value="checkbox">checkbox</option>
                          <option value="date">date</option>
                        </select>
                        <input
                          className="md:col-span-2 px-3 py-2 border rounded-lg"
                          value={f.placeholder || ""}
                          onChange={(e) => updateField(fs.id, f.id, { placeholder: e.target.value })}
                          placeholder="Placeholder / hint"
                        />
                        <button
                          onClick={() => removeField(fs.id, f.id)}
                          className="md:col-span-1 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-sm"
                        >
                          Remove
                        </button>
                        {f.type === "select" ? (
                          <div className="md:col-span-6">
                            <input
                              className="w-full px-3 py-2 border rounded-lg"
                              value={(f.options || []).join(", ")}
                              onChange={(e) =>
                                updateField(fs.id, f.id, {
                                  options: e.target.value
                                    .split(",")
                                    .map((s) => s.trim())
                                    .filter(Boolean),
                                })
                              }
                              placeholder="Options (comma-separated)"
                            />
                          </div>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 text-xs text-gray-500">
            Stored locally in this browser: <code>{PRODUCT_FORM_KEY}</code>. For production, you can persist this in DB.
          </div>
        </div>
      </div>
    </div>
  );
}

