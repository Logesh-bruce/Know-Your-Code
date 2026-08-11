import clsx from "clsx";

interface ProgressBarProps {
  value: number;
  showLabel?: boolean;
  className?: string;
}

export default function ProgressBar({
  value,
  showLabel = false,
  className,
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div className={clsx("flex items-center gap-3", className)}>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-bg-tertiary"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-150 ease-in-out"
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs tabular-nums text-text-secondary">
          {clamped}%
        </span>
      )}
    </div>
  );
}