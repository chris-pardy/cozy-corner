// ---------------------------------------------------------------------------
// DirectionPicker — 4-direction bitmask toggle
// ---------------------------------------------------------------------------

export interface DirectionBits {
  n: number;
  s: number;
  e: number;
  w: number;
}

/** Behavior / state-property convention: S=1, W=2, N=4, E=8 */
// eslint-disable-next-line react-refresh/only-export-components
export const BEHAVIOR_DIR_BITS: DirectionBits = { s: 1, w: 2, n: 4, e: 8 };

/** Room / exit convention: N=1, E=2, S=4, W=8 */
// eslint-disable-next-line react-refresh/only-export-components
export const ROOM_DIR_BITS: DirectionBits = { n: 1, e: 2, s: 4, w: 8 };

export interface DirectionPickerProps {
  value: number;
  onChange: (value: number) => void;
  /** Which bit maps to which direction. Defaults to BEHAVIOR_DIR_BITS. */
  bits?: DirectionBits;
}

export function DirectionPicker({
  value,
  onChange,
  bits = BEHAVIOR_DIR_BITS,
}: DirectionPickerProps) {
  const dirs = [
    { label: "\u25B2", bit: bits.n, pos: "ie-dir-n" },
    { label: "\u25C0", bit: bits.w, pos: "ie-dir-w" },
    { label: "\u25B6", bit: bits.e, pos: "ie-dir-e" },
    { label: "\u25BC", bit: bits.s, pos: "ie-dir-s" },
  ];

  return (
    <div className="ie-dir-grid">
      {dirs.map(({ label, bit, pos }) => (
        <button
          key={pos}
          className={`ie-dir-btn ${pos}${value & bit ? " ie-dir-btn--active" : ""}`}
          onClick={() => onChange(value ^ bit)}
          title={`Toggle ${label}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
