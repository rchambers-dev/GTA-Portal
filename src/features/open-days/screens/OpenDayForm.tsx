"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormField, Select, TextArea, TextInput } from "@/components/ui";
import { ApprenticePageShell } from "@/features/apprentice-portal/components/ApprenticePageShell";
import admin from "@/features/administration/screens/admin-pages.module.css";
import { saveOpenDayAction } from "../actions";
import { OPEN_DAY_STATUS_LABELS, openDaysPath } from "../domain/format";
import { OPEN_DAY_STATUSES, type CentreOption, type OpenDayRecord, type OpenDaysMode } from "../domain/types";
import { formFromOpenDay, validateOpenDay, type OpenDayFieldErrors } from "../domain/validate";
import { OpenDaysNotice } from "./OpenDaysNotice";

export function OpenDayForm({
  workspace,
  day,
  centres,
  mode,
}: {
  workspace: "administration" | "management";
  day: OpenDayRecord | null;
  centres: CentreOption[];
  mode: OpenDaysMode;
}) {
  const router = useRouter();
  const locked = mode.example || Boolean(mode.savingMessage);
  const [form, setForm] = useState(() => formFromOpenDay(day, centres));
  const [fieldErrors, setFieldErrors] = useState<OpenDayFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked) {
      setFormError(mode.savingMessage ?? "Saving is disabled.");
      return;
    }
    const parsed = validateOpenDay(form, centres);
    if (!parsed.ok) {
      setFieldErrors(parsed.fieldErrors);
      setFormError("Check the highlighted fields.");
      return;
    }
    setFieldErrors({});
    setFormError(null);
    setPending(true);
    const result = await saveOpenDayAction(form);
    setPending(false);
    if (!result.ok) {
      setFieldErrors(result.fieldErrors ?? {});
      setFormError(result.message);
      return;
    }
    router.push(openDaysPath(workspace, result.id));
    router.refresh();
  }

  const title = day ? "Edit open day" : "New open day";
  return (
    <ApprenticePageShell
      eyebrow="Marketing & Recruitment"
      title={title}
      description="Published and closed days can be listed on the website. Draft and cancelled days stay off it. New sign-ups are accepted only while the day is published and bookings are open."
    >
      <form className={admin.stack} data-open-days="form" onSubmit={onSubmit}>
        <OpenDaysNotice banner={mode.banner} savingMessage={mode.savingMessage} error={mode.error} />
        <section className={admin.formGroup}>
          <div className={admin.formGroupHead}>
            <h2 className={admin.formGroupTitle}>Event</h2>
          </div>
          <div className={admin.formGrid}>
            <FormField label="Title" className={admin.fieldWide}>
              <TextInput
                value={form.title}
                disabled={locked || pending}
                invalid={Boolean(fieldErrors.title)}
                required
                onChange={(event) => set("title", event.target.value)}
              />
              <FieldError message={fieldErrors.title} />
            </FormField>
            <FormField label="Date label" hint="Optional display text, such as Saturday 15 August 2026.">
              <TextInput
                value={form.dateLabel}
                disabled={locked || pending}
                onChange={(event) => set("dateLabel", event.target.value)}
              />
            </FormField>
            <FormField label="Date">
              <TextInput
                type="date"
                value={form.dateOn}
                disabled={locked || pending}
                invalid={Boolean(fieldErrors.dateOn)}
                required
                onChange={(event) => set("dateOn", event.target.value)}
              />
              <FieldError message={fieldErrors.dateOn} />
            </FormField>
            <FormField label="Start time">
              <TextInput
                type="time"
                value={form.startTime}
                disabled={locked || pending}
                invalid={Boolean(fieldErrors.startTime)}
                onChange={(event) => set("startTime", event.target.value)}
              />
              <FieldError message={fieldErrors.startTime} />
            </FormField>
            <FormField label="End time">
              <TextInput
                type="time"
                value={form.endTime}
                disabled={locked || pending}
                invalid={Boolean(fieldErrors.endTime)}
                onChange={(event) => set("endTime", event.target.value)}
              />
              <FieldError message={fieldErrors.endTime} />
            </FormField>
            <FormField label="Status">
              <Select
                aria-label="Status"
                value={form.status}
                disabled={locked || pending}
                invalid={Boolean(fieldErrors.status)}
                options={OPEN_DAY_STATUSES.map((status) => ({
                  value: status,
                  label: OPEN_DAY_STATUS_LABELS[status],
                }))}
                onChange={(status) => set("status", status)}
              />
              <FieldError message={fieldErrors.status} />
            </FormField>
          </div>
        </section>

        <section className={admin.formGroup}>
          <div className={admin.formGroupHead}>
            <h2 className={admin.formGroupTitle}>Location</h2>
          </div>
          <div className={admin.formGrid}>
            <FormField label="Location type" className={admin.fieldWide}>
              <Select
                aria-label="Location type"
                value={form.locationMode}
                disabled={locked || pending}
                options={[
                  { value: "centre", label: "Doncaster or Sheffield centre" },
                  { value: "other", label: "Other location" },
                ]}
                onChange={(value) => set("locationMode", value === "other" ? "other" : "centre")}
              />
            </FormField>
            {form.locationMode === "centre" ? (
              <FormField
                label="Centre"
                hint={centres.length === 0 ? "Centres could not be loaded. Use another location." : undefined}
                className={admin.fieldWide}
              >
                <Select
                  aria-label="Centre"
                  value={form.centreId}
                  disabled={locked || pending || centres.length === 0}
                  invalid={Boolean(fieldErrors.centreId)}
                  placeholder="Choose a centre"
                  options={centres.map((centre) => ({ value: centre.id, label: centre.name }))}
                  onChange={(centreId) => set("centreId", centreId)}
                />
                <FieldError message={fieldErrors.centreId} />
              </FormField>
            ) : (
              <>
                <FormField label="Location name">
                  <TextInput
                    value={form.locationName}
                    disabled={locked || pending}
                    invalid={Boolean(fieldErrors.locationName)}
                    onChange={(event) => set("locationName", event.target.value)}
                  />
                  <FieldError message={fieldErrors.locationName} />
                </FormField>
                <FormField label="Address">
                  <TextInput
                    value={form.address}
                    disabled={locked || pending}
                    onChange={(event) => set("address", event.target.value)}
                  />
                </FormField>
              </>
            )}
          </div>
        </section>

        <section className={admin.formGroup}>
          <div className={admin.formGroupHead}>
            <h2 className={admin.formGroupTitle}>Website</h2>
          </div>
          <div className={admin.formGrid}>
            <FormField label="Description" className={admin.fieldWide}>
              <TextArea
                value={form.description}
                disabled={locked || pending}
                rows={4}
                onChange={(event) => set("description", event.target.value)}
              />
            </FormField>
            <FormField label="Hero image URL" hint="Optional full web address of the image." className={admin.fieldWide}>
              <TextInput
                type="url"
                value={form.heroImageUrl}
                disabled={locked || pending}
                invalid={Boolean(fieldErrors.heroImageUrl)}
                placeholder="https://"
                onChange={(event) => set("heroImageUrl", event.target.value)}
              />
              <FieldError message={fieldErrors.heroImageUrl} />
            </FormField>
          </div>
        </section>

        <section className={admin.formGroup}>
          <div className={admin.formGroupHead}>
            <h2 className={admin.formGroupTitle}>Bookings</h2>
          </div>
          <label className={admin.checkRow}>
            <input
              type="checkbox"
              checked={form.bookingsOpen}
              disabled={locked || pending}
              onChange={(event) => set("bookingsOpen", event.target.checked)}
            />
            <span>
              Bookings open
              <small>When this is off, the website will not accept new sign-ups.</small>
            </span>
          </label>
          <div className={admin.formGrid}>
            <FormField label="Bookings open from" hint="Optional. Leave blank to open immediately.">
              <TextInput
                type="datetime-local"
                value={form.bookingsOpenFrom}
                disabled={locked || pending}
                invalid={Boolean(fieldErrors.bookingsOpenFrom)}
                onChange={(event) => set("bookingsOpenFrom", event.target.value)}
              />
              <FieldError message={fieldErrors.bookingsOpenFrom} />
            </FormField>
            <FormField label="Bookings open until" hint="Optional. Leave blank to keep them open.">
              <TextInput
                type="datetime-local"
                value={form.bookingsOpenUntil}
                disabled={locked || pending}
                invalid={Boolean(fieldErrors.bookingsOpenUntil)}
                onChange={(event) => set("bookingsOpenUntil", event.target.value)}
              />
              <FieldError message={fieldErrors.bookingsOpenUntil} />
            </FormField>
            <FormField label="Trade stand capacity" hint="Optional. Blank means no limit.">
              <TextInput
                inputMode="numeric"
                value={form.capacityTradeStands}
                disabled={locked || pending}
                invalid={Boolean(fieldErrors.capacityTradeStands)}
                onChange={(event) => set("capacityTradeStands", event.target.value)}
              />
              <FieldError message={fieldErrors.capacityTradeStands} />
            </FormField>
          </div>
        </section>

        {formError ? (
          <p className={admin.error} role="alert">
            {formError}
          </p>
        ) : null}
        <div className={admin.formActions}>
          <Link className={admin.secondaryBtn} href={day ? openDaysPath(workspace, day.id) : openDaysPath(workspace)}>
            Cancel
          </Link>
          <button type="submit" className={admin.primaryBtn} disabled={locked || pending}>
            {pending ? "Saving…" : day ? "Save open day" : "Create open day"}
          </button>
        </div>
      </form>
    </ApprenticePageShell>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className={admin.error} role="alert">
      {message}
    </p>
  );
}
