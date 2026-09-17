"use client";

// Client for the server-side TypeSafe assist routes (API key never leaves server).
// All functions return null when the assist backend is disabled/failing so the
// manual form always remains the source of truth.

export type PotProposal = {
  occasion: string;
  occasionConfidence: number;
  currency: "MON" | "AUSD" | null;
  deadlineDays: number | null;
  amount: string | null;
  partySize: string | null;
  confidence: number;
  needsReview: string[];
};

export async function parsePotText(text: string): Promise<PotProposal | null> {
  try {
    const r = await fetch("/api/assist/parse", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    return j.disabled ? null : (j as PotProposal);
  } catch {
    return null;
  }
}

export async function scorePotLegit(input: {
  title: string;
  perPerson: string;
  partySize: string;
  token: string;
}): Promise<{ p: number; label: "looks good" | "check details" } | null> {
  try {
    const r = await fetch("/api/assist/score", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!r.ok) return null;
    const j = await r.json();
    return j.disabled ? null : j;
  } catch {
    return null;
  }
}
