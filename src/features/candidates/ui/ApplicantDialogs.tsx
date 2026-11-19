"use client";

import { useMemo, useState } from "react";
import { linkCandidateEmployerAction, recordVacancyInterestAction, updateCandidateDetailsAction } from "../actions";
import type { ApplicantTracking } from "../load";
import type { EmployerChoice } from "../domain/employers";

export function EditDetailsButton({
  returnTo,
  candidateId,
  tracking,
  programmes,
  centres,
  sources,
  startOpen = false,
}: {
  returnTo: string;
  candidateId: string;
  tracking: ApplicantTracking;
  programmes: { id: string; label: string }[];
  centres: { id: string; name: string }[];
  sources: { id: string; label: string }[];
  startOpen?: boolean;
}) {
  const [open, setOpen] = useState(startOpen);
  if (!open) return <button className="btn-secondary" type="button" onClick={() => setOpen(true)}>Edit details</button>;
  return (
    <div className="overlay" role="presentation">
      <form className="dialog" action={updateCandidateDetailsAction}>
        <h2>Edit details</h2>
        <p className="muted">Saves onto this applicant and adds a line to the audit trail. The applicant ID stays the same.</p>
        <input type="hidden" name="returnTo" value={returnTo} />
        <input type="hidden" name="candidateId" value={candidateId} />
        <div className="form-grid" style={{ marginTop: 12 }}>
          <label className="field"><span className="label">First name</span><input name="firstName" required defaultValue={tracking.firstName} /></label>
          <label className="field"><span className="label">Middle names</span><input name="middleNames" defaultValue={tracking.middleNames ?? ""} /></label>
          <label className="field"><span className="label">Last name</span><input name="lastName" required defaultValue={tracking.lastName} /></label>
          <label className="field"><span className="label">Email</span><input name="email" type="email" required defaultValue={tracking.email ?? ""} /></label>
          <label className="field"><span className="label">Phone</span><input name="phone" required defaultValue={tracking.phone ?? ""} /></label>
          <label className="field"><span className="label">Original first-contact date</span><input name="firstContact" type="date" required defaultValue={tracking.firstContactOn} /></label>
          <label className="field"><span className="label">Centre</span>
            <select name="centreId" required defaultValue={tracking.centreId}>
              {centres.map((centre) => <option key={centre.id} value={centre.id}>{centre.name}</option>)}
            </select>
          </label>
          <label className="field"><span className="label">Programme</span>
            <select name="programmeId" required defaultValue={tracking.programmeId}>
              {programmes.map((programme) => <option key={programme.id} value={programme.id}>{programme.label}</option>)}
            </select>
          </label>
          <label className="field"><span className="label">Enquiry source</span>
            <select name="sourceId" required defaultValue={tracking.sourceId}>
              {sources.map((source) => <option key={source.id} value={source.id}>{source.label}</option>)}
            </select>
          </label>
          <label className="field wide"><span className="label">Source detail</span><input name="sourceDetail" defaultValue={tracking.sourceDetail ?? ""} /></label>
          <label className="field wide"><span className="label">Notes</span><textarea name="notes" defaultValue={tracking.notes ?? ""} /></label>
        </div>
        <div className="dialog-actions">
          <button className="btn-secondary" type="button" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn" type="submit">Save details</button>
        </div>
      </form>
    </div>
  );
}

