import type { ComponentProps, ReactNode } from "react";

// Inputs are 16px on phones so iOS doesn't zoom the page on focus.
export const inputClass =
  "w-full rounded-lg border border-line bg-paper px-3 text-base text-ink placeholder:text-muted focus-visible:border-live aria-[invalid=true]:border-charged sm:text-[0.9375rem]";

export function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string | null; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="t-label">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="t-meta !text-charged">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="t-meta">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

export function TextInput({ invalid, className = "", ...props }: ComponentProps<"input"> & { invalid?: boolean }) {
  return <input {...props} aria-invalid={invalid || undefined} className={`h-11 ${inputClass} ${className}`} />;
}

export function TextArea({ invalid, className = "", ...props }: ComponentProps<"textarea"> & { invalid?: boolean }) {
  return <textarea {...props} aria-invalid={invalid || undefined} className={`min-h-24 resize-y py-2.5 leading-relaxed ${inputClass} ${className}`} />;
}
