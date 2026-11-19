"use client";

import { useRef, useState, type PointerEvent } from "react";
import { useRouter } from "next/navigation";
import type { OutPage, OutStop } from "../domain/out-repository";
import { saveOutSignatureAction, stampVisitAction } from "./out-actions";
import styles from "./plan.module.css";

export function OutView({ page }: { page: OutPage }) {
  const router = useRouter();
  const [date, setDate] = useState(page.days.find((day) => day.date >= page.today)?.date || page.days.at(-1)?.date || "");
  const [notice, setNotice] = useState("");
  const day = page.days.find((item) => item.date === date) || null;
  const visited = day?.stops.filter((stop) => stop.arrivedAt).length || 0;
  const left = day?.stops.filter((stop) => stop.leftAt).length || 0;

  async function stamp(stop: OutStop, kind: "arrive" | "leave") {
    if (!day) return;
    const result = await stampVisitAction({ date: day.date, gtaId: stop.gtaId, kind });
    setNotice(result.ok ? (kind === "arrive" ? `${stop.name} arrived.` : `${stop.name} left.`) : result.formError);
    if (result.ok) router.refresh();
  }

  return (
    <div className={styles.raPage}>
      <header className={styles.head}>
        <h1 className={styles.planTitle}>Out</h1>
        <p className={styles.meta}>The visit round. Signatures are collected here. Completing the plan day is still the review.</p>
      </header>
      {page.loadError ? <p role="alert">{page.loadError}</p> : null}
      {notice ? <p className={styles.status} role="status">{notice}</p> : null}
      {!page.marksReady ? <p className={styles.meta}>Arrive and leave times need the visit-marks migration before they can be saved.</p> : null}
      {page.days.length ? (
        <div className={styles.tabs}>
          {page.days.map((item) => (
            <button key={item.date} type="button" className={item.date === date ? styles.tabOn : styles.pill} onClick={() => setDate(item.date)}>
              {item.date} · {item.stops.length}
            </button>
          ))}
        </div>
      ) : (
        <p className={styles.empty}>No upcoming review days yet. Plan the week, then accept a route before you start.</p>
      )}
      {day ? (
        <section className={styles.card}>
          <p className={styles.meta}>{visited} in · {left} left</p>
          {day.accepted ? null : <p className={styles.acceptNote}>Locked until you accept this route on Plan.</p>}
          {day.stops.map((stop, index) => (
            <article key={stop.gtaId} className={styles.stop}>
              <p className={styles.when}>{stop.arrive || "—"}–{stop.leave || "—"}</p>
              <div>
                <strong>{index + 1}. {stop.name}</strong>
                <div className={styles.meta}>{stop.company}{stop.postcode ? ` · ${stop.postcode}` : ""}{stop.kind === "phone" ? " · Phone" : ""}</div>
                <div className={styles.meta}>
                  {stop.arrivedAt ? "Arrived" : "Not arrived"}
                  {stop.leftAt ? " · Left" : ""}
                  {stop.signatures.length ? ` · Signed: ${stop.signatures.map((item) => item.party).join(", ")}` : ""}
                </div>
                <div className={styles.dayActions}>
                  <button type="button" disabled={!day.accepted || Boolean(stop.arrivedAt)} onClick={() => void stamp(stop, "arrive")}>
                    {stop.arrivedAt ? "Arrived" : "Arrive"}
                  </button>
                  <button type="button" disabled={!day.accepted || !stop.arrivedAt || Boolean(stop.leftAt)} onClick={() => void stamp(stop, "leave")}>
                    {stop.leftAt ? "Left" : "Leave"}
                  </button>
                </div>
                {day.accepted && stop.packId && stop.arrivedAt ? (
                  <SignaturePad packId={stop.packId} onSaved={(text) => { setNotice(text); router.refresh(); }} />
                ) : null}
              </div>
            </article>
          ))}
        </section>
      ) : null}
    </div>
  );
}

function SignaturePad({ packId, onSaved }: { packId: string; onSaved: (text: string) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [party, setParty] = useState<"apprentice" | "employer" | "reviewer">("apprentice");
  const [name, setName] = useState("");

  function point(event: PointerEvent<HTMLCanvasElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  }

  return (
    <form
      className={styles.concernPanel}
      style={{ position: "static", width: "auto", marginTop: 8 }}
      onSubmit={(event) => {
        event.preventDefault();
        const image = canvas.current?.toDataURL("image/png") || "";
        void saveOutSignatureAction({ packId, party, name, image }).then((result) => {
          onSaved(result.ok ? `${name} signed as ${party}.` : result.formError);
        });
      }}
    >
      <label>
        Who is signing
        <select value={party} onChange={(event) => setParty(event.target.value as typeof party)}>
          <option value="apprentice">Apprentice</option>
          <option value="employer">Employer / mentor</option>
          <option value="reviewer">Reviewer</option>
        </select>
      </label>
      <label>
        Name
        <input value={name} onChange={(event) => setName(event.target.value)} required />
      </label>
      <canvas
        ref={canvas}
        width={480}
        height={140}
        aria-label="Signature"
        style={{ width: "100%", height: 140, border: "1px solid #d1d5de", borderRadius: 8, background: "#fff", touchAction: "none" }}
        onPointerDown={(event) => {
          drawing.current = true;
          const ctx = canvas.current?.getContext("2d");
          if (!ctx) return;
          const next = point(event);
          ctx.beginPath();
          ctx.moveTo(next.x, next.y);
        }}
        onPointerMove={(event) => {
          if (!drawing.current) return;
          const ctx = canvas.current?.getContext("2d");
          if (!ctx) return;
          const next = point(event);
          ctx.lineWidth = 2;
          ctx.lineCap = "round";
          ctx.strokeStyle = "#1a1f3d";
          ctx.lineTo(next.x, next.y);
          ctx.stroke();
        }}
        onPointerUp={() => {
          drawing.current = false;
        }}
      />
      <div className={styles.concernActions}>
        <button type="submit">Save signature</button>
        <button
          type="button"
          onClick={() => {
            const pad = canvas.current;
            pad?.getContext("2d")?.clearRect(0, 0, pad.width, pad.height);
          }}
        >
          Clear
        </button>
      </div>
    </form>
  );
}
