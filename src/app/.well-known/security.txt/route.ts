import { NextResponse } from "next/server";

export function GET() {
  const body = [
    "Contact: mailto:reisschambers@doncastergta.co.uk",
    "Expires: 2027-11-27T00:00:00.000Z",
    "Preferred-Languages: en",
    "Canonical: https://gta-portal.vercel.app/.well-known/security.txt",
    "",
  ].join("\n");
  return new NextResponse(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
