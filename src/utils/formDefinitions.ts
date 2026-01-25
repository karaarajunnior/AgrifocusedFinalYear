export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "checkbox"
  | "date";

export type FormField = {
  id: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[]; // for select
  placeholder?: string;
};

export type FieldSet = {
  id: string;
  title: string;
  fields: FormField[];
};

export type FormDefinition = {
  id: "product";
  version: number;
  fieldSets: FieldSet[];
};

export const PRODUCT_FORM_KEY = "agri.formDef.product.v1";

export function defaultProductFormDefinition(): FormDefinition {
  return {
    id: "product",
    version: 1,
    fieldSets: [
      {
        id: "quality",
        title: "Quality & details",
        fields: [
          { id: "grade", label: "Grade", type: "select", options: ["A", "B", "C"] },
          { id: "packaging", label: "Packaging", type: "text", placeholder: "e.g. sacks, boxes" },
          { id: "moisture", label: "Moisture (%)", type: "number", placeholder: "e.g. 12" },
          { id: "pesticideFree", label: "Pesticide-free", type: "checkbox" },
        ],
      },
      {
        id: "logistics",
        title: "Logistics",
        fields: [
          { id: "pickupAvailable", label: "Pickup available", type: "checkbox" },
          { id: "deliveryWindow", label: "Delivery window", type: "text", placeholder: "e.g. 2-3 days" },
        ],
      },
    ],
  };
}

