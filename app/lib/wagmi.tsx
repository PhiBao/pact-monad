"use client";

import { ReactNode } from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { injected } from "wagmi/connectors";
import { DynamicContextProvider } from "@dynamic-labs/sdk-react-core";
import { EthereumWalletConnectors } from "@dynamic-labs/ethereum";
import { DynamicWagmiConnector } from "@dynamic-labs/wagmi-connector";
import { monadMainnet, monadTestnet } from "./monad";
import { MeraProvider } from "./mera-context";

const queryClient = new QueryClient();

// Both Monad chains are registered so the in-app network switcher works;
// activeChain() (env-driven) decides defaults, factory, and indexer bounds.
const config = createConfig({
  chains: [monadMainnet, monadTestnet],
  connectors: [injected()],
  multiInjectedProviderDiscovery: false,
  transports: {
    [monadMainnet.id]: http(),
    [monadTestnet.id]: http(),
  },
});

export const dynamicEnabled = !!process.env.NEXT_PUBLIC_DYNAMIC_ENV_ID;

function Core({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <MeraProvider>{children}</MeraProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  // Without an env ID (e.g. CI), run plain wagmi so nothing breaks.
  if (!dynamicEnabled) return <Core>{children}</Core>;

  return (
    <DynamicContextProvider
      settings={{
        environmentId: process.env.NEXT_PUBLIC_DYNAMIC_ENV_ID!,
        walletConnectors: [EthereumWalletConnectors],
      }}
    >
      <Core>
        <DynamicWagmiConnector>{children}</DynamicWagmiConnector>
      </Core>
    </DynamicContextProvider>
  );
}
