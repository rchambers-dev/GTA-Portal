import type { ReactNode } from "react";
import Link from "next/link";

export function PageHead({
  crumb,
  title,
  lede,
  actions,
}: {
  crumb: ReactNode;
  title: string;
  lede?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <div className="crumb">{crumb}</div>
        <h1>{title}</h1>
        {lede ? <p className="lede">{lede}</p> : null}
      </div>
      {actions ? <div className="head-actions">{actions}</div> : null}
    </div>
  );
}

export function ExampleChip({ show }: { show: boolean }) {
  if (!show) return null;
  return <span className="chip chip-example">Example data</span>;
}

export function MissingNote({ show, message }: { show: boolean; message: string | null }) {
  if (!show && !message) return null;
  return (
    <div className="banner banner-amber" role="status">
      <div>
        <strong>{show ? "Tables not applied yet. " : ""}</strong>
        {message ||
          "Nothing is shown from the database. Saving will explain that the candidates migration still needs approval. No server error is raised."}
      </div>
    </div>
  );
}

export function Pill({ tone, children }: { tone: "red" | "amber" | "green" | "grey" | "navy"; children: ReactNode }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link className="back" href={href}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 18l-6-6 6-6" />
      </svg>
      {children}
    </Link>
  );
}

export function Plus() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function Tick() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}
