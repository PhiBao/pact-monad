"use client";

import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { activeChain } from "../lib/monad";

// The wallet's chain and the app's chain must match, otherwise a transaction
// can land on the wrong network (it succeeds vacuously against an address
// with no code there and creates nothing). Passkey sessions are unaffected —
// they always sign for the app chain via our RPC.
export function useWrongChain(): boolean {
  const { address } = useAccount();
  const chainId = useChainId();
  return !!address && chainId !== activeChain().id;
}

export function ChainGuard() {
  const wrong = useWrongChain();
  const { switchChain, isPending, error } = useSwitchChain();
  if (!wrong) return null;
  const c = activeChain();
  return (
    <div className="rounded-xl border border-amber-600 bg-amber-50 p-4 text-sm">
      <p className="font-bold">⚠️ Wallet is on the wrong network</p>
      <p className="mt-1">
        Your wallet will send transactions to whatever network it is on — and a
        pot created on the wrong network simply doesn&apos;t exist. Pact is
        currently on <strong>{c.name}</strong>.
      </p>
      <button
        onClick={() => switchChain({ chainId: c.id })}
        disabled={isPending}
        className="mt-2 rounded-xl bg-amber-700 px-5 py-2 font-semibold text-white disabled:opacity-50"
      >
        {isPending ? "Switching…" : `Switch to ${c.name}`}
      </button>
      {error && <p className="mt-1 text-red-700">{error.message.slice(0, 160)}</p>}
    </div>
  );
}
