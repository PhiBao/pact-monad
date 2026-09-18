"use client";

import { ReactNode } from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { injected } from "wagmi/connectors";
import { DynamicContextProvider, DynamicWidget } from "@dynamic-labs/sdk-react-core";
import { EthereumWalletConnectors } from "@dynamic-labs/ethereum";
import { DynamicWagmiConnector } from "@dynamic-labs/wagmi-connector";
import { monadMainnet, monadTestnet } from "./monad";
import { MeraProvider } from "./mera-context";
import { AppChainProvider } from "./app-chain";

const queryClient = new QueryClient();

// Both Monad chains are registered so the in-app network switcher works;
// activeChain() (env-driven) decides defaults, factory, and indexer bounds.
export const wagmiConfig = createConfig({
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
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <MeraProvider>
          <AppChainProvider>{children}</AppChainProvider>
        </MeraProvider>
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
        <DynamicWagmiConnector>
          {children}
          {/* Mounted once as the host for the built-in profile/account modal
              (opened via setShowDynamicUserProfile). The trigger button is
              hidden — our own header cluster is the visible UI; the modal
              itself portals to document.body. */}
          <span style={{ display: "none" }} aria-hidden>
            <DynamicWidget />
          </span>
        </DynamicWagmiConnector>
      </Core>
    </DynamicContextProvider>
  );
}
