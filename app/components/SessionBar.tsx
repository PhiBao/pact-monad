"use client";

import { useAccount, useChainId, useDisconnect, useSwitchChain } from "wagmi";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { dynamicEnabled } from "../lib/wagmi";
import { useMera } from "../lib/mera-context";
import { passkeyDisconnect, shortAddress } from "../lib/mera";
import { monadMainnet, monadTestnet } from "../lib/monad";

// Global account cluster: network switcher + address + account panel + logout.
// Rendered in the site header, so it is identical on every logged-in page.
export default function SessionBar() {
  if (dynamicEnabled) return <BarDynamic />;
  return <BarPlain />;
}

function NetworkSelect() {
  const chainId = useChainId();
  const { switchChain, isPending } = useSwitchChain();
  const { address } = useAccount();
  if (!address) return null;
  return (
    <select
      aria-label="Network"
      value={chainId}
      disabled={isPending}
      onChange={(e) => switchChain({ chainId: Number(e.target.value) })}
      className="rounded-full border bg-white px-2 py-1 text-xs font-semibold"
    >
      <option value={monadTestnet.id}>Monad Testnet</option>
      <option value={monadMainnet.id}>Monad Mainnet</option>
    </select>
  );
}

function MeraChip() {
  const { meraAddr, setMeraAddr } = useMera();
  if (!meraAddr) return null;
  return (
    <div className="flex items-center gap-2 text-sm">
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
  if (!address) return null;
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
  if (!who) return null;
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
