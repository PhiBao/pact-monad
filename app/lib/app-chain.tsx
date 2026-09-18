"use client";

import { createContext, ReactNode, useContext, useState } from "react";
import { monadMainnet, monadTestnet, chainFor, factoryFor, deployBlockFor } from "./monad";

export type AppChainId = 143 | 10143;

const KEY = "pact.chain";

const Ctx = createContext<{
  appChainId: AppChainId;
  setAppChainId: (id: AppChainId) => void;
}>({ appChainId: 143, setAppChainId: () => {} });

function initial(): AppChainId {
  if (typeof window !== "undefined") {
    const s = localStorage.getItem(KEY);
    if (s === "143" || s === "10143") return Number(s) as AppChainId;
  }
  return process.env.NEXT_PUBLIC_CHAIN === "testnet" ? 10143 : 143;
}

export function AppChainProvider({ children }: { children: ReactNode }) {
  const [appChainId, set] = useState<AppChainId>(initial);
  const setAppChainId = (id: AppChainId) => {
    set(id);
    try {
      localStorage.setItem(KEY, String(id));
    } catch {
      /* private mode */
    }
  };
  return <Ctx.Provider value={{ appChainId, setAppChainId }}>{children}</Ctx.Provider>;
}

export function useAppChain() {
  const { appChainId, setAppChainId } = useContext(Ctx);
  return {
    appChainId,
    setAppChainId,
    chain: chainFor(appChainId),
    factory: factoryFor(appChainId),
    deployBlock: deployBlockFor(appChainId),
    isMainnet: appChainId === monadMainnet.id,
    testnet: monadTestnet,
    mainnet: monadMainnet,
  };
}
