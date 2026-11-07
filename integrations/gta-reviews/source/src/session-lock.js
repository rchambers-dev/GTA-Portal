import { signOut, supabaseClient } from "./auth.js";

const SESSION_KEY = "review-assistant-browser";
const SIGNED_OUT_ELSEWHERE =
  "You were signed out because this account was opened in another browser.";

function browserId() {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

function hideChoice() {
  const root = document.querySelector("#session-lock");
  if (root) root.hidden = true;
  document.body.classList.remove("session-closed");
}

function isNewer(otherAt, otherId, stamp, mineId) {
  if (otherAt !== stamp) return otherAt > stamp;
  return String(otherId) > String(mineId);
}

let channel = null;
let claimed = false;

export function claimAccountSession(session, hooks = {}) {
  const supabase = supabaseClient();
  const userId = session?.user?.id;
  if (!supabase || !userId) return Promise.resolve(true);
  if (claimed && channel) return Promise.resolve(true);

  const mine = browserId();
  const startedAt = Date.now();
  return new Promise((resolve) => {
    let settled = false;
    let signingOut = false;
    let tookOver = false;

    const finish = (allowed) => {
      if (settled) return;
      settled = true;
      if (allowed) claimed = true;
      resolve(allowed);
    };

    const presenceRows = () => {
      const present = channel?.presenceState?.() || {};
      return Object.entries(present).map(([key, metas]) => ({
        id: key,
        at: Math.max(0, ...(metas || []).map((meta) => Number(meta.at) || 0)),
      }));
    };

    const mineAt = () => {
      const row = presenceRows().find((item) => item.id === mine);
      return Math.max(startedAt, row?.at || 0);
    };

    const others = () => presenceRows().filter((item) => item.id && item.id !== mine);

    const signOutHere = async () => {
      if (signingOut) return;
      signingOut = true;
      hooks.onClosed?.(SIGNED_OUT_ELSEWHERE);
      try {
        await channel?.untrack();
      } catch {
        /* The other browser already took the login. */
      }
      hideChoice();
      try {
        await signOut("local");
      } catch {
        /* Signed out locally even if the server call fails. */
      }
      finish(false);
    };

    const resolvePresence = async () => {
      if (signingOut) return;
      const rest = others();
      const stamp = mineAt();
      const newer = rest.filter((item) => isNewer(item.at, item.id, stamp, mine));
      if (newer.length) {
        await signOutHere();
        return;
      }
      if (rest.length && channel && !tookOver) {
        tookOver = true;
        try {
          await signOut("others");
        } catch {
          /* The other browser is still told to sign out below. */
        }
        await channel.send({
          type: "broadcast",
          event: "close-browser",
          payload: { ids: rest.map((item) => item.id), at: stamp, fromId: mine },
        });
      }
      hideChoice();
      hooks.onConflictClear?.();
      finish(true);
    };

    channel = supabase.channel(`review-login:${userId}`, {
      config: { presence: { key: mine } },
    });

    channel.on("broadcast", { event: "close-browser" }, ({ payload }) => {
      const ids = payload?.ids || [];
      if (!ids.includes(mine)) return;
      const fromAt = Number(payload?.at) || 0;
      if (fromAt && !isNewer(fromAt, payload?.fromId || "", mineAt(), mine)) return;
      signOutHere();
    });

    channel.on("presence", { event: "sync" }, () => {
      resolvePresence();
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ at: startedAt });
        window.setTimeout(() => {
          if (signingOut) return;
          resolvePresence();
        }, 1500);
        return;
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        if (!settled && !signingOut) finish(true);
      }
    });
  });
}
