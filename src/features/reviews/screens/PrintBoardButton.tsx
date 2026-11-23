"use client";

export function PrintBoardButton({ className }: { className: string }) {
  return (
    <button type="button" className={className} onClick={() => window.print()}>
      Print A3
    </button>
  );
}
