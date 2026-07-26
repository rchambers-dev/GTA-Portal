import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import styles from "./Field.module.css";

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean;
};

export function TextArea({ className, invalid, ...props }: TextAreaProps) {
  return (
    <textarea
      className={cn(styles.control, styles.textarea, className)}
      data-invalid={invalid ? "true" : undefined}
      {...props}
    />
  );
}
