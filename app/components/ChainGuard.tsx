"use client";

import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { useAppChain } from "../lib/app-chain";

// The wallet's chain and the app's chain must match, otherwise a transaction
// can land on the wrong network (it succeeds vacuously against an address
// with no code there and creates nothing). Passkey sessions are unaffected —
// they always sign for the app chain via our RPC.
export function useWrongChain(): boolean {
  const { address } = useAccount();
  const chainId = useChainId();
  const { appChainId } = useAppChain();
  return !!address && chainId !== appChainId;
}

export function ChainGuard() {
  const wrong = useWrongChain();
  const { chain } = useAppChain();
  const { switchChain, isPending, error } = useSwitchChain();
  if (!wrong) return null;
  return (
    <div className="rounded-xl border border-amber-600 bg-amber-50 p-4 text-sm">
      <p className="font-bold">⚠️ Wallet is on the wrong network</p>
      <p className="mt-1">
        Your wallet will send transactions to whatever network it is on — and a
        pot created on the wrong network simply doesn&apos;t exist. You are
        browsing <strong>{chain.name}</strong>.
      </p>
      <button
        onClick={() => switchChain({ chainId: chain.id })}
        disabled={isPending}
        className="mt-2 rounded-xl bg-amber-700 px-5 py-2 font-semibold text-white disabled:opacity-50"
      >
        {isPending ? "Switching…" : `Switch wallet to ${chain.name}`}
      </button>
      {error && <p className="mt-1 text-red-700">{error.message.slice(0, 160)}</p>}
    </div>
  );
}
