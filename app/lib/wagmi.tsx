"use client";

import { ReactNode } from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { injected } from "wagmi/connectors";
import { DynamicContextProvider } from "@dynamic-labs/sdk-react-core";
import { EthereumWalletConnectors } from "@dynamic-labs/ethereum";
import { DynamicWagmiConnector } from "@dynamic-labs/wagmi-connector";
import { activeChain, monadMainnet, monadTestnet } from "./monad";

const queryClient = new QueryClient();

const config = createConfig({
  chains: [activeChain()],
  connectors: [injected()],
  multiInjectedProviderDiscovery: false,
  transports: {
    [monadMainnet.id]: http(),
    [monadTestnet.id]: http(),
  },
});

export const dynamicEnabled = !!process.env.NEXT_PUBLIC_DYNAMIC_ENV_ID;

export function Providers({ children }: { children: ReactNode }) {
  const wagmi = (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );

  // Without an env ID (e.g. CI), run plain wagmi so nothing breaks.
  if (!dynamicEnabled) return wagmi;

  return (
    <DynamicContextProvider
      settings={{
        environmentId: process.env.NEXT_PUBLIC_DYNAMIC_ENV_ID!,
        walletConnectors: [EthereumWalletConnectors],
      }}
    >
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <DynamicWagmiConnector>{children}</DynamicWagmiConnector>
        </QueryClientProvider>
      </WagmiProvider>
    </DynamicContextProvider>
  );
}
