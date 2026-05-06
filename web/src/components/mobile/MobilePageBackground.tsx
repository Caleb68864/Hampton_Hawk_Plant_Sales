import type { ReactNode } from "react";

interface MobilePageBackgroundProps {
  children?: ReactNode;
  className?: string;
}

export function MobilePageBackground({ children, className = "" }: MobilePageBackgroundProps) {
  const cls = ["mobile-page-bg", className].filter(Boolean).join(" ");
  return <div className={cls}>{children}</div>;
}