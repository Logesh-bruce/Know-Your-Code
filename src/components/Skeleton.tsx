import clsx from "clsx";

interface SkeletonProps {
  className?: string;
}

export default function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={clsx(
        "animate-pulse rounded-sm bg-bg-tertiary",
        className
      )}
      aria-hidden="true"
    />
  );
}
