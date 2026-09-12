import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Switch({
  className,
  checked,
  onCheckedChange,
  id,
  disabled,
  ...rest
}: {
  className?: string;
  checked?: boolean;
  onCheckedChange?: (next: boolean) => void;
  id?: string;
  disabled?: boolean;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange">) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      disabled={disabled}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full shadow-[var(--shadow-border)] transition-colors",
        checked ? "bg-accent" : "bg-elevated",
        className,
      )}
      {...rest}
      onClick={() => onCheckedChange?.(!checked)}
    >
      <span
        className={cn(
          "pointer-events-none block size-5 rounded-full transition-transform",
          checked ? "translate-x-[22px] bg-accent-fg" : "translate-x-0.5 bg-fg",
        )}
      />
    </button>
  );
}
