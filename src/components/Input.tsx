import clsx from "clsx";
import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export default function Input({
  label,
  error,
  className,
  id,
  ...props
}: InputProps) {
  const inputId =
    id ?? (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label
          htmlFor={inputId}
          className="text-xs font-medium text-text-secondary"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        className={clsx(
          "w-full rounded-sm border bg-bg-secondary px-3 py-3 text-base text-text-primary transition-colors duration-150 ease-in-out",
          "placeholder:text-text-secondary",
          error
            ? "border-error"
            : "border-line hover:border-text-secondary/40",
          "focus:border-accent focus:outline-none",
          className
        )}
        {...props}
      />
      {error && <span className="text-xs text-error">{error}</span>}
    </div>
  );
}