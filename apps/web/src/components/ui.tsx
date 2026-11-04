import { useEffect, useRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "danger";

const buttonBase =
  "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-brand text-white hover:bg-brand-dark",
  secondary: "border border-gray-300 bg-white text-gray-900 hover:bg-gray-50",
  danger: "border border-red-300 bg-white text-red-700 hover:bg-red-50",
};

export const Button = ({
  variant = "secondary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) => (
  <button className={`${buttonBase} ${buttonVariants[variant]} ${className}`} {...props} />
);

export const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm transition-colors placeholder:text-gray-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30 focus-visible:outline-none";

export const errorBoxClass = "rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700";

export const StatusBadge = ({ status }: { status: string }) => {
  const tone =
    status === "completed"
      ? "bg-green-100 text-green-800"
      : status === "failed"
        ? "bg-red-100 text-red-800"
        : "bg-yellow-100 text-yellow-800";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${tone}`}>{status}</span>;
};

export const TargetBadge = ({ met }: { met: boolean }) => (
  <span
    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
      met ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-700"
    }`}
  >
    {met ? "target price reached" : "above target"}
  </span>
);

export const Dialog = ({
  title,
  onClose,
  children,
  panelClass = "max-w-lg",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  panelClass?: string;
}) => {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="animate-overlay-in fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`animate-dialog-in flex max-h-full w-full ${panelClass} flex-col gap-3 overflow-y-auto rounded-xl bg-white p-6 shadow-xl focus:outline-none`}
      >
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {children}
      </div>
    </div>
  );
};
