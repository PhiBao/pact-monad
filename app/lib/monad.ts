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

const FACTORIES = {
  [monadMainnet.id]: "0xEF673BDac2C86506874919b1ad05Bd7D7fa64344",
  [monadTestnet.id]: "0x4f6aD063f1c20D53a4ea4FA1ba46A8783C782D16",
} as const satisfies Record<number, `0x${string}`>;

export function factoryFor(chainId: number): `0x${string}` {
  return FACTORIES[chainId as keyof typeof FACTORIES] ?? FACTORIES[monadMainnet.id];
}

const DEPLOY_BLOCKS = {
  [monadMainnet.id]: 105647209n,
  [monadTestnet.id]: 63354945n,
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