export function EmployerLinkButton({
  returnTo,
  candidateId,
  tracking,
  employers,
  startOpen = false,
}: {
  returnTo: string;
  candidateId: string;
  tracking: ApplicantTracking;
  employers: EmployerChoice[];
  startOpen?: boolean;
}) {
  const [open, setOpen] = useState(startOpen);
  const [employerId, setEmployerId] = useState(tracking.employerId ?? "");
  const [status, setStatus] = useState(tracking.employerStatusCode || "needed");
  const sites = useMemo(() => tracking.sites.filter((site) => site.employerId === employerId), [tracking.sites, employerId]);
  const managers = useMemo(() => tracking.managers.filter((manager) => manager.employerId === employerId), [tracking.managers, employerId]);
  if (!open) return <button className="btn-secondary" type="button" onClick={() => setOpen(true)}>Link employer</button>;
  return (
    <div className="overlay" role="presentation">
      <form className="dialog" action={linkCandidateEmployerAction}>
        <h2>Link a potential employer</h2>
        <p className="muted">Identified means a possible employer. Confirmed means the employer is agreed. Needed clears the link.</p>
        <input type="hidden" name="returnTo" value={returnTo} />
        <input type="hidden" name="candidateId" value={candidateId} />
        <div className="form-grid" style={{ marginTop: 12 }}>
          <label className="field"><span className="label">Status</span>
            <select name="employerStatus" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="needed">Employer needed</option>
              <option value="identified">Identified</option>
              <option value="confirmed">Confirmed</option>
            </select>
          </label>
          <label className="field wide"><span className="label">Employer</span>
            <select name="employerId" value={employerId} onChange={(event) => setEmployerId(event.target.value)}>
              <option value="">No employer</option>
              {employers.map((employer) => <option key={employer.employerId} value={employer.employerId}>{employer.name}</option>)}
            </select>
          </label>
          <label className="field"><span className="label">Site</span>
            <select name="employerSiteId" defaultValue={tracking.employerSiteId ?? ""}>
              <option value="">No site</option>
              {sites.map((site) => <option key={site.id} value={site.id}>{site.label}</option>)}
            </select>
          </label>
          <label className="field"><span className="label">Manager</span>
            <select name="employerManagerId" defaultValue={tracking.employerManagerId ?? ""}>
              <option value="">No manager</option>
              {managers.map((manager) => <option key={manager.id} value={manager.id}>{manager.label}</option>)}
            </select>
          </label>
        </div>
        <div className="dialog-actions">
          <button className="btn-secondary" type="button" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn" type="submit">Save employer</button>
        </div>
      </form>
    </div>
  );
}

export function VacancyLinkButton({
  returnTo,
  candidateId,
  tracking,
  employers,
  startOpen = false,
}: {
  returnTo: string;
  candidateId: string;
  tracking: ApplicantTracking;
  employers: EmployerChoice[];
  startOpen?: boolean;
}) {
  const [open, setOpen] = useState(startOpen);
  const [employerId, setEmployerId] = useState(tracking.employerId ?? "");
  const vacancies = tracking.vacancies.filter((vacancy) => !employerId || vacancy.employerId === employerId);
  const employerName = new Map(employers.map((employer) => [employer.employerId, employer.name]));
  if (!open) return <button className="btn-secondary" type="button" onClick={() => setOpen(true)}>Link vacancy</button>;
  return (
    <div className="overlay" role="presentation">
      <form className="dialog" action={recordVacancyInterestAction}>
        <h2>Link a vacancy</h2>
        <p className="muted">This records interest only: proposed, applied, offered, declined or withdrawn. A place on the vacancy is still allocated later, after the employer is confirmed and Stage 2 is approved.</p>
        <input type="hidden" name="returnTo" value={returnTo} />
        <input type="hidden" name="candidateId" value={candidateId} />
        {tracking.vacancyInterestsReady ? null : (
          <div className="banner banner-amber" role="status"><div>The vacancy interest table is not applied yet, so this cannot be saved. The form is here to review.</div></div>
        )}
        <div className="form-grid" style={{ marginTop: 12 }}>
          <label className="field"><span className="label">Employer filter</span>
            <select value={employerId} onChange={(event) => setEmployerId(event.target.value)}>
              <option value="">All open vacancies</option>
              {[...new Set(tracking.vacancies.map((vacancy) => vacancy.employerId))].map((id) => (
                <option key={id} value={id}>{employerName.get(id) || id}</option>
              ))}
            </select>
          </label>
          <label className="field wide"><span className="label">Vacancy</span>
            <select name="vacancyId" required={tracking.vacancyInterestsReady} defaultValue="">
              <option value="">Choose a vacancy</option>
              {vacancies.map((vacancy) => <option key={vacancy.id} value={vacancy.id}>{vacancy.title} · {vacancy.status}</option>)}
            </select>
          </label>
          <label className="field"><span className="label">Interest</span>
            <select name="interestStatus" defaultValue="proposed">
              <option value="proposed">Proposed</option>
              <option value="applied">Applied</option>
              <option value="offered">Offered</option>
              <option value="declined">Declined</option>
              <option value="withdrawn">Withdrawn</option>
            </select>
          </label>
          <label className="field wide"><span className="label">Notes</span><textarea name="notes" /></label>
        </div>
        <div className="dialog-actions">
          <button className="btn-secondary" type="button" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn" type="submit" disabled={!tracking.vacancyInterestsReady}>Save interest</button>
        </div>
      </form>
    </div>
  );
}
