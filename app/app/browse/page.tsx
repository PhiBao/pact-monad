"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { usePublicClient, useReadContract, useReadContracts } from "wagmi";
import { useAppChain } from "../../lib/app-chain";
import { factoryAbi, potAbi } from "../../lib/abi";

type Card = {
  addr: string;
  title: string;
  count: bigint;
  size: bigint;
  state: number;
};

export default function Browse() {
  const router = useRouter();
  const { appChainId, factory, chain, isMainnet } = useAppChain();
  const client = usePublicClient({ chainId: appChainId });
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "filling" | "tilted">("all");
  const [addrs, setAddrs] = useState<string[]>([]);

  const { data: potCount } = useReadContract({
    address: factory,
    abi: factoryAbi,
    functionName: "potCount",
    chainId: appChainId,
    query: { refetchInterval: 5000 },
  });
  const n = potCount === undefined ? 0 : Number(potCount);

  useEffect(() => {
    if (!client || n === 0) {
      setAddrs([]);
      return;
    }
    const start = Math.max(0, n - 50);
    const idx = Array.from({ length: n - start }, (_, i) => BigInt(start + i));
    Promise.all(
      idx.map((i) =>
        client.readContract({ address: factory, abi: factoryAbi, functionName: "allPots", args: [i] })
      )
    )
      .then((a) => setAddrs((a as string[]).reverse()))
      .catch(() => setAddrs([]));
  }, [client, factory, n]);

  const { data } = useReadContracts({
    contracts: addrs.flatMap((a) => [
      { address: a as `0x${string}`, abi: potAbi, functionName: "title", chainId: appChainId },
      { address: a as `0x${string}`, abi: potAbi, functionName: "commitCount", chainId: appChainId },
      { address: a as `0x${string}`, abi: potAbi, functionName: "partySize", chainId: appChainId },
      { address: a as `0x${string}`, abi: potAbi, functionName: "state", chainId: appChainId },
      { address: a as `0x${string}`, abi: potAbi, functionName: "isPrivate", chainId: appChainId },
    ]),
    query: { enabled: addrs.length > 0 },
  });

  const cards: Card[] = useMemo(() => {
    if (!data) return [];
    const out: Card[] = [];
    for (let i = 0; i < addrs.length; i++) {
      const r = data.slice(i * 5, i * 5 + 5).map((d) => d.result) as [
        string | undefined,
        bigint | undefined,
        bigint | undefined,
        number | undefined,
        boolean | undefined,
      ];
      if (r[4]) continue; // private pots stay out of the public feed
      out.push({
        addr: addrs[i],
        title: r[0] ?? "Untitled",
        count: r[1] ?? 0n,
        size: r[2] ?? 0n,
        state: r[3] ?? 0,
      });
    }
    return out;
  }, [data, addrs]);

  const shown = cards.filter((c) => {
    if (filter === "filling" && !(c.state === 0 && c.count < c.size)) return false;
    if (filter === "tilted" && c.state !== 1) return false;
    if (q && !c.title.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <p className="text-sm font-semibold uppercase tracking-widest text-emerald-900">
        {chain.name} · {isMainnet ? "real money" : "play money"}
      </p>
      <h1 className="mt-2 text-4xl font-black">Browse pots</h1>
      <p className="mt-2 text-sm text-gray-600">
        Public pots anyone can join. Invite-only pots never appear here.
      </p>

      <div className="mt-4 flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name…"
          className="w-full rounded-lg border px-3 py-2"
        />
        {(["all", "filling", "tilted"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg border px-3 py-2 text-sm font-semibold capitalize ${filter === f ? "border-emerald-900 bg-emerald-50" : ""}`}
          >
            {f}
          </button>
        ))}
      </div>

      {addrs.length === 0 ? (
        <p className="mt-6 text-sm">{n === 0 ? "No pots yet — start the first one." : "Loading…"}</p>
      ) : shown.length === 0 ? (
        <p className="mt-6 text-sm">Nothing matches. Try another search.</p>
      ) : (
        <ul className="mt-4 grid gap-2">
          {shown.map((c) => (
            <li key={c.addr}>
              <button
                onClick={() => router.push(`/pot/${c.addr}`)}
                className="w-full rounded-xl border bg-white px-4 py-3 text-left shadow-sm hover:border-emerald-900"
              >
                <span className="flex items-center justify-between gap-2">
                  <strong>{c.title}</strong>
                  {c.state === 1 && <span>🎉</span>}
                  {c.state === 2 && <span className="text-xs text-gray-500">refunding</span>}
                </span>
                <span className="text-sm text-gray-600">
                  {c.count.toString()}/{c.size.toString()} committed
                </span>
                <span className="mt-1 block h-2 overflow-hidden rounded-full bg-gray-200">
                  <span
                    className="block h-full rounded-full bg-emerald-700"
                    style={{
                      width: c.size > 0n ? `${(Number(c.count) / Number(c.size)) * 100}%` : "0%",
                    }}
                  />
                </span>
                <span className="mt-1 block font-mono text-[11px] text-gray-400">{c.addr}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
