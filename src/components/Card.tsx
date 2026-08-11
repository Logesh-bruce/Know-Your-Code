import clsx from "clsx";
import type { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
}

export default function Card({
  padded = true,
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={clsx(
        "rounded border border-line bg-bg-secondary",
        padded && "p-4",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}