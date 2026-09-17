"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  useAccount,
  useConnect,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseEther } from "viem";
import { factoryAddress, ausdAddress } from "../lib/monad";
import { factoryAbi } from "../lib/abi";
import PasskeyConnect from "../components/PasskeyConnect";
import DynamicLogin from "../components/DynamicLogin";
import { dynamicEnabled } from "../lib/wagmi";
import { parsePotText, type PotProposal } from "../lib/assist";

const ZERO = "0x0000000000000000000000000000000000000000" as const;

export default function Home() {
  const router = useRouter();
  const factory = factoryAddress();
  const ausd = ausdAddress();
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();

  const [token, setToken] = useState<"MON" | "AUSD">("MON");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("0.5");
  const [partySize, setPartySize] = useState("3");
  const [days, setDays] = useState("7");
  const [payee, setPayee] = useState("");
  const [nlText, setNlText] = useState("");
  const [proposal, setProposal] = useState<PotProposal | null>(null);
  const [parsing, setParsing] = useState(false);

  const describe = async () => {
    if (nlText.trim().length < 4) return;
    setParsing(true);
    try {
      const p = await parsePotText(nlText);
      if (!p) return;
      setProposal(p);
      setTitle(nlText.trim().slice(0, 120));
      if (p.amount) setAmount(p.amount);
      if (p.partySize) setPartySize(p.partySize);
      if (p.deadlineDays) setDays(String(p.deadlineDays));
      if (p.currency) setToken(p.currency);
    } finally {
      setParsing(false);
    }
  };

  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const [pkHash, setPkHash] = useState<`0x${string}` | undefined>();
  const [pkBusy, setPkBusy] = useState(false);
  const [pkErr, setPkErr] = useState<string | null>(null);
  const [meraAddr, setMeraAddr] = useState<string | null>(null);
  const { isSuccess } = useWaitForTransactionReceipt({ hash: hash ?? pkHash });

  const { data: potCount } = useReadContract({
    address: factory ?? undefined,
    abi: factoryAbi,
    functionName: "potCount",
    query: { enabled: !!factory },
  });

  if (!factory) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-4xl font-bold">Pact</h1>
        <p className="mt-4">
          Factory not configured. Set <code>NEXT_PUBLIC_FACTORY_ADDRESS</code> and redeploy.
        </p>
      </main>
    );
  }

  const create = async () => {
    const tokenAddr = (token === "AUSD" && ausd ? ausd : ZERO) as `0x${string}`;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + Number(days) * 86400);
    const me = (payee || address || meraAddr!) as `0x${string}`;
    const args = {
      token: tokenAddr,
      perPerson: parseEther(amount),
      partySize: BigInt(partySize),
      deadline,
      payee: me,
      title: (title.trim() || "Group pot").slice(0, 120),
    };
    if (meraAddr) {
      setPkBusy(true);
      setPkErr(null);
      try {
        const { passkeyCreatePot } = await import("../lib/pactWrite");
        setPkHash(await passkeyCreatePot(factory, args));
      } catch (e) {
        setPkErr(e instanceof Error ? e.message.slice(0, 200) : "create failed");
      } finally {
        setPkBusy(false);
      }
      return;
    }
    writeContract({ address: factory, abi: factoryAbi, functionName: "createPot", args: [args.token, args.perPerson, args.partySize, args.deadline, args.payee, args.title] });
  };

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <p className="text-sm font-semibold uppercase tracking-widest text-emerald-900">
        On Monad · conditional escrow
      </p>
      <h1 className="mt-2 text-5xl font-black leading-tight">
        Money only moves if the group means it.
      </h1>
      <p className="mt-4 text-lg">
        Start a pot, share the link. Friends commit their share into escrow. If the
        group fills it before the deadline, the organizer gets paid. If not, everyone
        is refunded. <strong>No tilt, no charge.</strong>
      </p>

      {!isConnected && !meraAddr ? (
        <div className="mt-6 grid max-w-sm gap-3">
          <PasskeyConnect onChange={setMeraAddr} />
          {dynamicEnabled && <DynamicLogin />}
          <button
            onClick={() => connect({ connector: connectors[0] })}
            className="rounded-xl border px-6 py-3 font-semibold"
          >
            Use a wallet app instead
          </button>
        </div>
      ) : (
        <section className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">Start a pot</h2>
          <div className="mt-4 rounded-xl bg-emerald-50 p-4">
            <label className="grid gap-2 text-sm">
              Describe it in one sentence — we fill the form
              <textarea
                value={nlText}
                onChange={(e) => setNlText(e.target.value)}
                placeholder="Cabin weekend, 6 of us, $80 each, need it by Friday"
                rows={2}
                className="rounded-lg border bg-white px-3 py-2"
              />
            </label>
            <button
              onClick={describe}
              disabled={parsing || nlText.trim().length < 4}
              className="mt-2 rounded-xl bg-emerald-700 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {parsing ? "Understanding…" : "✨ Draft my pot"}
            </button>
            {proposal && (
              <p className="mt-2 text-xs">
                Read as <strong>{proposal.occasion}</strong> · confidence{" "}
                {Math.round(proposal.confidence * 100)}%
                {proposal.needsReview.length > 0 && (
                  <> · please check: {proposal.needsReview.join(", ")}</>
                )}
              </p>
            )}
          </div>
          <div className="mt-4 grid gap-3">
            <label className="grid gap-1 text-sm">
              Pot name
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Cabin weekend 🏔️"
                maxLength={120}
                className="rounded-lg border px-3 py-2"
              />
            </label>
            <label className="grid gap-1 text-sm">
              Currency
              <select
                value={token}
                onChange={(e) => setToken(e.target.value as "MON" | "AUSD")}
                className="rounded-lg border px-3 py-2"
              >
                <option value="MON">MON (native)</option>
                {ausd && <option value="AUSD">AUSD (stablecoin)</option>}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              Per-person amount ({token})
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                className="rounded-lg border px-3 py-2"
              />
            </label>
            <label className="grid gap-1 text-sm">
              Group size (including you)
              <input
                value={partySize}
                onChange={(e) => setPartySize(e.target.value)}
                inputMode="numeric"
                className="rounded-lg border px-3 py-2"
              />
            </label>
            <label className="grid gap-1 text-sm">
              Deadline (days from now)
              <input
                value={days}
                onChange={(e) => setDays(e.target.value)}
                inputMode="numeric"
                className="rounded-lg border px-3 py-2"
              />
            </label>
            <label className="grid gap-1 text-sm">
              Payee (defaults to you)
              <input
                value={payee}
                onChange={(e) => setPayee(e.target.value)}
                placeholder={address}
                className="rounded-lg border px-3 py-2 font-mono text-xs"
              />
            </label>
            <button
              onClick={create}
              disabled={isPending || pkBusy}
              className="mt-2 rounded-xl bg-emerald-900 px-6 py-3 font-semibold text-white disabled:opacity-50"
            >
              {isPending || pkBusy ? "Creating…" : "Create pot"}
            </button>
            {error && <p className="text-sm text-red-700">{error.message.slice(0, 200)}</p>}
            {pkErr && <p className="text-sm text-red-700">{pkErr}</p>}
            {isSuccess && (
              <p className="text-sm text-emerald-800">
                Created! Find your pot in recent pots below (tx {hash?.slice(0, 10)}…).
              </p>
            )}
          </div>
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-xl font-bold">
          Recent pots {potCount !== undefined ? `(${potCount.toString()})` : ""}
        </h2>
        <RecentPots factory={factory} count={potCount} onOpen={(a) => router.push(`/pot/${a}`)} />
      </section>
    </main>
  );
}

