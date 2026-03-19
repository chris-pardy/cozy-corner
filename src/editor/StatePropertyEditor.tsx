import { useCallback } from "react";
import { DirectionPicker } from "./DirectionPicker";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StatePropertyData {
  name: string;
  type: string;
  default: string;
  allowOverride: boolean;
}

const PROPERTY_TYPES = [
  { value: "string", label: "String" },
  { value: "integer", label: "Integer" },
  { value: "direction", label: "Direction" },
  { value: "edges", label: "Edges" },
  { value: "attribute", label: "Attribute" },
  { value: "blob", label: "Blob" },
] as const;

// ---------------------------------------------------------------------------
// EdgesPicker — 8-bit bitmask (4 physical N/E/S/W + 4 ephemeral N/E/S/W)
// ---------------------------------------------------------------------------

const EDGE_BITS: { label: string; bit: number }[] = [
  { label: "N", bit: 1 },
  { label: "E", bit: 2 },
  { label: "S", bit: 4 },
  { label: "W", bit: 8 },
];

function EdgesPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const physical = value & 0x0f;
  const ephemeral = (value >> 4) & 0x0f;

  return (
    <div className="sp-edges">
      <div className="sp-edges-row">
        <span className="sp-edges-label">Move</span>
        {EDGE_BITS.map(({ label, bit }) => (
          <button
            key={`p-${bit}`}
            className={`sp-edge-btn${physical & bit ? " sp-edge-btn--active" : ""}`}
            onClick={() => onChange((value ^ bit))}
            title={`Physical ${label}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="sp-edges-row">
        <span className="sp-edges-label">Eph.</span>
        {EDGE_BITS.map(({ label, bit }) => (
          <button
            key={`e-${bit}`}
            className={`sp-edge-btn${ephemeral & bit ? " sp-edge-btn--active" : ""}`}
            onClick={() => onChange(value ^ (bit << 4))}
            title={`Ephemeral ${label}`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AttributeSlider — 0-200 (displayed as -100 to +100)
// ---------------------------------------------------------------------------

function AttributeSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const display = value - 100;
  return (
    <div className="sp-attr-row">
      <input
        type="range"
        className="ce-attr-slider"
        min={0}
        max={200}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span
        className="ce-attr-value"
        data-positive={display > 0 ? "" : undefined}
        data-negative={display < 0 ? "" : undefined}
      >
        {display > 0 ? "+" : ""}
        {display}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// StateValueEditor — renders the appropriate widget for a state property type
// ---------------------------------------------------------------------------

export function StateValueEditor({
  property,
  value,
  onChange,
}: {
  property: { name: string; type: string; default: string };
  value: string;
  onChange: (v: string) => void;
}) {
  const effectiveValue = value || property.default;

  return (
    <div className="sp-value-row">
      <span className="ale-field-label sp-value-label">{property.name}</span>
      {property.type === "string" && (
        <input
          className="ale-num-input"
          style={{ width: "100%", textAlign: "left" }}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={property.default || "..."}
        />
      )}
      {property.type === "integer" && (
        <input
          className="ale-num-input"
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={property.default || "0"}
        />
      )}
      {property.type === "direction" && (
        <DirectionPicker
          value={parseInt(effectiveValue) || 0}
          onChange={(v) => onChange(String(v))}
        />
      )}
      {property.type === "edges" && (
        <EdgesPicker
          value={parseInt(effectiveValue) || 0}
          onChange={(v) => onChange(String(v))}
        />
      )}
      {property.type === "attribute" && (
        <AttributeSlider
          value={parseInt(effectiveValue) || 100}
          onChange={(v) => onChange(String(v))}
        />
      )}
      {property.type === "blob" && (
        <span className="sp-blob-hint">Set on placement</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// StatePropertyCard — single property definition
// ---------------------------------------------------------------------------

function StatePropertyCard({
  property,
  onChange,
  onRemove,
}: {
  property: StatePropertyData;
  onChange: (patch: Partial<StatePropertyData>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="sp-card">
      <div className="sp-card-header">
        <input
          className="bae-input sp-name-input"
          value={property.name}
          onChange={(e) =>
            onChange({
              name: e.target.value
                .trim()
                .toLowerCase()
                .replace(/\s+/g, "-"),
            })
          }
          placeholder="property-name"
          maxLength={64}
        />
        <select
          className="ale-num-input sp-type-select"
          value={property.type}
          onChange={(e) => onChange({ type: e.target.value, default: "" })}
        >
          {PROPERTY_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <button
          className="ale-icon-btn ale-icon-btn--danger"
          onClick={onRemove}
          title="Remove property"
        >
          &times;
        </button>
      </div>
      <div className="sp-card-body">
        {property.type !== "blob" && (
          <div className="sp-default-row">
            <span className="ale-field-label">Default</span>
            <StateValueEditor
              property={{ name: "", type: property.type, default: "" }}
              value={property.default}
              onChange={(v) => onChange({ default: v })}
            />
          </div>
        )}
        <label className="ie-action-toggle">
          <input
            type="checkbox"
            checked={property.allowOverride}
            onChange={(e) => onChange({ allowOverride: e.target.checked })}
          />
          <span className="ale-field-label">Allow placement override</span>
        </label>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// StatePropertyEditor — list of property definitions
// ---------------------------------------------------------------------------

export function StatePropertyEditor({
  properties,
  onChange,
}: {
  properties: StatePropertyData[];
  onChange: (properties: StatePropertyData[]) => void;
}) {
  const addProperty = useCallback(() => {
    onChange([
      ...properties,
      { name: "", type: "string", default: "", allowOverride: false },
    ]);
  }, [properties, onChange]);

  const updateProperty = useCallback(
    (idx: number, patch: Partial<StatePropertyData>) => {
      onChange(
        properties.map((p, i) => (i === idx ? { ...p, ...patch } : p)),
      );
    },
    [properties, onChange],
  );

  const removeProperty = useCallback(
    (idx: number) => {
      onChange(properties.filter((_, i) => i !== idx));
    },
    [properties, onChange],
  );

  return (
    <>
      <div className="ale-layer-header" style={{ marginTop: 16 }}>
        <span className="ale-label">State Properties</span>
        <button
          className="ale-icon-btn"
          onClick={addProperty}
          title="Add state property"
        >
          +
        </button>
      </div>
      <div className="sp-list">
        {properties.map((prop, idx) => (
          <StatePropertyCard
            key={idx}
            property={prop}
            onChange={(patch) => updateProperty(idx, patch)}
            onRemove={() => removeProperty(idx)}
          />
        ))}
        {properties.length === 0 && (
          <div className="ie-empty-hint">
            No state properties
          </div>
        )}
      </div>
    </>
  );
}
