"use client";

import { useEffect, useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Select } from "@/components/ui";
import { ApprenticePageShell } from "@/features/apprentice-portal/components/ApprenticePageShell";
import {
  apprenticeLearnerPath,
  apprenticeListWorkspace,
  formatTutorDate,
} from "../domain/apprentice-tutor";
import { isUkPostcode, normaliseUkPostcode } from "../domain/postcode-area";
import {
  addEmployerAction,
  addEmployerSiteAction,
  lookupEmployerPostcodeAction,
  removeEmployerManagerAction,
  renameEmployerAction,
  saveEmployerManagerAction,
  setEmployerSiteActiveAction,
  updateEmployerSiteAction,
} from "./employer-actions";
import {
  DUPLICATE_POSTCODE,
  LAST_SITE_MESSAGE,
  POSTCODE_FORMAT_MESSAGE,
  canDeactivateSite,
  employerMatchesQuery,
  employerSummary,
  formatManagerName,
  managerSiteLabel,
  placementLocation,
  placementManagerLabel,
  placementPostcode,
  placementsForSite,
  siteChoiceLabel,
  siteLabel,
  sortEmployers,
  validateCompanyName,
  validateManagerInput,
  validateSiteInput,
  withManager,
  withSite,
  withoutManager,
  type EmployerField,
  type EmployerFieldErrors,
  type EmployerListItem,
  type EmployerManager,
  type EmployerMutationResult,
  type SiteInput,
} from "../domain/employer-record";
import styles from "./admin-pages.module.css";

type SiteDraft = SiteInput & {
  id: string | null;
  areaEdited: boolean;
};

type ManagerDraft = {
  id: string | null;
  firstName: string;
  middleNames: string;
  lastName: string;
  phone: string;
  email: string;
  siteId: string;
};

const BLANK_SITE: SiteDraft = {
  id: null,
  postcode: "",
  areaName: "",
  areaEdited: false,
};

