"use client";

import { createContext, ReactNode, useContext, useState } from "react";
import { passkeySession } from "./mera";

const MeraCtx = createContext<{
  meraAddr: string | null;
  setMeraAddr: (a: string | null) => void;
}>({ meraAddr: null, setMeraAddr: () => {} });

export function MeraProvider({ children }: { children: ReactNode }) {
  const [meraAddr, setMeraAddr] = useState<string | null>(
    () => passkeySession()?.address ?? null
  );
  return <MeraCtx.Provider value={{ meraAddr, setMeraAddr }}>{children}</MeraCtx.Provider>;
}

export const useMera = () => useContext(MeraCtx);
