"use client";

import { useState } from "react";
import { getWalletClient, switchChain } from "wagmi/actions";
import { wagmiConfig } from "./wagmi";
import { AppChainId, useAppChain } from "./app-chain";
import { chainFor } from "./monad";

// Send-time enforcement: ask the wallet itself which chain it is on right now
// (UI state can lag manual switches in external wallets like Rabby), and
// auto-switch it to the app chain before any transaction is built.
export async function ensureWalletChain(appChainId: AppChainId): Promise<void> {
  const wc = await getWalletClient(wagmiConfig);
  if ((await wc.getChainId()) === appChainId) return;
  await switchChain(wagmiConfig, { chainId: appChainId });
  const recheck = await (await getWalletClient(wagmiConfig)).getChainId();
  if (recheck !== appChainId) {
    throw new Error(
      `Wallet is still on the wrong network — switch to ${chainFor(appChainId).name} inside your wallet and retry.`
    );
  }
}

// Wraps any wagmi write so no transaction can leave on the wrong network,
// even if the header/ChainGuard state is stale.
export function useWalletGuard() {
  const { appChainId } = useAppChain();
  const [checking, setChecking] = useState(false);
  const [guardErr, setGuardErr] = useState<string | null>(null);

  const guard = async (fn: () => void) => {
    setChecking(true);
    setGuardErr(null);
    try {
      await ensureWalletChain(appChainId);
      fn();
    } catch (e) {
      setGuardErr(e instanceof Error ? e.message.slice(0, 220) : "Network check failed — try again.");
    } finally {
      setChecking(false);
    }
  };

  return { guard, checking, guardErr };
}
