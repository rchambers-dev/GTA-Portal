"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui";
import { ApprenticePageShell } from "@/features/apprentice-portal/components/ApprenticePageShell";
import {
  addEmployerAction,
  addEmployerSiteAction,
  removeEmployerManagerAction,
  removeEmployerSiteAction,
  renameEmployerAction,
  saveEmployerManagerAction,
} from "./employer-actions";
import {
  EMPLOYER_AREAS,
  employerMatchesQuery,
  employerSummary,
  formatManagerName,
  managerSiteLabel,
  sortEmployers,
  validateAreaName,
  validateCompanyName,
  validateManagerInput,
  withManager,
  withSite,
  withoutManager,
  withoutSite,
  type EmployerField,
  type EmployerFieldErrors,
  type EmployerListItem,
  type EmployerManager,
  type EmployerMutationResult,
} from "../domain/employer-record";
import styles from "./admin-pages.module.css";

type ManagerDraft = {
  id: string | null;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  siteId: string;
};

const BLANK_MANAGER: ManagerDraft = {
  id: null,
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  siteId: "",
};

export function EmployersForm({
  canWrite,
  employers,
  loadError,
  initialOpenId = null,
}: {
  canWrite: boolean;
  employers: EmployerListItem[];
  loadError: string | null;
  initialOpenId?: string | null;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(employers);
  const [loaded, setLoaded] = useState(employers);
  const [query, setQuery] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyNameError, setCompanyNameError] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [assignedId, setAssignedId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(initialOpenId);
  const [pending, setPending] = useState(false);
  const [nameDraft, setNameDraft] = useState(
    () => employers.find((employer) => employer.employerId === initialOpenId)?.companyName ?? "",
  );
  const [nameError, setNameError] = useState<string | null>(null);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [siteChoice, setSiteChoice] = useState("");
  const [siteError, setSiteError] = useState<string | null>(null);
  const [managerDraft, setManagerDraft] = useState<ManagerDraft>(BLANK_MANAGER);
  const [managerErrors, setManagerErrors] = useState<EmployerFieldErrors>({});

  if (loaded !== employers) {
    setLoaded(employers);
    setRows(employers);
  }

  const visible = rows.filter((employer) => employerMatchesQuery(employer, query));
  const openEmployer = rows.find((employer) => employer.employerId === openId) ?? null;

  function toggle(employer: EmployerListItem) {
    if (openId === employer.employerId) {
      setOpenId(null);
      return;
    }
    setOpenId(employer.employerId);
    setNameDraft(employer.companyName);
    setNameError(null);
    setPanelError(null);
    setSiteChoice("");
    setSiteError(null);
    setManagerDraft(BLANK_MANAGER);
    setManagerErrors({});
  }

  function replace(employerId: string, next: EmployerListItem) {
    setRows((current) =>
      sortEmployers(current.map((row) => (row.employerId === employerId ? next : row))),
    );
  }

  async function run<T>(
    work: () => Promise<EmployerMutationResult<T>>,
  ): Promise<EmployerMutationResult<T> | null> {
    setPending(true);
    try {
      const result = await work();
      if (result.ok) router.refresh();
      return result;
    } catch (error) {
      return {
        ok: false,
        fieldErrors: {},
        formError: error instanceof Error ? error.message : "The change could not be saved.",
      };
    } finally {
      setPending(false);
    }
  }

  async function onAddEmployer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAddError(null);
    const parsed = validateCompanyName(companyName);
    if (!parsed.ok) {
      setCompanyNameError(parsed.fieldErrors.companyName ?? "Enter a company name.");
      setAssignedId(null);
      return;
    }
    setCompanyNameError(null);
    const result = await run(() => addEmployerAction({ companyName: parsed.companyName }));
    if (!result) return;
    if (!result.ok) {
      setCompanyNameError(result.fieldErrors.companyName ?? null);
      setAddError(result.formError);
      setAssignedId(null);
      return;
    }
    setAssignedId(result.value.employerId);
    setCompanyName("");
    setQuery("");
    setRows((current) => sortEmployers([...current, result.value]));
    setOpenId(result.value.employerId);
    setNameDraft(result.value.companyName);
    setNameError(null);
    setPanelError(null);
    setSiteChoice("");
    setSiteError(null);
    setManagerDraft(BLANK_MANAGER);
    setManagerErrors({});
  }

  async function onRename(event: FormEvent<HTMLFormElement>, employer: EmployerListItem) {
    event.preventDefault();
    setPanelError(null);
    const parsed = validateCompanyName(nameDraft);
    if (!parsed.ok) {
      setNameError(parsed.fieldErrors.companyName ?? "Enter a company name.");
      return;
    }
    if (parsed.companyName === employer.companyName) {
      setNameError(null);
      return;
    }
    setNameError(null);
    const result = await run(() =>
      renameEmployerAction({
        employerId: employer.employerId,
        companyName: parsed.companyName,
      }),
    );
    if (!result || result.ok === false) {
      if (result && !result.ok) {
        setNameError(result.fieldErrors.companyName ?? null);
        setPanelError(result.formError);
      }
      return;
    }
    replace(employer.employerId, { ...employer, companyName: result.value.companyName });
    setNameDraft(result.value.companyName);
  }

  async function onAddSite(event: FormEvent<HTMLFormElement>, employer: EmployerListItem) {
    event.preventDefault();
    setPanelError(null);
    const available = availableAreas(employer);
    const areaName = available.includes(siteChoice as (typeof EMPLOYER_AREAS)[number])
      ? siteChoice
      : (available[0] ?? "");
    const parsed = validateAreaName(areaName);
    if (!parsed.ok) {
      setSiteError(parsed.fieldErrors.areaName ?? "Choose Doncaster, Hull, or Sheffield.");
      return;
    }
    setSiteError(null);
    const result = await run(() =>
      addEmployerSiteAction({ employerId: employer.employerId, areaName: parsed.areaName }),
    );
    if (!result || !result.ok) {
      if (result && !result.ok) {
        setSiteError(result.fieldErrors.areaName ?? null);
        setPanelError(result.formError);
      }
      return;
    }
    replace(employer.employerId, withSite(employer, result.value));
    setSiteChoice("");
  }

  async function onRemoveSite(employer: EmployerListItem, siteId: string) {
    setPanelError(null);
    setSiteError(null);
    const result = await run(() => removeEmployerSiteAction({ siteId }));
    if (!result || !result.ok) {
      if (result && !result.ok) setPanelError(result.formError);
      return;
    }
    const next = withoutSite(employer, siteId);
    replace(employer.employerId, next);
    if (managerDraft.siteId === siteId) {
      setManagerDraft((current) => ({ ...current, siteId: "" }));
    }
  }

  async function onSaveManager(event: FormEvent<HTMLFormElement>, employer: EmployerListItem) {
    event.preventDefault();
    setPanelError(null);
    const allowedSiteIds = employer.sites.map((site) => site.id);
    const parsed = validateManagerInput(managerDraft, allowedSiteIds);
    if (!parsed.ok) {
      setManagerErrors(parsed.fieldErrors);
      return;
    }
    setManagerErrors({});
    const result = await run(() =>
      saveEmployerManagerAction({
        employerId: employer.employerId,
        managerId: managerDraft.id,
        manager: managerDraft,
        allowedSiteIds,
      }),
    );
    if (!result || !result.ok) {
      if (result && !result.ok) {
        setManagerErrors(result.fieldErrors);
        setPanelError(result.formError);
      }
      return;
    }
    replace(employer.employerId, withManager(employer, result.value));
    setManagerDraft(BLANK_MANAGER);
  }

  async function onRemoveManager(employer: EmployerListItem, managerId: string) {
    setPanelError(null);
    const result = await run(() => removeEmployerManagerAction({ managerId }));
    if (!result || !result.ok) {
      if (result && !result.ok) setPanelError(result.formError);
      return;
    }
    replace(employer.employerId, withoutManager(employer, managerId));
    if (managerDraft.id === managerId) setManagerDraft(BLANK_MANAGER);
  }

  return (
    <ApprenticePageShell
      eyebrow="Onboarding"
      title="Employers"
      description="Company name is required. The database assigns the employer ID. Sites are Doncaster, Hull, or Sheffield."
    >
      <div className={styles.stack} data-employers="live">
        {loadError ? (
          <p className={styles.error} role="alert">
            {loadError}
          </p>
        ) : null}

        {canWrite ? null : (
          <p className={styles.formGroupMeta} role="status">
            You can view employers. Only Administrator and Management can change them.
          </p>
        )}

        {assignedId ? (
          <div
            className={styles.successPanel}
            role="status"
            data-save-result="success"
            data-assigned-employer-id={assignedId}
          >
            <p className={styles.confirmTitle}>Employer saved</p>
            <p className={styles.successMeta}>
              The employer ID is <strong className={styles.assignedId}>{assignedId}</strong>.
            </p>
          </div>
        ) : null}

        {canWrite ? (
          <section className={styles.learnerAdd} data-add-panel="employer">
            <p className={styles.learnerKicker}>Manual entry</p>
            <h2 className={styles.learnerHeading}>Add employer</h2>
            <p className={styles.learnerMuted}>
              Only the company name is saved. Sites and managers are added on the employer afterwards.
            </p>
            <article className={styles.learnerCard}>
              <form onSubmit={onAddEmployer} noValidate>
                <div className={styles.learnerGrid}>
                  <label className={`${styles.learnerField} ${styles.learnerFieldWide}`} data-entry-field="companyName">
                    <span>
                      Company name <em className={styles.fieldRequired}>required</em>
                    </span>
                    <input
                      type="text"
                      value={companyName}
                      required
                      disabled={pending}
                      autoComplete="organization"
                      aria-invalid={companyNameError ? true : undefined}
                      aria-describedby={companyNameError ? "companyName-error" : undefined}
                      onChange={(event) => {
                        setCompanyName(event.target.value);
                        setCompanyNameError(null);
                      }}
                    />
                    {companyNameError ? (
                      <p id="companyName-error" className={styles.error} role="alert">
                        {companyNameError}
                      </p>
                    ) : null}
                  </label>
                </div>
                {addError ? (
                  <p className={styles.error} role="alert">
                    {addError}
                  </p>
                ) : null}
                <div className={styles.learnerActions}>
                  <button type="submit" className={styles.primaryBtn} disabled={pending}>
                    Add employer
                  </button>
                </div>
              </form>
            </article>
          </section>
        ) : null}

        <section className={styles.stack} aria-labelledby="employer-list-heading">
          <h2 id="employer-list-heading" className={styles.formGroupTitle}>
            Employers
          </h2>
          <label className={styles.registrySearch}>
            <span className={styles.registrySearchLabel}>Search employers</span>
            <input
              type="search"
              value={query}
              placeholder="Search by company, ID, site, or manager"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          {rows.length === 0 ? (
            <p className={styles.empty} role="status">
              No employers yet.
            </p>
          ) : visible.length === 0 ? (
            <p className={styles.empty} role="status">
              No employers match this search.
            </p>
          ) : (
            <ul className={styles.pillList} data-employer-list="live">
              {visible.map((employer) => {
                const open = employer.employerId === openId;
                return (
                  <li
                    key={employer.employerId}
                    className={styles.employerBlock}
                    data-employer-id={employer.employerId}
                  >
                    <button
                      type="button"
                      className={`${styles.pillRow} ${styles.employerRow} ${styles.rowButton}`}
                      aria-expanded={open}
                      onClick={() => toggle(employer)}
                    >
                      <span className={styles.pillName}>{employer.companyName}</span>
                      <span className={styles.pillMeta}>
                        <span className={styles.assignedId}>{employer.employerId}</span>
                        <span>{employerSummary(employer)}</span>
                      </span>
                    </button>
                    {open && openEmployer ? (
                      <EmployerEditor
                        employer={openEmployer}
                        canWrite={canWrite}
                        pending={pending}
                        nameDraft={nameDraft}
                        nameError={nameError}
                        panelError={panelError}
                        siteChoice={siteChoice}
                        siteError={siteError}
                        managerDraft={managerDraft}
                        managerErrors={managerErrors}
                        onNameDraft={setNameDraft}
                        onClearNameError={() => setNameError(null)}
                        onSiteChoice={setSiteChoice}
                        onManagerDraft={setManagerDraft}
                        onManagerErrors={setManagerErrors}
                        onRename={(event) => onRename(event, openEmployer)}
                        onAddSite={(event) => onAddSite(event, openEmployer)}
                        onRemoveSite={(siteId) => onRemoveSite(openEmployer, siteId)}
                        onSaveManager={(event) => onSaveManager(event, openEmployer)}
                        onEditManager={(manager) => {
                          setManagerDraft({
                            id: manager.id,
                            firstName: manager.firstName,
                            lastName: manager.lastName,
                            phone: manager.phone ?? "",
                            email: manager.email ?? "",
                            siteId: manager.siteId ?? "",
                          });
                          setManagerErrors({});
                          setPanelError(null);
                        }}
                        onCancelManager={() => {
                          setManagerDraft(BLANK_MANAGER);
                          setManagerErrors({});
                        }}
                        onRemoveManager={(managerId) => onRemoveManager(openEmployer, managerId)}
                      />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </ApprenticePageShell>
  );
}

function availableAreas(employer: EmployerListItem) {
  const taken = new Set(employer.sites.map((site) => site.areaName));
  return EMPLOYER_AREAS.filter((area) => !taken.has(area));
}

function EmployerEditor({
  employer,
  canWrite,
  pending,
  nameDraft,
  nameError,
  panelError,
  siteChoice,
  siteError,
  managerDraft,
  managerErrors,
  onNameDraft,
  onClearNameError,
  onSiteChoice,
  onManagerDraft,
  onManagerErrors,
  onRename,
  onAddSite,
  onRemoveSite,
  onSaveManager,
  onEditManager,
  onCancelManager,
  onRemoveManager,
}: {
  employer: EmployerListItem;
  canWrite: boolean;
  pending: boolean;
  nameDraft: string;
  nameError: string | null;
  panelError: string | null;
  siteChoice: string;
  siteError: string | null;
  managerDraft: ManagerDraft;
  managerErrors: EmployerFieldErrors;
  onNameDraft: (value: string) => void;
  onClearNameError: () => void;
  onSiteChoice: (value: string) => void;
  onManagerDraft: (value: ManagerDraft) => void;
  onManagerErrors: (value: EmployerFieldErrors) => void;
  onRename: (event: FormEvent<HTMLFormElement>) => void;
  onAddSite: (event: FormEvent<HTMLFormElement>) => void;
  onRemoveSite: (siteId: string) => void;
  onSaveManager: (event: FormEvent<HTMLFormElement>) => void;
  onEditManager: (manager: EmployerManager) => void;
  onCancelManager: () => void;
  onRemoveManager: (managerId: string) => void;
}) {
  const areas = availableAreas(employer);
  const selectedArea = areas.some((area) => area === siteChoice) ? siteChoice : (areas[0] ?? "");
  const siteOptions = [
    { value: "", label: "No site" },
    ...employer.sites.map((site) => ({ value: site.id, label: site.areaName })),
  ];

  function setManagerField(field: keyof ManagerDraft, value: string) {
    onManagerDraft({ ...managerDraft, [field]: value });
    if (field === "id") return;
    const errorField = field as EmployerField;
    if (!managerErrors[errorField]) return;
    const next = { ...managerErrors };
    delete next[errorField];
    onManagerErrors(next);
  }

  return (
    <div className={styles.panel} data-employer-detail={employer.employerId}>
      {canWrite ? (
        <form onSubmit={onRename} noValidate>
          <label className={styles.learnerField} data-entry-field="editCompanyName">
            <span>
              Company name <em className={styles.fieldRequired}>required</em>
            </span>
            <input
              type="text"
              value={nameDraft}
              required
              disabled={pending}
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? "edit-company-error" : undefined}
              onChange={(event) => {
                onNameDraft(event.target.value);
                onClearNameError();
              }}
            />
            {nameError ? (
              <p id="edit-company-error" className={styles.error} role="alert">
                {nameError}
              </p>
            ) : null}
          </label>
          <div className={styles.learnerActions}>
            <button type="submit" className={styles.secondaryBtn} disabled={pending}>
              Save name
            </button>
          </div>
        </form>
      ) : null}

      {panelError ? (
        <p className={styles.error} role="alert">
          {panelError}
        </p>
      ) : null}

      <section className={styles.stack} aria-labelledby={`sites-${employer.employerId}`}>
        <h3 id={`sites-${employer.employerId}`} className={styles.formGroupTitle}>
          Sites
        </h3>
        <p className={styles.formGroupMeta}>
          Removing a site keeps its managers on the employer, without a site.
        </p>
        {employer.sites.length === 0 ? (
          <p className={styles.empty}>No sites yet.</p>
        ) : (
          <ul className={styles.pillList} data-site-list={employer.employerId}>
            {employer.sites.map((site) => (
              <li key={site.id} className={`${styles.pillRow} ${styles.employerRow}`} data-site-area={site.areaName}>
                <span className={styles.pillName}>{site.areaName}</span>
                {canWrite ? (
                  <button
                    type="button"
                    className={`${styles.dangerBtn} ${styles.compactBtn}`}
                    disabled={pending}
                    onClick={() => onRemoveSite(site.id)}
                  >
                    Remove
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {canWrite && areas.length > 0 ? (
          <form onSubmit={onAddSite} noValidate>
            <div className={styles.learnerField} data-entry-field="areaName">
              <span id={`area-${employer.employerId}-label`}>Site</span>
              <Select
                aria-label="Site"
                value={selectedArea}
                disabled={pending}
                invalid={Boolean(siteError)}
                options={areas.map((area) => ({ value: area, label: area }))}
                onChange={onSiteChoice}
              />
              {siteError ? (
                <p className={styles.error} role="alert">
                  {siteError}
                </p>
              ) : null}
            </div>
            <div className={styles.learnerActions}>
              <button type="submit" className={styles.secondaryBtn} disabled={pending}>
                Add site
              </button>
            </div>
          </form>
        ) : null}
        {canWrite && areas.length === 0 ? (
          <p className={styles.formGroupMeta}>Doncaster, Hull, and Sheffield are already on this employer.</p>
        ) : null}
      </section>

      <section className={styles.stack} aria-labelledby={`managers-${employer.employerId}`}>
        <h3 id={`managers-${employer.employerId}`} className={styles.formGroupTitle}>
          Managers
        </h3>
        {employer.managers.length === 0 ? (
          <p className={styles.empty}>No managers yet.</p>
        ) : (
          <ul className={styles.pillList} data-manager-list={employer.employerId}>
            {employer.managers.map((manager) => (
              <li key={manager.id} className={`${styles.pillRow} ${styles.employerRow}`} data-manager-id={manager.id}>
                <span>
                  <span className={styles.pillName}>{formatManagerName(manager)}</span>
                  <span className={styles.pillMeta}>
                    {[manager.phone, manager.email, managerSiteLabel(manager, employer.sites)]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                {canWrite ? (
                  <span className={styles.rowActions}>
                    <button
                      type="button"
                      className={`${styles.secondaryBtn} ${styles.compactBtn}`}
                      disabled={pending}
                      onClick={() => onEditManager(manager)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className={`${styles.dangerBtn} ${styles.compactBtn}`}
                      disabled={pending}
                      onClick={() => onRemoveManager(manager.id)}
                    >
                      Remove
                    </button>
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {canWrite ? (
          <form onSubmit={onSaveManager} noValidate data-manager-form={managerDraft.id ? "edit" : "add"}>
            <h4 className={styles.formGroupTitle}>
              {managerDraft.id ? "Edit manager" : "Add manager"}
            </h4>
            <div className={styles.learnerGrid}>
              <ManagerText
                field="firstName"
                label="First name"
                required
                value={managerDraft.firstName}
                error={managerErrors.firstName}
                disabled={pending}
                autoComplete="given-name"
                onChange={setManagerField}
              />
              <ManagerText
                field="lastName"
                label="Last name"
                required
                value={managerDraft.lastName}
                error={managerErrors.lastName}
                disabled={pending}
                autoComplete="family-name"
                onChange={setManagerField}
              />
              <ManagerText
                field="phone"
                label="Phone"
                value={managerDraft.phone}
                error={managerErrors.phone}
                disabled={pending}
                autoComplete="tel"
                inputMode="tel"
                onChange={setManagerField}
              />
              <ManagerText
                field="email"
                label="Email"
                value={managerDraft.email}
                error={managerErrors.email}
                disabled={pending}
                autoComplete="email"
                type="email"
                onChange={setManagerField}
              />
              <div className={styles.learnerField} data-entry-field="siteId">
                <span>Site</span>
                <Select
                  aria-label="Manager site"
                  value={managerDraft.siteId}
                  disabled={pending}
                  invalid={Boolean(managerErrors.siteId)}
                  options={siteOptions}
                  onChange={(value) => setManagerField("siteId", value)}
                />
                {managerErrors.siteId ? (
                  <p className={styles.error} role="alert">
                    {managerErrors.siteId}
                  </p>
                ) : null}
              </div>
            </div>
            <div className={styles.learnerActions}>
              <button type="submit" className={styles.primaryBtn} disabled={pending}>
                {managerDraft.id ? "Save manager" : "Add manager"}
              </button>
              {managerDraft.id ? (
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  disabled={pending}
                  onClick={onCancelManager}
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
        ) : null}
      </section>
    </div>
  );
}

function ManagerText({
  field,
  label,
  value,
  error,
  required = false,
  disabled,
  autoComplete,
  type = "text",
  inputMode,
  onChange,
}: {
  field: "firstName" | "lastName" | "phone" | "email";
  label: string;
  value: string;
  error?: string;
  required?: boolean;
  disabled: boolean;
  autoComplete: string;
  type?: "text" | "email";
  inputMode?: "tel";
  onChange: (field: "firstName" | "lastName" | "phone" | "email", value: string) => void;
}) {
  const errorId = error ? `${field}-error` : undefined;
  return (
    <label className={styles.learnerField} data-entry-field={field}>
      <span>
        {label}
        {required ? <em className={styles.fieldRequired}> required</em> : null}
      </span>
      <input
        type={type}
        value={value}
        required={required}
        disabled={disabled}
        autoComplete={autoComplete}
        inputMode={inputMode}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        onChange={(event) => onChange(field, event.target.value)}
      />
      {error ? (
        <p id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </label>
  );
}
