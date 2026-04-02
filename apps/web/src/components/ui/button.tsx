import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border border-[var(--accent-strong)] bg-[var(--accent)] text-[#031018] shadow-[0_14px_32px_rgba(99,216,247,0.22)] hover:-translate-y-0.5 hover:border-[rgba(99,216,247,0.38)] hover:bg-[#79def8] focus-visible:ring-[var(--accent)]",
  secondary:
    "border border-[var(--line)] bg-white/[0.04] backdrop-blur-xl text-[var(--text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] hover:-translate-y-0.5 hover:border-[var(--line-strong)] hover:bg-white/[0.07] focus-visible:ring-[var(--accent)]",
  ghost:
    "text-[var(--muted-strong)] hover:bg-white/[0.05] hover:text-[var(--text)] focus-visible:ring-[var(--accent)]",
  danger:
    "bg-[var(--danger-soft)] text-red-300 hover:-translate-y-0.5 hover:border-red-500/40 hover:bg-red-500/10 focus-visible:ring-red-400",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3.5 py-2 text-sm",
  md: "px-4 py-2.5 text-sm",
  lg: "px-5 py-3 text-sm",
};

type ButtonClassNameOptions = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
};

export function buttonClassName({
  variant = "secondary",
  size = "md",
  fullWidth = false,
  className,
}: ButtonClassNameOptions = {}) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] font-medium transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60",
    variantClasses[variant],
    sizeClasses[size],
    fullWidth && "w-full",
    className
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  ButtonClassNameOptions;

export function Button({
  variant = "secondary",
  size = "md",
  fullWidth = false,
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClassName({ variant, size, fullWidth, className })}
      {...props}
    />
  );
}
