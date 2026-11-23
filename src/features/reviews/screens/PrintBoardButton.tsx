"use client";

export function PrintBoardButton({ className }: { className: string }) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        const fonts = document.fonts?.ready ?? Promise.resolve();
        void fonts.then(() => window.print());
      }}
    >
      Print A3
    </button>
  );
}
