import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import styles from "./Field.module.css";

type TextInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  invalid?: boolean;
};

export function TextInput({ className, invalid, ...props }: TextInputProps) {
  return (
    <input
      className={cn(styles.control, className)}
      data-invalid={invalid ? "true" : undefined}
      {...props}
    />
  );
}
