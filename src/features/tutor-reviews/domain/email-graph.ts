import type { ProviderSendResult } from "./email";
import type { OutboundTutorReviewEmail, TutorReviewEmailSender } from "./email-provider";

export type GraphCredentials = {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  sender: string;
};

export type NdrMatch = {
  reference: string | null;
  recipient: string | null;
  reason: string;
};

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export function readGraphCredentials(env: {
  tenantId?: string | null;
  clientId?: string | null;
  clientSecret?: string | null;
  sender?: string | null;
}): GraphCredentials | null {
  const tenantId = env.tenantId?.trim() || "";
  const clientId = env.clientId?.trim() || "";
  const clientSecret = env.clientSecret?.trim() || "";
  const sender = env.sender?.trim() || "";
  if (!tenantId || !clientId || !clientSecret || !sender) return null;
  return { tenantId, clientId, clientSecret, sender };
}

export function retryAfterMs(header: string | null, now = new Date()): number | null {
  if (!header?.trim()) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const when = Date.parse(header);
  if (Number.isNaN(when)) return null;
  return Math.max(0, when - now.getTime());
}

export function parseNdr(input: { subject: string; body: string; sender?: string | null }): NdrMatch | null {
  const haystack = `${input.subject}\n${input.body}`;
  if (!/undeliverable|delivery status notification|delivery has failed|could not be delivered|wasn't found at/i.test(haystack)) return null;
  const reference = haystack.match(/tutor-review-[0-9a-f-]{36}/i)?.[0]?.toLowerCase() ?? null;
  const sender = input.sender?.trim().toLowerCase() || "";
  const recipient = (haystack.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [])
    .map((address) => address.toLowerCase())
    .find((address) => address !== sender && !/postmaster|mailer-daemon|microsoftexchange|notifications\.microsoft/i.test(address)) ?? null;
  const reason = input.body.split(/\r?\n/).map((line) => line.trim()).find((line) => /undeliverable|5\d\d |5\.\d|wasn't found|unknown recipient|mailbox|rejected/i.test(line))
    || input.subject.trim()
    || "The message could not be delivered.";
  return { reference, recipient, reason: reason.slice(0, 400) };
}

export function createGraphSender(credentials: GraphCredentials, fetchImpl: FetchLike = fetch): TutorReviewEmailSender {
  let token: Promise<string> | null = null;
  const accessToken = async () => {
    try {
      token ??= requestToken(credentials, fetchImpl);
      return await token;
    } catch (error) {
      token = null;
      throw error;
    }
  };
  return {
    mode: "live",
    async send(message) {
      try {
        const bearer = await accessToken();
        const response = await postMail(credentials, bearer, message, fetchImpl, true);
        if (response.status === 400) {
          const detail = await response.text();
          if (/header/i.test(detail)) {
            const retry = await postMail(credentials, bearer, message, fetchImpl, false);
            return readSendResponse(retry, message.idempotencyKey);
          }
          return { ok: false, transient: false, error: detail.slice(0, 400) || "Microsoft Graph rejected the message." };
        }
        return readSendResponse(response, message.idempotencyKey);
      } catch (error) {
        const transient = !(error instanceof GraphConfigError);
        return { ok: false, transient, error: error instanceof Error ? error.message : "Microsoft Graph could not be reached." };
      }
    },
  };
}

export async function graphMessageWasSent(credentials: GraphCredentials, reference: string, fetchImpl: FetchLike = fetch): Promise<boolean> {
  const bearer = await requestToken(credentials, fetchImpl);
  const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(credentials.sender)}/mailFolders/sentitems/messages?$search=${encodeURIComponent(`"${reference}"`)}&$top=1&$select=id`;
  const response = await fetchImpl(url, { headers: graphHeaders(bearer, true) });
  if (!response.ok) return false;
  const payload = await response.json() as { value?: unknown[] };
  return Array.isArray(payload.value) && payload.value.length > 0;
}

export async function graphNdrMessages(credentials: GraphCredentials, fetchImpl: FetchLike = fetch): Promise<NdrMatch[]> {
  const bearer = await requestToken(credentials, fetchImpl);
  const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(credentials.sender)}/messages?$search=${encodeURIComponent("\"subject:Undeliverable\"")}&$top=25&$select=subject,bodyPreview,body`;
  const response = await fetchImpl(url, { headers: graphHeaders(bearer, true) });
  if (response.status === 429 || response.status >= 500) return [];
  if (!response.ok) return [];
  const payload = await response.json() as { value?: { subject?: string; bodyPreview?: string; body?: { content?: string } }[] };
  const matches: NdrMatch[] = [];
  for (const message of payload.value ?? []) {
    const parsed = parseNdr({
      subject: message.subject || "",
      body: `${message.bodyPreview || ""}\n${message.body?.content || ""}`,
      sender: credentials.sender,
    });
    if (parsed) matches.push(parsed);
  }
  return matches;
}

async function requestToken(credentials: GraphCredentials, fetchImpl: FetchLike): Promise<string> {
  const response = await fetchImpl(`https://login.microsoftonline.com/${encodeURIComponent(credentials.tenantId)}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }).toString(),
  });
  if (response.status === 400 || response.status === 401) {
    throw new GraphConfigError("Microsoft did not accept the app sign-in.");
  }
  if (!response.ok) {
    throw new Error(`Microsoft sign-in returned ${response.status}.`);
  }
  const payload = await response.json() as { access_token?: string };
  if (!payload.access_token) throw new Error("Microsoft did not return an access token.");
  return payload.access_token;
}

async function postMail(credentials: GraphCredentials, bearer: string, message: OutboundTutorReviewEmail, fetchImpl: FetchLike, includeHeader: boolean) {
  const mail: Record<string, unknown> = {
    subject: message.subject,
    body: { contentType: "HTML", content: message.html },
    toRecipients: [{ emailAddress: { address: message.to } }],
  };
  if (includeHeader) {
    mail.internetMessageHeaders = [{ name: "X-Tutor-Review-Attempt", value: message.idempotencyKey }];
  }
  return fetchImpl(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(credentials.sender)}/sendMail`, {
    method: "POST",
    headers: graphHeaders(bearer, false),
    body: JSON.stringify({ message: mail, saveToSentItems: true }),
  });
}

async function readSendResponse(response: Response, idempotencyKey = ""): Promise<ProviderSendResult> {
  if (response.status === 429) {
    return {
      ok: false,
      transient: true,
      error: "Microsoft Graph is throttling mail.",
      retryAfterMs: retryAfterMs(response.headers.get("retry-after")) ?? 60_000,
    };
  }
  if (response.status === 503 || response.status === 504) {
    return { ok: false, transient: true, error: `Microsoft Graph returned ${response.status}.`, retryAfterMs: retryAfterMs(response.headers.get("retry-after")) ?? undefined };
  }
  if (!response.ok && response.status !== 202) {
    const detail = (await response.text()).slice(0, 400);
    return { ok: false, transient: false, error: detail || `Microsoft Graph returned ${response.status}.` };
  }
  return { ok: true, providerMessageId: idempotencyKey };
}

class GraphConfigError extends Error {}

function graphHeaders(bearer: string, search: boolean): HeadersInit {
  return {
    Authorization: `Bearer ${bearer}`,
    "Content-Type": "application/json",
    ...(search ? { ConsistencyLevel: "eventual" } : {}),
  };
}
