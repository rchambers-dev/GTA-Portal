"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui";
import { formatTutorDate } from "../domain/apprentice-tutor";
import {
  managerChoiceLabel,
  siteChoiceLabel,
} from "../domain/employer-record";
import {
  placementDetailEmail,
  placementDetailLocation,
  placementDetailManager,
  placementDetailManagerSite,
  placementDetailPhone,
  placementDetailPostcode,
  placementEmployerLabel,
  placementEndReasonLabel,
  validatePlacementChange,
  validatePlacementEnd,
  validatePlacementStart,
  type ApprenticePlacementPage,
  type PlacementDetail,
  type PlacementEmployerOption,
} from "../domain/apprentice-placement";
import {
  changeApprenticePlacementAction,
  endApprenticePlacementAction,
  startApprenticePlacementAction,
} from "./apprentice-placement-actions";
import styles from "./admin-pages.module.css";

type EditorMode = "start" | "change" | "end";

export function LearnerEmployerPanel({
  canManage,
  gtaId,
  placements,
}: {
  canManage: boolean;
  gtaId: string;
  placements: ApprenticePlacementPage;
}) {
  const [editor, setEditor] = useState<null | { id: string | null; mode: EditorMode }>(null);
  const open = placements.current;

  return (
    <div className={styles.stack} data-learner-section="employer">
      {placements.loadError ? (
        <p className={styles.error} role="alert">
          {placements.loadError}
        </p>
      ) : null}
      {open.length > 1 ? (
        <p className={styles.error} role="alert">
          This apprentice has more than one current placement.
        </p>
      ) : null}
      <section className={styles.learnerCard} aria-labelledby="current-placement-heading">
        <h2 id="current-placement-heading" className={styles.formGroupTitle}>
          Current placement
        </h2>
        {open.length === 0 ? (
          <p className={styles.empty} role="status">
            No current placement.
          </p>
        ) : (
          <div className={styles.stack}>
            {open.map((row) => (
              <article key={row.id}>
                <PlacementFacts row={row} />
                {canManage && editor?.id !== row.id ? (
                  <div className={styles.learnerActions}>
                    <button
                      type="button"
                      className={styles.primaryBtn}
                      data-change-placement={row.id}
                      onClick={() => setEditor({ id: row.id, mode: "change" })}
                    >
                      Change placement
                    </button>
                    <button
                      type="button"
                      className={styles.secondaryBtn}
                      data-end-placement={row.id}
                      onClick={() => setEditor({ id: row.id, mode: "end" })}
                    >
                      End placement
                    </button>
                  </div>
                ) : null}
                {canManage && editor?.id === row.id ? (
                  <PlacementEditor
                    mode={editor.mode}
                    gtaId={gtaId}
                    row={row}
                    employers={placements.employers}
                    onCancel={() => setEditor(null)}
                  />
                ) : null}
              </article>
            ))}
          </div>
        )}
        {canManage && open.length === 0 ? (
          editor?.mode === "start" ? (
            <PlacementEditor
              mode="start"
              gtaId={gtaId}
              row={null}
              employers={placements.employers}
              onCancel={() => setEditor(null)}
            />
          ) : (
            <div className={styles.learnerActions}>
              <button
                type="button"
                className={styles.primaryBtn}
                data-start-placement="live"
                onClick={() => setEditor({ id: null, mode: "start" })}
              >
                Start placement
              </button>
            </div>
          )
        ) : null}
        {canManage ? null : (
          <p className={styles.formGroupMeta} role="status">
            You can view placements. Administrator and Management can change or end one.
          </p>
        )}
      </section>
      <section className={styles.learnerCard} aria-labelledby="placement-history-heading">
        <h2 id="placement-history-heading" className={styles.formGroupTitle}>
          Placement history
        </h2>
        {placements.history.length === 0 ? (
          <p className={styles.empty} role="status">
            No previous placements.
          </p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table} data-placement-history="live">
              <thead>
                <tr>
                  <th>Employer</th>
                  <th>Postcode</th>
                  <th>Location</th>
                  <th>Manager</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>End reason</th>
                </tr>
              </thead>
              <tbody>
                {placements.history.map((row) => (
                  <tr key={row.id} data-past-placement={row.id}>
                    <td>{placementEmployerLabel(row)}</td>
                    <td>{placementDetailPostcode(row)}</td>
                    <td>{placementDetailLocation(row)}</td>
                    <td>{placementDetailManager(row)}</td>
                    <td>{formatTutorDate(row.startDate)}</td>
                    <td>{row.endDate ? formatTutorDate(row.endDate) : "No end date"}</td>
                    <td>{placementEndReasonLabel(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function PlacementFacts({ row }: { row: PlacementDetail }) {
  return (
    <dl className={styles.learnerFacts} data-current-placement={row.id}>
      <dt>Employer</dt>
      <dd data-placement-employer={placementEmployerLabel(row)}>{placementEmployerLabel(row)}</dd>
      <dt>Postcode</dt>
      <dd data-placement-postcode={placementDetailPostcode(row)}>{placementDetailPostcode(row)}</dd>
      <dt>Location</dt>
      <dd data-placement-location={placementDetailLocation(row)}>{placementDetailLocation(row)}</dd>
      <dt>Manager</dt>
      <dd data-placement-manager={placementDetailManager(row)}>{placementDetailManager(row)}</dd>
      <dt>Manager&apos;s site</dt>
      <dd data-placement-manager-site={placementDetailManagerSite(row)}>
        {placementDetailManagerSite(row)}
      </dd>
      <dt>Email</dt>
      <dd data-placement-email={placementDetailEmail(row)}>{placementDetailEmail(row)}</dd>
      <dt>Phone</dt>
      <dd data-placement-phone={placementDetailPhone(row)}>{placementDetailPhone(row)}</dd>
      <dt>Start date</dt>
      <dd>{formatTutorDate(row.startDate)}</dd>
    </dl>
  );
}

function PlacementEditor({
  mode,
  gtaId,
  row,
  employers,
  onCancel,
}: {
  mode: EditorMode;
  gtaId: string;
  row: PlacementDetail | null;
  employers: PlacementEmployerOption[];
  onCancel: () => void;
}) {
  const router = useRouter();
  const [employerId, setEmployerId] = useState(row?.employerId ?? "");
  const [siteId, setSiteId] = useState(row?.siteId ?? "");
  const [managerId, setManagerId] = useState(row?.managerId ?? "");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endReason, setEndReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const employer = employers.find((item) => item.employerId === employerId) ?? null;
  const needsPlacement = mode !== "end";
  const needsEnd = mode !== "start";

  function chooseEmployer(next: string) {
    setEmployerId(next);
    setSiteId("");
    setManagerId("");
    setFormError(null);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFormError(null);
    try {
      const result =
        mode === "end" && row
          ? await submitEnd(row)
          : mode === "start"
            ? await submitStart()
            : row
              ? await submitChange(row)
              : { ok: false as const, formError: "This placement could not be found. Refresh the page." };
      if (!result.ok) {
        setFormError(result.formError);
        return;
      }
      onCancel();
      router.refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "The placement could not be saved.");
    } finally {
      setPending(false);
    }
  }

  async function submitEnd(current: PlacementDetail) {
    const parsed = validatePlacementEnd({
      employmentId: current.id,
      currentStart: current.startDate,
      endDate,
      endReason,
    });
    if (!parsed.ok) return parsed;
    return endApprenticePlacementAction({
      employmentId: current.id,
      endDate,
      endReason,
    });
  }

  async function submitStart() {
    const parsed = validatePlacementStart({ gtaId, employerId, siteId, managerId, startDate });
    if (!parsed.ok) return parsed;
    return startApprenticePlacementAction({ gtaId, employerId, siteId, managerId, startDate });
  }

  async function submitChange(current: PlacementDetail) {
    const parsed = validatePlacementChange({
      employmentId: current.id,
      currentStart: current.startDate,
      endDate,
      endReason,
      gtaId,
      employerId,
      siteId,
      managerId,
      startDate,
    });
    if (!parsed.ok) return parsed;
    return changeApprenticePlacementAction({
      employmentId: current.id,
      endDate,
      endReason,
      employerId,
      siteId,
      managerId,
      startDate,
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate data-placement-form={mode}>
      <p className={styles.formGroupMeta}>
        {mode === "end"
          ? "Ending a placement leaves the learner with no current employer."
          : "The site and the manager must belong to the same employer. A manager with no site can still be chosen."}
      </p>
      {needsEnd ? (
        <>
          <label className={styles.learnerField}>
            <span>
              End date <em className={styles.fieldRequired}>required</em>
            </span>
            <input
              type="date"
              value={endDate}
              required
              min={row?.startDate}
              disabled={pending}
              aria-label="Placement end date"
              onChange={(event) => setEndDate(event.target.value)}
            />
          </label>
          <label className={styles.learnerField}>
            <span>
              End reason <em className={styles.fieldRequired}>required</em>
            </span>
            <input
              type="text"
              value={endReason}
              required
              disabled={pending}
              aria-label="Placement end reason"
              onChange={(event) => setEndReason(event.target.value)}
            />
          </label>
        </>
      ) : null}
      {needsPlacement ? (
        <EmployerFields
          employers={employers}
          employer={employer}
          employerId={employerId}
          siteId={siteId}
          managerId={managerId}
          pending={pending}
          onEmployer={chooseEmployer}
          onSite={setSiteId}
          onManager={setManagerId}
        />
      ) : null}
      {needsPlacement ? (
        <label className={styles.learnerField}>
          <span>
            Start date <em className={styles.fieldRequired}>required</em>
          </span>
          <input
            type="date"
            value={startDate}
            required
            min={needsEnd ? endDate || undefined : undefined}
            disabled={pending}
            aria-label="Placement start date"
            onChange={(event) => setStartDate(event.target.value)}
          />
        </label>
      ) : null}
      {formError ? (
        <p className={styles.error} role="alert">
          {formError}
        </p>
      ) : null}
      <div className={styles.learnerActions}>
        <button type="submit" className={styles.primaryBtn} disabled={pending}>
          {pending ? "Saving…" : mode === "end" ? "End placement" : mode === "start" ? "Start placement" : "Change placement"}
        </button>
        <button type="button" className={styles.secondaryBtn} disabled={pending} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function EmployerFields({
  employers,
  employer,
  employerId,
  siteId,
  managerId,
  pending,
  onEmployer,
  onSite,
  onManager,
}: {
  employers: PlacementEmployerOption[];
  employer: PlacementEmployerOption | null;
  employerId: string;
  siteId: string;
  managerId: string;
  pending: boolean;
  onEmployer: (value: string) => void;
  onSite: (value: string) => void;
  onManager: (value: string) => void;
}) {
  return (
    <>
      <div className={styles.learnerField}>
        <span>
          Employer <em className={styles.fieldRequired}>required</em>
        </span>
        <Select
          aria-label="Employer"
          value={employerId}
          disabled={pending || employers.length === 0}
          placeholder="Choose an employer"
          options={employers.map((item) => ({ value: item.employerId, label: item.companyName }))}
          onChange={onEmployer}
        />
      </div>
      <div className={styles.learnerField}>
        <span>
          Site <em className={styles.fieldRequired}>required</em>
        </span>
        <Select
          aria-label="Site"
          value={siteId}
          disabled={pending || !employer}
          placeholder="Choose a site"
          options={(employer?.sites ?? []).map((site) => ({
            value: site.id,
            label: siteChoiceLabel(site),
          }))}
          onChange={onSite}
        />
      </div>
      <div className={styles.learnerField}>
        <span>
          Manager <em className={styles.fieldRequired}>required</em>
        </span>
        <Select
          aria-label="Manager"
          value={managerId}
          disabled={pending || !employer}
          placeholder="Choose a manager"
          options={(employer?.managers ?? []).map((manager) => ({
            value: manager.id,
            label: managerChoiceLabel(manager, employer?.sites ?? []),
          }))}
          onChange={onManager}
        />
      </div>
    </>
  );
}
