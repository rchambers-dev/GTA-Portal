"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { WorkspaceId } from "@/lib/portal/types";
import styles from "./StaffPermissionsScreen.module.css";

type PageInfo = {
  id: string;
  label: string;
  workspaces: WorkspaceId[];
  editable: boolean;
  requiredPermission: string;
  sensitivity: string | null;
};

type Grant = { pageId: string; level: "read" | "edit" };
type Bundle = { id: string; name: string; grants: Grant[]; staffIds: string[] };
type Staff = { id: string; name: string; role: string; workspace: WorkspaceId };
type Effective = {
  staffId: string;
  configured: boolean;
  pages: { pageId: string; label: string; level: "read" | "edit"; origins: string[] }[];
};

type Payload = {
  version: number;
  config: {
    workspaceDefaults: { workspaceId: WorkspaceId; grants: Grant[] }[];
    bundles: Bundle[];
    direct: { staffId: string; grants: Grant[] }[];
  };
  pages: PageInfo[];
  directory: Staff[];
  actorId: string;
  effective: Effective[];
};

const WORKSPACES: WorkspaceId[] = ["administration", "management", "staff", "quality", "safeguarding"];

async function postAction(body: Record<string, unknown>) {
  const response = await fetch("/api/staff-page-access", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as { error?: string };
  if (!response.ok) throw new Error(payload.error || "Could not save.");
}

export function StaffPermissionsScreen() {
  const [data, setData] = useState<Payload | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceId>("administration");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [bundleName, setBundleName] = useState("");
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
  const [directStaff, setDirectStaff] = useState("");
  const [effectiveStaff, setEffectiveStaff] = useState("");
  const [confirmWiden, setConfirmWiden] = useState(false);
  const router = useRouter();

  async function reload() {
    const response = await fetch("/api/staff-page-access");
    if (!response.ok) {
      setError("Could not load page access.");
      return;
    }
    const payload = (await response.json()) as Payload;
    setData(payload);
    setDirectStaff((current) => current || payload.directory[0]?.id || "");
    setEffectiveStaff((current) => current || payload.directory[0]?.id || "");
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void reload();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const pages = useMemo(
    () => data?.pages.filter((page) => page.workspaces.includes(workspace)) ?? [],
    [data, workspace],
  );
  const savedDefault = data?.config.workspaceDefaults.find((item) => item.workspaceId === workspace);
  const [draft, setDraft] = useState<Record<string, "read" | "edit" | "none">>({});

  useEffect(() => {
    const next: Record<string, "read" | "edit" | "none"> = {};
    for (const page of pages) {
      const grant = savedDefault?.grants.find((item) => item.pageId === page.id);
      next[page.id] = grant?.level ?? "none";
    }
    setDraft(next);
  }, [pages, savedDefault]);

  async function run(action: () => Promise<void>, success: string) {
    setError("");
    setMessage("");
    try {
      await action();
      setMessage(success);
      await reload();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save.");
      await reload();
    }
  }

  function grantsFromDraft(source: Record<string, "read" | "edit" | "none">): Grant[] {
    return Object.entries(source)
      .filter((entry): entry is [string, "read" | "edit"] => entry[1] === "read" || entry[1] === "edit")
      .map(([pageId, level]) => ({ pageId, level }));
  }

  function send(body: Record<string, unknown>) {
    return postAction({ ...body, expectedVersion: data?.version ?? 0 });
  }

  if (!data) return <p className={styles.description}>Loading page access.</p>;

  const effective = data.effective.find((item) => item.staffId === effectiveStaff);

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Staff</p>
        <h1 className={styles.title}>Permissions</h1>
        <p className={styles.description}>
          Access adds up. A person can receive a page from the workspace default, a page bundle, and a
          direct assignment. There is no deny rule. Edit includes Read. Saving a workspace default is
          what turns that workspace&apos;s page map on. Until then, existing access stays as it is.
          Clearing the default restores that current access. Page Edit does not grant staff admin,
          master records, proxy writes, or deletion.
        </p>
      </header>
      {message ? <p className={styles.status}>{message}</p> : null}
      {error ? <p className={styles.status}>{error}</p> : null}

      <section className={styles.panel}>
        <h2>Workspace defaults</h2>
        <p className={styles.note}>
          {savedDefault
            ? "This workspace page map is on. People keep a page only when a default, bundle, or direct assignment includes it, and their existing capability still allows it."
            : "This workspace is not using a page map. Current role access is unchanged."}
        </p>
        <label className={styles.field}>
          Workspace
          <select value={workspace} onChange={(event) => setWorkspace(event.target.value as WorkspaceId)}>
            {WORKSPACES.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>
        <div className={styles.list}>
          {pages.map((page) => (
            <div className={styles.pageRow} key={page.id}>
              <span>
                {page.label}
                {page.sensitivity ? ` · ${page.sensitivity}` : ""}
              </span>
              <label>
                <input
                  type="checkbox"
                  checked={draft[page.id] === "read" || draft[page.id] === "edit"}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      [page.id]: event.target.checked ? "read" : "none",
                    }))
                  }
                />
                Read
              </label>
              {page.editable ? (
                <label>
                  <input
                    type="checkbox"
                    checked={draft[page.id] === "edit"}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        [page.id]: event.target.checked ? "edit" : current[page.id] === "edit" ? "read" : current[page.id] || "none",
                      }))
                    }
                  />
                  Edit
                </label>
              ) : (
                <span className={styles.note}>No edit</span>
              )}
              <span className={styles.note}>{page.requiredPermission}</span>
            </div>
          ))}
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            onClick={() =>
              void run(
                () => send({ action: "saveWorkspace", workspaceId: workspace, grants: grantsFromDraft(draft) }),
                "Workspace default saved. The page map is now on for this workspace.",
              )
            }
          >
            Save workspace default
          </button>
          <label className={styles.note}>
            <input
              type="checkbox"
              checked={confirmWiden}
              onChange={(event) => setConfirmWiden(event.target.checked)}
            />
            Clear deletes this workspace page map only and restores role-baseline access. That can widen access to every registered page you omitted. Bundles and direct assignments stay.
          </label>
          <button
            type="button"
            disabled={!confirmWiden}
            onClick={() =>
              void run(
                () => send({ action: "clearWorkspace", workspaceId: workspace, confirmWiden: true }),
                "Workspace page map cleared. Role-baseline access is restored. This can be wider than the map you deleted.",
              )
            }
          >
            Clear workspace map and restore role baseline
          </button>
        </div>
      </section>

      <section className={styles.panel}>
        <h2>Page bundles</h2>
        <p className={styles.note}>
          A bundle is a named set of page Read and Edit grants. It can be assigned to more than one
          staff member. It is not a group of people by itself.
        </p>
        <label className={styles.field}>
          Bundle name
          <input value={bundleName} onChange={(event) => setBundleName(event.target.value)} />
        </label>
        <label className={styles.field}>
          Staff
          <select
            multiple
            value={selectedStaff}
            onChange={(event) =>
              setSelectedStaff([...event.target.selectedOptions].map((option) => option.value))
            }
          >
            {data.directory.filter((person) => person.id !== data.actorId).map((person) => (
              <option key={person.id} value={person.id}>
                {person.name} · {person.role}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() =>
            void run(async () => {
              await send({
                action: "saveBundle",
                name: bundleName,
                grants: grantsFromDraft(draft),
                staffIds: selectedStaff,
              });
              setBundleName("");
            }, "Page bundle saved.")
          }
        >
          Save page bundle
        </button>
        <div className={styles.list}>
          {data.config.bundles.map((bundle) => (
            <div className={styles.row} key={bundle.id}>
              <span>
                {bundle.name} · {bundle.grants.length} pages · {bundle.staffIds.length} staff
              </span>
              <button
                type="button"
                onClick={() =>
                  void run(
                    () => send({ action: "deleteBundle", bundleId: bundle.id }),
                    "Page bundle removed.",
                  )
                }
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        {data.directory.length === 0 ? (
          <p className={styles.note}>
            No staff directory is connected, so nobody was listed and no assignment was invented.
            Workspace defaults can still be saved.
          </p>
        ) : null}
      </section>

      <section className={styles.panel}>
        <h2>Direct assignment</h2>
        <label className={styles.field}>
          Staff member
          <select value={directStaff} onChange={(event) => setDirectStaff(event.target.value)}>
            {data.directory.filter((person) => person.id !== data.actorId).map((person) => (
              <option key={person.id} value={person.id}>
                {person.name} · {person.role}
              </option>
            ))}
          </select>
        </label>
        <div className={styles.actions}>
          <button
            type="button"
            disabled={!directStaff}
            onClick={() =>
              void run(
                () => send({
                  action: "saveDirect",
                  staffId: directStaff,
                  grants: grantsFromDraft(draft),
                }),
                "Direct page assignment saved.",
              )
            }
          >
            Save direct pages
          </button>
          <button
            type="button"
            disabled={!directStaff}
            onClick={() =>
              void run(
                () => send({ action: "clearDirect", staffId: directStaff }),
                "Direct assignment cleared.",
              )
            }
          >
            Clear direct pages
          </button>
        </div>
      </section>

      <section className={styles.panel}>
        <h2>Effective access</h2>
        <label className={styles.field}>
          Staff member
          <select value={effectiveStaff} onChange={(event) => setEffectiveStaff(event.target.value)}>
            {data.directory.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </label>
        {effective && !effective.configured ? (
          <p className={styles.note}>Their workspace page map is off, so existing role access still applies.</p>
        ) : null}
        {effective?.configured ? (
          <div className={styles.list}>
            {effective.pages.length === 0 ? <p className={styles.note}>No pages are granted yet.</p> : null}
            {effective.pages.map((page) => (
              <p key={page.pageId} className={styles.note}>
                {page.label} · {page.level} · {page.origins.join(", ")}
              </p>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
