"use client";

// A choice between a few values, built on native radios so arrow keys, form semantics and
// screen readers work without re-implementing them.
export function Segmented<T extends string>({
  name,
  label,
  value,
  options,
  onChange,
  hideLabel = false,
}: {
  name: string;
  label: string;
  value: T;
  options: { value: T; label: string; disabled?: boolean }[];
  onChange: (v: T) => void;
  hideLabel?: boolean;
}) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-1.5">
      <legend className={hideLabel ? "sr-only" : "t-label mb-1.5"}>{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <label key={o.value} className={o.disabled ? "cursor-not-allowed" : "cursor-pointer"}>
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              disabled={o.disabled}
              onChange={() => onChange(o.value)}
              className="peer sr-only"
            />
            <span className="flex h-9 min-w-11 items-center justify-center rounded-lg border border-line bg-paper px-3 text-[0.8125rem] font-medium text-ink transition-colors hover:bg-field peer-checked:border-ink peer-checked:bg-ink peer-checked:text-paper peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-live peer-disabled:opacity-45">
              {o.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