function RecentPots({
  factory,
  count,
  onOpen,
}: {
  factory: `0x${string}`;
  count: bigint | undefined;
  onOpen: (a: string) => void;
}) {
  const n = count === undefined ? 0 : Number(count);
  const start = Math.max(0, n - 10);
  const idx = Array.from({ length: n - start }, (_, i) => BigInt(start + i)).reverse();
  if (n === 0) return <p className="mt-2 text-sm">No pots yet — start the first one.</p>;
  return (
    <ul className="mt-3 grid gap-2">
      {idx.map((i) => (
        <PotRow key={i.toString()} factory={factory} index={i} onOpen={onOpen} />
      ))}
    </ul>
  );
}

function PotRow({
  factory,
  index,
  onOpen,
}: {
  factory: `0x${string}`;
  index: bigint;
  onOpen: (a: string) => void;
}) {
  const { data } = useReadContract({
    address: factory,
    abi: factoryAbi,
    functionName: "allPots",
    args: [index],
  });
  if (!data) return null;
  return (
    <li>
      <button
        onClick={() => onOpen(data as string)}
        className="w-full rounded-xl border bg-white px-4 py-3 text-left font-mono text-sm shadow-sm hover:border-emerald-900"
      >
        {data as string}
      </button>
    </li>
  );
}
