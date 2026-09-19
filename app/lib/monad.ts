import { defineChain } from "viem";

function rpcUrl(env: string | undefined, fallback: string): string {
  return env && env.startsWith("http") ? env : fallback;
}

export const monadMainnet = defineChain({
  id: 143,
  name: "Monad",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: {
      http: [rpcUrl(process.env.NEXT_PUBLIC_MONAD_MAINNET_RPC, "https://rpc.monad.xyz")],
    },
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
    default: {
      http: [
        rpcUrl(process.env.NEXT_PUBLIC_MONAD_TESTNET_RPC, "https://testnet-rpc.monad.xyz"),
      ],
    },
  },
  blockExplorers: {
    default: { name: "MonadVision", url: "https://testnet.monadvision.com" },
  },
});

export function chainFor(chainId: number) {
  return chainId === monadTestnet.id ? monadTestnet : monadMainnet;
}

// Contract bounds mirror PactFactory (v4). The form validates against these
// so users get instant feedback instead of a reverted transaction.
export const POT_BOUNDS = {
  minParty: 2,
  maxParty: 10_000,
  minDays: 1,
  maxDays: 90,
  maxTitle: 120,
} as const;

const FACTORIES = {
  [monadMainnet.id]: "0x7F50e78b1763c05F944D898EeCC2081c767b2113",
  [monadTestnet.id]: "0x910e17CC1Ea45B824E3Be700430E3F2cD29c5a4E",
} as const satisfies Record<number, `0x${string}`>;

export function factoryFor(chainId: number): `0x${string}` {
  return FACTORIES[chainId as keyof typeof FACTORIES] ?? FACTORIES[monadMainnet.id];
}

const DEPLOY_BLOCKS = {
  [monadMainnet.id]: 106125317n,
  [monadTestnet.id]: 63830698n,
} as const satisfies Record<number, bigint>;

/** Bounds getLogs scans for "your pots". */
export function deployBlockFor(chainId: number): bigint {
  return DEPLOY_BLOCKS[chainId as keyof typeof DEPLOY_BLOCKS] ?? 0n;
}

/** AUSD on Monad mainnet (LayerZero OFT). Null until configured per env. */
export function ausdAddress(): `0x${string}` | null {
  const a = process.env.NEXT_PUBLIC_AUSD_ADDRESS;
  return a && a.startsWith("0x") ? (a as `0x${string}`) : null;
}
