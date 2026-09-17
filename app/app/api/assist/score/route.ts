import { NextResponse } from "next/server";
import { TypeSafeClient, noul } from "@typesafe-ai/sdk";

// Legitimacy judgment for the public pot feed: one Noul over the pot facts.
// High p → "looks good" badge; low p → organizer sees "check details".
// Code owns display policy; Jev supplies only the probability.

export async function POST(req: Request) {
  if (!process.env.TYPESAFE_API_KEY) return NextResponse.json({ disabled: true });
  const input = (await req.json()) as {
    title?: string;
    perPerson?: string;
    partySize?: string;
    token?: string;
  };

  const client = new TypeSafeClient();
  try {
    const res = await client.systemOne({
      state: {
        title: (input.title ?? "").slice(0, 200),
        perPerson: input.perPerson ?? "?",
        partySize: input.partySize ?? "?",
        token: input.token ?? "?",
      },
      questions: {
        legit: noul(
          "Is this a plausible legitimate group collection (trip, dinner, gift, dues, event)?",
          {
            true: "ordinary friends/family/club pooling money for a shared cost",
            false: "spam, scam, giveaway lure, test junk, or incoherent content",
          }
        ),
      },
    });
    const a = res.answers.legit as unknown as { noul: number };
    const p = typeof a.noul === "number" ? a.noul : 0.5;
    return NextResponse.json({ p, label: p >= 0.6 ? "looks good" : "check details" });
  } catch {
    return NextResponse.json({ error: "assist unavailable" }, { status: 502 });
  }
}
