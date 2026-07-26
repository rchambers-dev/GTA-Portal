"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { cn } from "@/lib/utils";
import styles from "./Field.module.css";

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type SelectProps = {
  id?: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  "aria-label"?: string;
};

export function Select({
  id,
  value,
  options,
  onChange,
  placeholder = "Select…",
  disabled,
  invalid,
  className,
  "aria-label": ariaLabel,
}: SelectProps) {
  const autoId = useId();
  const triggerId = id ?? autoId;
  const listId = `${triggerId}-listbox`;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const selected = options.find((opt) => opt.value === value);

  useEffect(() => {
    if (!open) return;
    const enabled = options.filter((opt) => !opt.disabled);
    const selectedIdx = enabled.findIndex((opt) => opt.value === value);
    setActiveIndex(selectedIdx >= 0 ? selectedIdx : 0);

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, options, value]);

  const enabledOptions = options.filter((opt) => !opt.disabled);

  function choose(next: string) {
    onChange(next);
    setOpen(false);
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (
      event.key === "ArrowDown" ||
      event.key === "Enter" ||
      event.key === " "
    ) {
      event.preventDefault();
      setOpen(true);
    }
  }

  function onListKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, enabledOptions.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const opt = enabledOptions[activeIndex];
      if (opt) choose(opt.value);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div className={cn(styles.selectWrap, className)} ref={rootRef}>
      <button
        type="button"
        id={triggerId}
        className={cn(styles.control, styles.selectTrigger)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        data-invalid={invalid ? "true" : undefined}
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={onTriggerKeyDown}
      >
        <span className={styles.selectValue}>
          {selected?.label ?? placeholder}
        </span>
        <span className={styles.selectChevron} aria-hidden />
      </button>
      {open ? (
        <ul
          id={listId}
          className={styles.selectMenu}
          role="listbox"
          tabIndex={-1}
          aria-labelledby={triggerId}
          onKeyDown={onListKeyDown}
        >
          {options.map((opt) => {
            const enabledIdx = enabledOptions.findIndex(
              (e) => e.value === opt.value,
            );
            const isActive = enabledIdx === activeIndex;
            const isSelected = opt.value === value;
            return (
              <li key={opt.value} role="presentation">
                <button
                  type="button"
                  role="option"
                  className={styles.selectOption}
                  aria-selected={isSelected}
                  data-selected={isSelected ? "true" : undefined}
                  data-active={isActive ? "true" : undefined}
                  disabled={opt.disabled}
                  onMouseEnter={() => {
                    if (enabledIdx >= 0) setActiveIndex(enabledIdx);
                  }}
                  onClick={() => choose(opt.value)}
                >
                  {opt.label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
