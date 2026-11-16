"use client";

import { useState } from "react";
import { addEmployerActivityAction, logCandidateContactAction } from "../actions";

/** Opens the contact form. The record’s own ID is supplied by the page, not typed. */
export function ContactEventButton({
  returnTo,
  candidateId,
  employerName,
}: {
  returnTo: string;
  candidateId?: string;
  employerName?: string;
}) {
  const [open, setOpen] = useState(false);
  const action = candidateId ? logCandidateContactAction : addEmployerActivityAction;

  return (
    <>
      <button className="btn" type="button" onClick={() => setOpen(true)}>
        Log contact event
      </button>
      {open ? (
        <div className="overlay" role="presentation">
          <form className="dialog" action={action}>
            <h2>Log contact event</h2>
            <p className="muted">The date you enter is the actual date of the contact. Saving records who entered it.</p>
            <input type="hidden" name="returnTo" value={returnTo} />
            {candidateId ? <input type="hidden" name="candidateId" value={candidateId} /> : null}
            {employerName ? <input type="hidden" name="employerName" value={employerName} /> : null}
            <div className="form-grid" style={{ marginTop: 12 }}>
              <label className="field">
                <span className="label">Type</span>
                <select name="activityType" defaultValue="Call">
                  <option>Call</option>
                  <option>Email</option>
                  <option>Visit</option>
                </select>
              </label>
              <label className="field">
                <span className="label">Actual date</span>
                <input name="actualOn" type="date" required />
              </label>
              <label className="field wide">
                <span className="label">Notes</span>
                <textarea name="notes" required />
              </label>
            </div>
            <div className="dialog-actions">
              <button className="btn-secondary" type="button" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn" type="submit">Save</button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
