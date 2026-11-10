import { readFileSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { getStandalonePorts } from "@/adapters/standalone";
import { reviewAssistantAccess } from "@/features/review-assistant/access";

export const runtime = "nodejs";

export async function GET() {
  const session = await getStandalonePorts().auth.getEffectiveSession();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  const access = reviewAssistantAccess(session);
  if (access === "denied") {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }
  const htmlPath = path.join(process.cwd(), "public/review-assistant/index.html");
  const html = readFileSync(htmlPath, "utf8");
  const portalSession = {
    access_token: "portal-session",
    user: {
      id: session.account.id,
      email: session.account.email,
      app_metadata: {
        role: access === "office" ? "admin" : "tutor",
        password_changed: true,
      },
    },
  };
  const bridge = `<script>
window.__PORTAL_REVIEW_SESSION__=${JSON.stringify(portalSession).replace(/</g, "\\u003c")};
const portalFetch=window.fetch.bind(window);
window.fetch=function(input,init){
  const raw=typeof input==="string"?input:(input&&input.url)||"";
  if(raw.startsWith("/api/")){
    const next="/api/reviews-assistant"+raw.slice(4);
    return portalFetch(next,Object.assign({},init,{credentials:"same-origin"}));
  }
  return portalFetch(input,init);
};
</script>`;
  return new NextResponse(html.replace("</head>", `${bridge}</head>`), {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
