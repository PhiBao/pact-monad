"use client";

import { useAccount, useDisconnect, useSwitchChain } from "wagmi";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { dynamicEnabled } from "../lib/wagmi";
import { useMera } from "../lib/mera-context";
import { AppChainId, useAppChain } from "../lib/app-chain";
import { passkeyDisconnect, shortAddress } from "../lib/mera";

// Global account cluster: app-network switcher + address + account panel +
// logout. Rendered in the site header, identical on every logged-in page.
// Switching the network moves the whole app (factory, feed, explorer) and the
// wallet together, so testnet and mainnet both stay one tap away.
export default function SessionBar() {
  if (dynamicEnabled) return <BarDynamic />;
  return <BarPlain />;
}

function NetworkSelect() {
  const { appChainId, setAppChainId, mainnet, testnet } = useAppChain();
  const { address } = useAccount();
  const { switchChain, isPending } = useSwitchChain();
  const change = (id: AppChainId) => {
    setAppChainId(id);
    if (address) switchChain({ chainId: id });
  };
  return (
    <select
      aria-label="Network (switches app and wallet together)"
      value={appChainId}
      disabled={isPending}
      onChange={(e) => change(Number(e.target.value) as AppChainId)}
      className="rounded-full border bg-white px-2 py-1 text-xs font-semibold"
    >
      <option value={mainnet.id}>Monad Mainnet</option>
      <option value={testnet.id}>Monad Testnet</option>
    </select>
  );
}

function MeraChip() {
  const { meraAddr, setMeraAddr } = useMera();
  if (!meraAddr) return null;
  return (
    <div className="flex items-center gap-2 text-sm">
      <NetworkSelect />
      <span className="rounded-full bg-emerald-100 px-3 py-1 font-mono">🍏 {shortAddress(meraAddr)}</span>
      <button
        onClick={() => {
          passkeyDisconnect();
          setMeraAddr(null);
        }}
        className="underline"
      >
        Log out
      </button>
    </div>
  );
}

function BarPlain() {
  const { meraAddr } = useMera();
  const { address } = useAccount();
  const { disconnect } = useDisconnect();
  if (meraAddr) return <MeraChip />;
  if (!address) return <NetworkSelect />;
  return (
    <div className="flex items-center gap-2 text-sm">
      <NetworkSelect />
      <span className="rounded-full bg-gray-100 px-3 py-1 font-mono">{shortAddress(address)}</span>
      <button onClick={() => disconnect()} className="underline">
        Log out
      </button>
    </div>
  );
}

function BarDynamic() {
  const { meraAddr } = useMera();
  const { primaryWallet, handleLogOut, setShowDynamicUserProfile } = useDynamicContext();
  const { address } = useAccount();
  const { disconnect } = useDisconnect();
  if (meraAddr) return <MeraChip />;
  const who = primaryWallet?.address ?? address;
  if (!who)
    return (
      <div className="flex items-center gap-2 text-sm">
        <NetworkSelect />
      </div>
    );
  return (
    <div className="flex items-center gap-2 text-sm">
      <NetworkSelect />
      <span className="rounded-full bg-blue-100 px-3 py-1 font-mono">{shortAddress(who)}</span>
      <button onClick={() => setShowDynamicUserProfile(true)} className="underline">
        Account
      </button>
      <button
        onClick={() => {
          handleLogOut();
          disconnect();
        }}
        className="underline"
      >
        Log out
      </button>
    </div>
  );
}
