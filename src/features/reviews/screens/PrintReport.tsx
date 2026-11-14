"use client";

export function PrintReport() {
  return (
    <button type="button" onClick={() => window.print()}>
      Reports
    </button>
  );
}

export function JumpSelect({ label, value, options }: { label: string; value: string; options: { href: string; label: string }[] }) {
  return (
    <select aria-label={label} value={value} onChange={(event) => { window.location.assign(event.target.value); }}>
      {options.map((option) => (
        <option key={option.href} value={option.href}>{option.label}</option>
      ))}
    </select>
  );
}
