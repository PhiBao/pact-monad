import { defineChain } from "viem";

export const monadMainnet = defineChain({
  id: 143,
  name: "Monad",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.monad.xyz"] },
  },
  blockExplorers: {
    default: { name: "MonadVision", url: "https://monadvision.com" },
  },
});

export const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://testnet-rpc.monad.xyz"] },
  },
  blockExplorers: {
    default: { name: "MonadVision", url: "https://testnet.monadvision.com" },
  },
});

export function activeChain() {
  return process.env.NEXT_PUBLIC_CHAIN === "testnet" ? monadTestnet : monadMainnet;
}

export function factoryAddress(): `0x${string}` | null {
  const a = process.env.NEXT_PUBLIC_FACTORY_ADDRESS;
  return a && a.startsWith("0x") ? (a as `0x${string}`) : null;
}

/** AUSD on Monad mainnet (LayerZero OFT). Null until configured per env. */
export function ausdAddress(): `0x${string}` | null {
  const a = process.env.NEXT_PUBLIC_AUSD_ADDRESS;
  return a && a.startsWith("0x") ? (a as `0x${string}`) : null;
}
