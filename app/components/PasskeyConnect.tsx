"use client";

import { useState } from "react";
import { passkeyConnect, passkeyDisconnect, passkeySession, shortAddress } from "../lib/mera";

export default function PasskeyConnect({ onChange }: { onChange: (addr: string | null) => void }) {
  const [addr, setAddr] = useState<string | null>(passkeySession()?.address ?? null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const go = async () => {
    setBusy(true);
    setErr(null);
    try {
      const s = await passkeyConnect();
      setAddr(s.address);
      onChange(s.address);
    } catch (e) {
      setErr(e instanceof Error ? e.message.slice(0, 160) : "passkey failed");
    } finally {
      setBusy(false);
    }
  };

  const out = () => {
    passkeyDisconnect();
    setAddr(null);
    onChange(null);
  };

  if (addr) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="rounded-full bg-emerald-100 px-3 py-1 font-mono">🍏 {shortAddress(addr)}</span>
        <button onClick={out} className="underline">
          sign out
        </button>
      </div>
    );
  }
  return (
    <div>
      <button
        onClick={go}
        disabled={busy}
        className="rounded-xl bg-black px-6 py-3 font-semibold text-white disabled:opacity-50"
      >
        {busy ? "Waiting for Face ID…" : "Continue with Face ID"}
      </button>
      <p className="mt-1 text-xs text-gray-600">No seed phrase. Same account on every synced device.</p>
      {err && <p className="mt-1 text-sm text-red-700">{err}</p>}
    </div>
  );
}
