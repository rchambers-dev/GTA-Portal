import Link from "next/link";
import { getSupabaseEffectiveSession } from "@/adapters/supabase/auth";
import { ApprenticePageShell } from "@/features/apprentice-portal/components/ApprenticePageShell";
import admin from "@/features/administration/screens/admin-pages.module.css";
import { OPEN_DAYS_PERMISSION_ERROR, canManageOpenDays } from "./domain/access";
import { openDaysPath } from "./domain/format";
import { loadOpenDayDetail, loadOpenDaysList } from "./load";
import { OpenDayDetail } from "./screens/OpenDayDetail";
import { OpenDayForm } from "./screens/OpenDayForm";
import { OpenDaysList } from "./screens/OpenDaysList";
import { OpenDaysNotice } from "./screens/OpenDaysNotice";

export async function OpenDaysArea({
  workspace,
  segment,
}: {
  workspace: "administration" | "management";
  segment: string;
}) {
  const session = await getSupabaseEffectiveSession();
  if (!canManageOpenDays(session)) {
    return (
      <ApprenticePageShell eyebrow="Marketing & Recruitment" title="Open days" description={OPEN_DAYS_PERMISSION_ERROR}>
        <p className={admin.empty} role="status" data-open-days="denied">
          {OPEN_DAYS_PERMISSION_ERROR}
        </p>
      </ApprenticePageShell>
    );
  }

  const rest = segment === "marketing/open-days" ? "" : segment.slice("marketing/open-days".length);
  if (rest === "") {
    const list = await loadOpenDaysList();
    return <OpenDaysList workspace={workspace} days={list.days} mode={list.mode} />;
  }
  if (rest === "/new") {
    const list = await loadOpenDaysList();
    return <OpenDayForm workspace={workspace} day={null} centres={list.centres} mode={list.mode} />;
  }

  const edit = /^\/([^/]+)\/edit$/.exec(rest);
  const view = /^\/([^/]+)$/.exec(rest);
  const id = decodeURIComponent((edit ?? view)?.[1] ?? "");
  if (!id) return <MissingOpenDay workspace={workspace} />;

  const detail = await loadOpenDayDetail(id);
  if (!detail.day) {
    return (
      <MissingOpenDay
        workspace={workspace}
        mode={detail.mode}
        message={detail.missing ? "This open day was not found." : "This open day could not be loaded."}
      />
    );
  }
  if (edit) {
    return <OpenDayForm workspace={workspace} day={detail.day} centres={detail.centres} mode={detail.mode} />;
  }
  return (
    <OpenDayDetail workspace={workspace} day={detail.day} bookings={detail.bookings} mode={detail.mode} />
  );
}

function MissingOpenDay({
  workspace,
  message = "This open day was not found.",
  mode,
}: {
  workspace: "administration" | "management";
  message?: string;
  mode?: { banner: string | null; savingMessage: string | null; error: string | null };
}) {
  return (
    <ApprenticePageShell eyebrow="Marketing & Recruitment" title="Open day" description={message}>
      <div className={admin.stack} data-open-days="missing">
        {mode ? <OpenDaysNotice banner={mode.banner} savingMessage={mode.savingMessage} error={mode.error} /> : null}
        <p className={admin.empty} role="status">
          {message}
        </p>
        <Link className={admin.secondaryBtn} href={openDaysPath(workspace)}>
          All open days
        </Link>
      </div>
    </ApprenticePageShell>
  );
}
