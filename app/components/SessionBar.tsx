"use client";

import { useAccount, useDisconnect } from "wagmi";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { dynamicEnabled } from "../lib/wagmi";
import { passkeyDisconnect, shortAddress } from "../lib/mera";

// Persistent session indicator with a visible way out. Rendered at the top of
// Home and pot pages whenever any auth path is active.
export default function SessionBar({
  meraAddr,
  onMeraSignOut,
}: {
  meraAddr: string | null;
  onMeraSignOut: () => void;
}) {
  if (dynamicEnabled) return <BarDynamic meraAddr={meraAddr} onMeraSignOut={onMeraSignOut} />;
  return <BarPlain meraAddr={meraAddr} onMeraSignOut={onMeraSignOut} />;
}

function MeraChip({ addr, onOut }: { addr: string; onOut: () => void }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="rounded-full bg-emerald-100 px-3 py-1 font-mono">🍏 {shortAddress(addr)}</span>
      <button
        onClick={() => {
          passkeyDisconnect();
          onOut();
        }}
        className="underline"
      >
        Log out
      </button>
    </div>
  );
}

function BarPlain({
  meraAddr,
  onMeraSignOut,
}: {
  meraAddr: string | null;
  onMeraSignOut: () => void;
}) {
  const { address } = useAccount();
  const { disconnect } = useDisconnect();
  if (meraAddr) return <MeraChip addr={meraAddr} onOut={onMeraSignOut} />;
  if (!address) return null;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="rounded-full bg-gray-100 px-3 py-1 font-mono">{shortAddress(address)}</span>
      <button onClick={() => disconnect()} className="underline">
        Log out
      </button>
    </div>
  );
}

function BarDynamic({
  meraAddr,
  onMeraSignOut,
}: {
  meraAddr: string | null;
  onMeraSignOut: () => void;
}) {
  const { primaryWallet, handleLogOut } = useDynamicContext();
  const { address } = useAccount();
  const { disconnect } = useDisconnect();
  if (meraAddr) return <MeraChip addr={meraAddr} onOut={onMeraSignOut} />;
  const who = primaryWallet?.address ?? address;
  if (!who) return null;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="rounded-full bg-blue-100 px-3 py-1 font-mono">{shortAddress(who)}</span>
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
