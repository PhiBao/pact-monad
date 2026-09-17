"use client";

import { useEffect, useState } from "react";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { shortAddress } from "../lib/mera";

// Single "Log in" entry: the Dynamic modal itself offers email, Google,
// and 580+ wallets, so no separate buttons are needed. The
// DynamicWagmiConnector syncs the chosen wallet into wagmi, so all pot
// actions work unchanged.
export default function DynamicLogin() {
  const { primaryWallet, user, setShowAuthFlow, handleLogOut } = useDynamicContext();
  // The auth modal lazy-loads on first open; show a spinner in the gap
  // between click and modal paint so the tap feels acknowledged.
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    if (primaryWallet || user) setOpening(false);
  }, [primaryWallet, user]);

  useEffect(() => {
    if (!opening) return;
    const t = setTimeout(() => setOpening(false), 15000);
    return () => clearTimeout(t);
  }, [opening ]);

  if (primaryWallet) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="rounded-full bg-blue-100 px-3 py-1 font-mono">
          {shortAddress(primaryWallet.address)}
        </span>
        {user?.email && <span className="text-gray-600">{user.email}</span>}
        <button onClick={handleLogOut} className="underline">
          sign out
        </button>
      </div>
    );
  }
  return (
    <div>
      <button
        onClick={() => {
          setOpening(true);
          setShowAuthFlow(true);
        }}
        disabled={opening}
        aria-busy={opening}
        className="flex items-center gap-2 rounded-xl bg-blue-900 px-6 py-3 font-semibold text-white disabled:opacity-70"
      >
        {opening && (
          <span
            aria-hidden
            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
          />
        )}
        {opening ? "Opening…" : "Log in"}
      </button>
      <p className="mt-1 text-xs text-gray-600">Email, social, or one of 580+ wallets.</p>
    </div>
  );
}
