import { NextResponse } from "next/server";
import { TypeSafeClient, choice } from "@typesafe-ai/sdk";

// One sentence in → structured pot draft out.
// Closed sets go to Jev (Choice); numbers are extracted in code with regex
// (pre-parsed value extraction); confidence gates autofill vs. review flags.

const DEADLINES: Record<string, number | null> = {
  "3 days": 3,
  "7 days": 7,
  "14 days": 14,
  "30 days": 30,
  unspecified: null,
};

function extractNumbers(text: string): { amount: string | null; partySize: string | null } {
  const t = text.toLowerCase().replace(/,/g, "");
  let amount: string | null = null;
  let partySize: string | null = null;

  const amt =
    t.match(/\$?\s*(\d+(?:\.\d+)?)\s*(?:each|per person|a head|apiece|pp\b)/) ??
    t.match(/(?:\$|usd|mon|ausd)?\s*(\d+(?:\.\d+)?)/);
  if (amt) amount = amt[1];

  const size =
    t.match(
      /(\d+)\s*(?:people|persons|friends|members|colleagues|teammates|coworkers|classmates|cousins|siblings|of us|spots|guests|roommates)/
    ) ?? t.match(/(?:group of|party of|for)\s*(\d+)/);
  if (size) partySize = size[1];

  return { amount, partySize };
}

export async function POST(req: Request) {
  if (!process.env.TYPESAFE_API_KEY) return NextResponse.json({ disabled: true });
  const { text } = (await req.json()) as { text?: string };
  if (!text || text.trim().length < 4) {
    return NextResponse.json({ error: "empty" }, { status: 400 });
  }

  const client = new TypeSafeClient();
  let answers;
  try {
    const res = await client.systemOne({
      state: { request: text.slice(0, 500) },
      questions: {
        occasion: choice("What kind of group collection is this?", {
          trip: "a trip, cabin, vacation, travel, flights or accommodation",
          dinner: "a dinner, meal, restaurant bill or night out",
          gift: "a shared gift, present or collection for someone",
          dues: "club dues, team fees, rent split or recurring shared costs",
          event: "an event, party, tickets or outing with entry costs",
          other: "something else, or impossible to tell",
        }),
        currency: choice("Which currency should contributions use?", {
          MON: "Monad's native token MON",
          AUSD: "a dollar stablecoin such as AUSD or USDC",
          unspecified: "no currency is named",
        }),
        deadline: choice("How soon is the money needed?", {
          "3 days": "within a few days, this weekend, urgent",
          "7 days": "within a week or so",
          "14 days": "within two weeks, half a month",
          "30 days": "within a month, no rush, end of month",
          unspecified: "no time frame is given",
        }),
      },
    });
    answers = res.answers;
  } catch {
    return NextResponse.json({ error: "assist unavailable" }, { status: 502 });
  }

  const occ = answers.occasion as unknown as {
    choice: string;
    confidence?: number;
  };
  const cur = answers.currency as unknown as { choice: string; confidence?: number };
  const ddl = answers.deadline as unknown as { choice: string; confidence?: number };

  const { amount, partySize } = extractNumbers(text);
  const needsReview: string[] = [];
  const conf = (c?: number) => c ?? 0;

  if (conf(occ.confidence) < 0.6) needsReview.push("occasion");
  const currency = cur.choice === "unspecified" ? null : (cur.choice as "MON" | "AUSD");
  if (currency && conf(cur.confidence) < 0.6) needsReview.push("currency");
  const deadlineDays = DEADLINES[ddl.choice] ?? null;
  if (deadlineDays !== null && conf(ddl.confidence) < 0.6) needsReview.push("deadline");
  if (!amount) needsReview.push("amount");
  if (!partySize) needsReview.push("partySize");

  const used = [conf(occ.confidence), conf(cur.confidence), conf(ddl.confidence)];
  const confidence = Math.min(...used);

  return NextResponse.json({
    occasion: occ.choice,
    occasionConfidence: conf(occ.confidence),
    currency,
    deadlineDays,
    amount,
    partySize,
    confidence,
    needsReview,
  });
}
