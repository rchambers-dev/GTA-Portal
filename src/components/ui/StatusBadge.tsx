import { cn } from "@/lib/utils";
import styles from "./StatusBadge.module.css";

export type StatusTone =
  | "on_track"
  | "monitoring"
  | "priority"
  | "neutral"
  | "missing"
  | "checked"
  | "review";

const toneClass: Record<StatusTone, string> = {
  on_track: styles.onTrack,
  monitoring: styles.monitoring,
  priority: styles.priority,
  neutral: styles.neutral,
  missing: styles.missing,
  checked: styles.checked,
  review: styles.review,
};

export function StatusBadge({
  children,
  tone = "neutral",
  size = "sm",
  className,
}: {
  children: React.ReactNode;
  tone?: StatusTone;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span
      className={cn(
        styles.badge,
        size === "md" ? styles.md : styles.sm,
        toneClass[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
