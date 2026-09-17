"use client";

import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { shortAddress } from "../lib/mera";

// Email / social login via Dynamic embedded wallets. The DynamicWagmiConnector
// syncs the embedded wallet into wagmi, so all pot actions work unchanged.
export default function DynamicLogin() {
  const { primaryWallet, user, setShowAuthFlow, handleLogOut } = useDynamicContext();

  if (primaryWallet) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="rounded-full bg-blue-100 px-3 py-1 font-mono">
          ✉️ {shortAddress(primaryWallet.address)}
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
        onClick={() => setShowAuthFlow(true)}
        className="rounded-xl bg-blue-900 px-6 py-3 font-semibold text-white"
      >
        Continue with email
      </button>
      <p className="mt-1 text-xs text-gray-600">Social or email login, wallet created for you.</p>
    </div>
  );
}