const BLANK_MANAGER: ManagerDraft = {
  id: null,
  firstName: "",
  middleNames: "",
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
  const pathname = usePathname() ?? "/administration/onboarding/employer";
  const workspace = apprenticeListWorkspace(pathname);
  const [rows, setRows] = useState(employers);
  const [loaded, setLoaded] = useState(employers);
  const [query, setQuery] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [newSite, setNewSite] = useState<SiteDraft>(BLANK_SITE);
  const [addErrors, setAddErrors] = useState<EmployerFieldErrors>({});
  const [addError, setAddError] = useState<string | null>(null);
  const [assignedId, setAssignedId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(initialOpenId);
  const [pending, setPending] = useState(false);
  const [nameDraft, setNameDraft] = useState(
    () => employers.find((employer) => employer.employerId === initialOpenId)?.companyName ?? "",
  );
  const [nameError, setNameError] = useState<string | null>(null);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [siteDraft, setSiteDraft] = useState<SiteDraft>(BLANK_SITE);
  const [siteErrors, setSiteErrors] = useState<EmployerFieldErrors>({});
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
    setSiteDraft(BLANK_SITE);
    setSiteErrors({});
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
    const company = validateCompanyName(companyName);
    const site = validateSiteInput(newSite, []);
    if (!company.ok || !site.ok) {
      setAddErrors({
        ...(company.ok ? {} : company.fieldErrors),
        ...(site.ok ? {} : site.fieldErrors),
      });
      setAssignedId(null);
      return;
    }
    setAddErrors({});
    const result = await run(() =>
      addEmployerAction({
        companyName: company.companyName,
        site: newSite,
      }),
    );
    if (!result) return;
    if (!result.ok) {
      setAddErrors(result.fieldErrors);
      setAddError(result.formError);
      setAssignedId(null);
      return;
    }
    setAssignedId(result.value.employerId);
    setCompanyName("");
    setNewSite(BLANK_SITE);
    setQuery("");
    setRows((current) => sortEmployers([...current, result.value]));
    setOpenId(result.value.employerId);
    setNameDraft(result.value.companyName);
    setNameError(null);
    setPanelError(null);
    setSiteDraft(BLANK_SITE);
    setSiteErrors({});
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

  async function onSaveSite(event: FormEvent<HTMLFormElement>, employer: EmployerListItem) {
    event.preventDefault();
    setPanelError(null);
    const existingPostcodes = employer.sites
      .filter((site) => site.id !== siteDraft.id)
      .map((site) => site.postcode);
    const parsed = validateSiteInput(siteDraft, existingPostcodes);
    if (!parsed.ok) {
      setSiteErrors(parsed.fieldErrors);
      return;
    }
    setSiteErrors({});
    const result = await run(() =>
      siteDraft.id
        ? updateEmployerSiteAction({
            employerId: employer.employerId,
            siteId: siteDraft.id,
            site: siteDraft,
            existingPostcodes,
          })
        : addEmployerSiteAction({
            employerId: employer.employerId,
            site: siteDraft,
            existingPostcodes,
          }),
    );
    if (!result || !result.ok) {
      if (result && !result.ok) {
        setSiteErrors(result.fieldErrors);
        setPanelError(result.formError);
      }
      return;
    }
    replace(employer.employerId, withSite(employer, result.value));
    setSiteDraft(BLANK_SITE);
  }

  async function onSetSiteActive(
    employer: EmployerListItem,
    siteId: string,
    isActive: boolean,
  ) {
    setPanelError(null);
    setSiteErrors({});
    if (!isActive && !canDeactivateSite(employer.sites, siteId)) {
      setPanelError(LAST_SITE_MESSAGE);
      return;
    }
    const result = await run(() =>
      setEmployerSiteActiveAction({
        employerId: employer.employerId,
        siteId,
        isActive,
      }),
    );
    if (!result || !result.ok) {
      if (result && !result.ok) setPanelError(result.formError);
      return;
    }
    replace(employer.employerId, withSite(employer, result.value));
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
      title="Add employers"
      description="Company name is required, and so is a first site with a postcode. The database assigns the employer ID."
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
              The first site is saved with the employer. The location fills in from the postcode, and you can change it.
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
                      aria-invalid={addErrors.companyName ? true : undefined}
                      aria-describedby={addErrors.companyName ? "companyName-error" : undefined}
                      onChange={(event) => {
                        setCompanyName(event.target.value);
                        setAddErrors((current) => clearField(current, "companyName"));
                      }}
                    />
                    {addErrors.companyName ? (
                      <p id="companyName-error" className={styles.error} role="alert">
                        {addErrors.companyName}
                      </p>
                    ) : null}
                  </label>
                  <PostcodeFields
                    idPrefix="new-site"
                    draft={newSite}
                    errors={addErrors}
                    takenPostcodes={[]}
                    pending={pending}
                    onDraft={setNewSite}
                    onErrors={setAddErrors}
                  />
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
              placeholder="Search by company, postcode, site, apprentice, or manager"
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
                        workspace={workspace}
                        canWrite={canWrite}
                        pending={pending}
                        nameDraft={nameDraft}
                        nameError={nameError}
                        panelError={panelError}
                        siteDraft={siteDraft}
                        siteErrors={siteErrors}
                        managerDraft={managerDraft}
                        managerErrors={managerErrors}
                        onNameDraft={setNameDraft}
                        onClearNameError={() => setNameError(null)}
                        onSiteDraft={setSiteDraft}
                        onSiteErrors={setSiteErrors}
                        onManagerDraft={setManagerDraft}
                        onManagerErrors={setManagerErrors}
                        onRename={(event) => onRename(event, openEmployer)}
                        onSaveSite={(event) => onSaveSite(event, openEmployer)}
                        onEditSite={(site) => {
                          setSiteDraft({
                            id: site.id,
                            postcode: site.postcode,
                            areaName: site.areaName,
                            areaEdited: true,
                          });
                          setSiteErrors({});
                          setPanelError(null);
                        }}
                        onCancelSite={() => {
                          setSiteDraft(BLANK_SITE);
                          setSiteErrors({});
                        }}
                        onSetSiteActive={(siteId, isActive) =>
                          onSetSiteActive(openEmployer, siteId, isActive)
                        }
                        onSaveManager={(event) => onSaveManager(event, openEmployer)}
                        onEditManager={(manager) => {
                          setManagerDraft({
                            id: manager.id,
                            firstName: manager.firstName,
                            middleNames: manager.middleNames ?? "",
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

function EmployerEditor({
  employer,
  workspace,
  canWrite,
  pending,
  nameDraft,
  nameError,
  panelError,
  siteDraft,
  siteErrors,
  managerDraft,
  managerErrors,
  onNameDraft,
  onClearNameError,
  onSiteDraft,
  onSiteErrors,
  onManagerDraft,
  onManagerErrors,
  onRename,
  onSaveSite,
  onEditSite,
  onCancelSite,
  onSetSiteActive,
  onSaveManager,
  onEditManager,
  onCancelManager,
  onRemoveManager,
}: {
  employer: EmployerListItem;
  workspace: "administration" | "management";
  canWrite: boolean;
  pending: boolean;
  nameDraft: string;
  nameError: string | null;
  panelError: string | null;
  siteDraft: SiteDraft;
  siteErrors: EmployerFieldErrors;
  managerDraft: ManagerDraft;
  managerErrors: EmployerFieldErrors;
  onNameDraft: (value: string) => void;
  onClearNameError: () => void;
  onSiteDraft: Dispatch<SetStateAction<SiteDraft>>;
  onSiteErrors: Dispatch<SetStateAction<EmployerFieldErrors>>;
  onManagerDraft: (value: ManagerDraft) => void;
  onManagerErrors: (value: EmployerFieldErrors) => void;
  onRename: (event: FormEvent<HTMLFormElement>) => void;
  onSaveSite: (event: FormEvent<HTMLFormElement>) => void;
  onEditSite: (site: EmployerListItem["sites"][number]) => void;
  onCancelSite: () => void;
  onSetSiteActive: (siteId: string, isActive: boolean) => void;
  onSaveManager: (event: FormEvent<HTMLFormElement>) => void;
  onEditManager: (manager: EmployerManager) => void;
  onCancelManager: () => void;
  onRemoveManager: (managerId: string) => void;
}) {
  const activeCount = employer.sites.filter((site) => site.isActive).length;
  const takenPostcodes = employer.sites
    .filter((site) => site.id !== siteDraft.id)
    .map((site) => site.postcode);
  const siteOptions = [
    { value: "", label: "No site" },
    ...employer.sites.map((site) => ({
      value: site.id,
      label: siteLabel(site, { markInactive: true }),
    })),
  ];

  function setManagerField(field: keyof ManagerDraft, value: string) {
    onManagerDraft({ ...managerDraft, [field]: value });
    if (field === "id") return;
    const errorField = field as EmployerField;
    if (!managerErrors[errorField]) return;
    onManagerErrors(clearField(managerErrors, errorField));
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
          Each site needs a postcode. Deactivating a site keeps it here. The last active site stays on the employer.
        </p>
        {employer.sites.length === 0 ? (
          <p className={styles.empty}>No sites yet.</p>
        ) : (
          <ul className={styles.pillList} data-site-list={employer.employerId}>
            {employer.sites.map((site) => (
              <li
                key={site.id}
                className={`${styles.pillRow} ${styles.employerRow} ${site.isActive ? "" : styles.siteInactive}`}
                data-site-postcode={site.postcode}
                data-site-active={site.isActive ? "true" : "false"}
              >
                <span>
                  <span className={styles.pillName}>{site.postcode}</span>
                  <span className={styles.pillMeta}>
                    <span>{site.areaName}</span>
                    {site.isActive ? null : <span>Inactive</span>}
                  </span>
                </span>
                {canWrite ? (
                  <span className={styles.rowActions}>
                    <button
                      type="button"
                      className={`${styles.secondaryBtn} ${styles.compactBtn}`}
                      disabled={pending}
                      onClick={() => onEditSite(site)}
                    >
                      Edit
                    </button>
                    {site.isActive && activeCount > 1 ? (
                      <button
                        type="button"
                        className={`${styles.dangerBtn} ${styles.compactBtn}`}
                        disabled={pending}
                        onClick={() => onSetSiteActive(site.id, false)}
                      >
                        Deactivate
                      </button>
                    ) : null}
                    {site.isActive ? null : (
                      <button
                        type="button"
                        className={`${styles.secondaryBtn} ${styles.compactBtn}`}
                        disabled={pending}
                        onClick={() => onSetSiteActive(site.id, true)}
                      >
                        Make active
                      </button>
                    )}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {canWrite && activeCount <= 1 ? (
          <p className={styles.formGroupMeta}>{LAST_SITE_MESSAGE}</p>
        ) : null}
        {canWrite ? (
          <form onSubmit={onSaveSite} noValidate data-site-form={siteDraft.id ? "edit" : "add"}>
            <h4 className={styles.formGroupTitle}>{siteDraft.id ? "Edit site" : "Add site"}</h4>
            <div className={styles.learnerGrid}>
              <PostcodeFields
                idPrefix={`site-${employer.employerId}`}
                draft={siteDraft}
                errors={siteErrors}
                takenPostcodes={takenPostcodes}
                pending={pending}
                onDraft={onSiteDraft}
                onErrors={onSiteErrors}
              />
            </div>
            <div className={styles.learnerActions}>
              <button type="submit" className={styles.secondaryBtn} disabled={pending}>
                {siteDraft.id ? "Save site" : "Add site"}
              </button>
              {siteDraft.id ? (
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  disabled={pending}
                  onClick={onCancelSite}
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
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
                field="middleNames"
                label="Middle name"
                value={managerDraft.middleNames}
                error={managerErrors.middleNames}
                disabled={pending}
                autoComplete="additional-name"
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

      <ApprenticesSection employer={employer} workspace={workspace} />
    </div>
  );
}

function ApprenticesSection({
  employer,
  workspace,
}: {
  employer: EmployerListItem;
  workspace: "administration" | "management";
}) {
  const [siteId, setSiteId] = useState("");
  const current = placementsForSite(employer.placements, siteId);
  const past = placementsForSite(employer.pastPlacements, siteId);
  const atSite = Boolean(siteId);

  return (
    <section className={styles.stack} aria-labelledby={`apprentices-${employer.employerId}`}>
      <h3 id={`apprentices-${employer.employerId}`} className={styles.formGroupTitle}>
        Apprentices
      </h3>
      <div className={styles.learnerField} data-apprentice-filter="site">
        <span>Site</span>
        <Select
          aria-label="Site"
          value={siteId}
          placeholder="All sites"
          options={[
            { value: "", label: "All sites" },
            ...employer.sites.map((site) => ({ value: site.id, label: siteChoiceLabel(site) })),
          ]}
          onChange={setSiteId}
        />
      </div>
      <h4 className={styles.formGroupTitle}>Current apprentices</h4>
      {current.length === 0 ? (
        <p className={styles.empty} role="status">
          {atSite ? "No current apprentices at this site." : "No current apprentices."}
        </p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table} data-current-apprentices={employer.employerId}>
            <thead>
              <tr>
                <th>Learner</th>
                <th>GTA ID</th>
                <th>Postcode</th>
                <th>Location</th>
                <th>Manager</th>
                <th>Start</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {current.map((placement) => (
                <tr
                  key={placement.id}
                  data-current-apprentice={placement.gtaId}
                  data-placement-site={placement.siteId}
                >
                  <td>
                    <Link
                      className={styles.placementLink}
                      href={apprenticeLearnerPath(workspace, placement.gtaId)}
                    >
                      {placement.name}
                    </Link>
                  </td>
                  <td>{placement.gtaId}</td>
                  <td>{placementPostcode(placement, employer.sites)}</td>
                  <td>{placementLocation(placement, employer.sites)}</td>
                  <td>{placementManagerLabel(placement, employer.managers)}</td>
                  <td>{formatTutorDate(placement.startDate)}</td>
                  <td>{placement.statusLabel || "Status unavailable"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <h4 className={styles.formGroupTitle}>Past apprentices</h4>
      {past.length === 0 ? (
        <p className={styles.empty} role="status">
          {atSite ? "No past apprentices at this site." : "No past apprentices."}
        </p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table} data-past-apprentices={employer.employerId}>
            <thead>
              <tr>
                <th>Learner</th>
                <th>GTA ID</th>
                <th>Postcode</th>
                <th>Location</th>
                <th>Manager</th>
                <th>Start</th>
                <th>End</th>
                <th>End reason</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {past.map((placement) => (
                <tr
                  key={placement.id}
                  data-past-apprentice={placement.gtaId}
                  data-placement-site={placement.siteId}
                >
                  <td>
                    <Link
                      className={styles.placementLink}
                      href={apprenticeLearnerPath(workspace, placement.gtaId)}
                    >
                      {placement.name}
                    </Link>
                  </td>
                  <td>{placement.gtaId}</td>
                  <td>{placementPostcode(placement, employer.sites)}</td>
                  <td>{placementLocation(placement, employer.sites)}</td>
                  <td>{placementManagerLabel(placement, employer.managers)}</td>
                  <td>{formatTutorDate(placement.startDate)}</td>
                  <td>{placement.endDate ? formatTutorDate(placement.endDate) : "No end date"}</td>
                  <td>{placement.endReason?.trim() || "No end reason"}</td>
                  <td>{placement.statusLabel || "Status unavailable"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function PostcodeFields({
  idPrefix,
  draft,
  errors,
  takenPostcodes,
  pending,
  onDraft,
  onErrors,
}: {
  idPrefix: string;
  draft: SiteDraft;
  errors: EmployerFieldErrors;
  takenPostcodes: readonly string[];
  pending: boolean;
  onDraft: Dispatch<SetStateAction<SiteDraft>>;
  onErrors: Dispatch<SetStateAction<EmployerFieldErrors>>;
}) {
  const [lookupNote, setLookupNote] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);

  useEffect(() => {
    if (draft.areaEdited) return;
    const normalised = normaliseUkPostcode(draft.postcode);
    if (!isUkPostcode(normalised)) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        setLooking(true);
        const result = await lookupEmployerPostcodeAction(normalised);
        if (cancelled) return;
        setLooking(false);
        if (result.ok) {
          setLookupNote(null);
          onDraft((current) => {
            if (current.areaEdited || normaliseUkPostcode(current.postcode) !== normalised) {
              return current;
            }
            return { ...current, areaName: result.areaName };
          });
          return;
        }
        if (result.message !== POSTCODE_FORMAT_MESSAGE) setLookupNote(result.message);
      })();
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [draft.areaEdited, draft.postcode, onDraft]);

  function onPostcodeChange(value: string) {
    const previous = normaliseUkPostcode(draft.postcode);
    const next = normaliseUkPostcode(value);
    onDraft({
      ...draft,
      postcode: value,
      areaEdited: previous === next ? draft.areaEdited : false,
    });
    onErrors(clearField(errors, "postcode"));
    if (!isUkPostcode(next)) setLookupNote(null);
  }

  function onPostcodeBlur() {
    const normalised = normaliseUkPostcode(draft.postcode);
    if (!normalised) {
      onErrors({ ...clearField(errors, "postcode"), postcode: "Enter a postcode." });
      return;
    }
    if (!isUkPostcode(normalised)) {
      onErrors({ ...clearField(errors, "postcode"), postcode: POSTCODE_FORMAT_MESSAGE });
      setLookupNote(null);
      return;
    }
    if (takenPostcodes.some((existing) => normaliseUkPostcode(existing) === normalised)) {
      onErrors({ ...clearField(errors, "postcode"), postcode: DUPLICATE_POSTCODE });
      return;
    }
    onErrors(clearField(errors, "postcode"));
  }

  const postcodeHintId = `${idPrefix}-postcode-hint`;
  const areaHintId = `${idPrefix}-area-hint`;

  return (
    <>
      <label className={styles.learnerField} data-entry-field="postcode">
        <span>
          Postcode <em className={styles.fieldRequired}>required</em>
        </span>
        <input
          type="text"
          value={draft.postcode}
          required
          disabled={pending}
          autoComplete="postal-code"
          spellCheck={false}
          aria-invalid={errors.postcode ? true : undefined}
          aria-describedby={postcodeHintId}
          onChange={(event) => onPostcodeChange(event.target.value)}
          onBlur={onPostcodeBlur}
        />
        {errors.postcode ? (
          <p id={postcodeHintId} className={styles.error} role="alert">
            {errors.postcode}
          </p>
        ) : looking ? (
          <p id={postcodeHintId} className={styles.fieldHint} role="status">
            Looking up the location…
          </p>
        ) : lookupNote ? (
          <p id={postcodeHintId} className={styles.fieldHint} role="status" data-postcode-lookup={idPrefix}>
            {lookupNote}
          </p>
        ) : (
          <p id={postcodeHintId} className={styles.fieldHint}>
            The location fills in from the postcode. You can change it.
          </p>
        )}
      </label>
      <label className={styles.learnerField} data-entry-field="areaName">
        <span>
          Location <em className={styles.fieldRequired}>required</em>
        </span>
        <input
          type="text"
          value={draft.areaName}
          required
          disabled={pending}
          aria-invalid={errors.areaName ? true : undefined}
          aria-describedby={errors.areaName ? areaHintId : undefined}
          onChange={(event) => {
            onDraft({ ...draft, areaName: event.target.value, areaEdited: true });
            onErrors(clearField(errors, "areaName"));
          }}
        />
        {errors.areaName ? (
          <p id={areaHintId} className={styles.error} role="alert">
            {errors.areaName}
          </p>
        ) : null}
      </label>
    </>
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
  field: "firstName" | "middleNames" | "lastName" | "phone" | "email";
  label: string;
  value: string;
  error?: string;
  required?: boolean;
  disabled: boolean;
  autoComplete: string;
  type?: "text" | "email";
  inputMode?: "tel";
  onChange: (field: "firstName" | "middleNames" | "lastName" | "phone" | "email", value: string) => void;
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

function clearField(errors: EmployerFieldErrors, field: EmployerField): EmployerFieldErrors {
  if (!errors[field]) return errors;
  const next = { ...errors };
  delete next[field];
  return next;
}
