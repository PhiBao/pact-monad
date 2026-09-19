"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useAccount,
  useConnect,
  usePublicClient,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseAbiItem, parseEther } from "viem";
import { ausdAddress } from "../lib/monad";
import { useAppChain } from "../lib/app-chain";
import { factoryAbi, potAbi } from "../lib/abi";
import PasskeyConnect from "../components/PasskeyConnect";
import DynamicLogin from "../components/DynamicLogin";
import { useMera } from "../lib/mera-context";
import { ChainGuard, useWrongChain } from "../components/ChainGuard";
import { dynamicEnabled } from "../lib/wagmi";
import { parsePotText, type PotProposal } from "../lib/assist";
import { potFromReceipt } from "../lib/potFromReceipt";
import { newSecret, secretHash } from "../lib/inviteSecret";
import { useWalletGuard } from "../lib/walletGuard";

const ZERO = "0x0000000000000000000000000000000000000000" as const;

export default function Home() {
  const router = useRouter();
  const { appChainId, factory, deployBlock } = useAppChain();
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
  const [isPrivate, setIsPrivate] = useState(false);
  const [secret, setSecret] = useState<`0x${string}` | null>(null);

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
  const { meraAddr } = useMera();
  const [redirecting, setRedirecting] = useState(false);
  const [createFallback, setCreateFallback] = useState<string | null>(null);
  const wrongChain = useWrongChain();
  const { guard, checking, guardErr } = useWalletGuard();
  const { data: receipt } = useWaitForTransactionReceipt({ hash: hash ?? pkHash });

  // Creation confirmed → take the organizer straight to their pot.
  // Private pots carry the invite secret in the link fragment (never the query).
  useEffect(() => {
    if (!receipt || !factory) return;
    const pot = potFromReceipt(receipt, factory);
    if (pot) {
      setRedirecting(true);
      router.push(isPrivate && secret ? `/pot/${pot}#s=${secret}` : `/pot/${pot}`);
    } else {
      setCreateFallback(hash ?? pkHash ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt]);

  const { data: potCount } = useReadContract({
    address: factory,
    abi: factoryAbi,
    functionName: "potCount",
    chainId: appChainId,
    query: { refetchInterval: 5000 },
  });

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
      ...(isPrivate && secret ? { isPrivate: true as const, secretHash: secretHash(secret) } : {}),
    };
    if (meraAddr) {
      setPkBusy(true);
      setPkErr(null);
      try {
        const { passkeyCreatePot } = await import("../lib/pactWrite");
        setPkHash(await passkeyCreatePot(factory, args, appChainId));
      } catch (e) {
        setPkErr(e instanceof Error ? e.message.slice(0, 200) : "create failed");
      } finally {
        setPkBusy(false);
      }
      return;
    }
    if (args.isPrivate) {
      guard(() =>
        writeContract({
          address: factory,
          abi: factoryAbi,
          functionName: "createPot",
          args: [args.token, args.perPerson, args.partySize, args.deadline, args.payee, args.title, true, args.secretHash!],
        })
      );
      return;
    }
    guard(() =>
      writeContract({ address: factory, abi: factoryAbi, functionName: "createPot", args: [args.token, args.perPerson, args.partySize, args.deadline, args.payee, args.title] })
    );
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
          <PasskeyConnect />
          {dynamicEnabled ? (
            <DynamicLogin />
          ) : (
            <button
              onClick={() => connect({ connector: connectors[0] })}
              className="rounded-xl border px-6 py-3 font-semibold"
            >
              Use a wallet app instead
            </button>
          )}
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
          <div className="mt-4">
            <ChainGuard />
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
            <div className="grid gap-1 text-sm">
              <span className="font-medium">Visibility</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsPrivate(false)}
                  className={`flex-1 rounded-lg border px-3 py-2 font-semibold ${!isPrivate ? "border-emerald-900 bg-emerald-50" : ""}`}
                >
                  🌍 Public
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!secret) setSecret(newSecret());
                    setIsPrivate(true);
                  }}
                  className={`flex-1 rounded-lg border px-3 py-2 font-semibold ${isPrivate ? "border-emerald-900 bg-emerald-50" : ""}`}
                >
                  🔒 Invite-only
                </button>
              </div>
              <p className="text-xs text-gray-600">
                {isPrivate
                  ? "Only people with your invite link can join — enforced onchain. Titles stay public; money doesn't move without the link."
                  : "Anyone with the link (or browsing) can join."}
              </p>
            </div>
            <button
              onClick={create}
              disabled={isPending || pkBusy || checking || wrongChain}
              title={wrongChain ? "Switch network first" : undefined}
              className="mt-2 rounded-xl bg-emerald-900 px-6 py-3 font-semibold text-white disabled:opacity-50"
            >
              {isPending || pkBusy || checking
                ? "Creating…"
                : wrongChain
                  ? "Switch network to create"
                  : "Create pot"}
            </button>
            {guardErr && <p className="text-sm text-amber-800">{guardErr}</p>}
            {error && <p className="text-sm text-red-700">{error.message.slice(0, 200)}</p>}
            {pkErr && <p className="text-sm text-red-700">{pkErr}</p>}
            {(isPending || pkBusy || redirecting) && !createFallback && (
              <p className="text-sm text-emerald-800">
                {redirecting ? "Taking you to your pot…" : "Creating…"}
              </p>
            )}
            {createFallback && (
              <p className="text-sm text-emerald-800">
                Created! Open your pot in recent pots below (tx {createFallback.slice(0, 10)}…).
              </p>
            )}
          </div>
        </section>
      )}

      <section className="mt-10">
        <YourPots
          factory={factory}
          viewer={(address ?? meraAddr) as `0x${string}` | undefined}
          chainId={appChainId}
          deployBlock={deployBlock}
        />
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-bold">
          Recent pots {potCount !== undefined ? `(${potCount.toString()})` : ""}
        </h2>
        <RecentPots
          factory={factory}
          count={potCount}
          chainId={appChainId}
          onOpen={(a) => router.push(`/pot/${a}`)}
        />
      </section>
    </main>
  );
}

/** Pots organized by the connected wallet (via PotCreated event scan). */
function YourPots({
  factory,
  viewer,
  chainId,
  deployBlock,
}: {
  factory: `0x${string}`;
  viewer: `0x${string}` | undefined;
  chainId: 143 | 10143;
  deployBlock: bigint;
}) {
  const client = usePublicClient({ chainId });
  const [mine, setMine] = useState<string[]>([]);
  useEffect(() => {
    if (!client || !viewer) {
      setMine([]);
      return;
    }
    client
      .getLogs({
        address: factory,
        event: parseAbiItem(
          "event PotCreated(address indexed pot, address indexed organizer, address indexed payee, address token, uint256 perPerson, uint256 partySize, uint256 deadline, string title)"
        ),
        args: { organizer: viewer },
        fromBlock: deployBlock,
      })
      .then((ls) =>
        setMine([...new Set(ls.map((l) => (l.args as unknown as { pot: string }).pot))].reverse())
      )
      .catch(() => setMine([]));
  }, [client, factory, viewer, deployBlock]);
  if (!viewer || mine.length === 0) return null;
  return (
    <>
      <h2 className="text-xl font-bold">Your pots ({mine.length})</h2>
      <ul className="mt-3 grid gap-2">
        {mine.map((a) => (
          <OwnPotCard key={a} pot={a as `0x${string}`} chainId={chainId} />
        ))}
      </ul>
    </>
  );
}

function OwnPotCard({ pot, chainId }: { pot: `0x${string}`; chainId: 143 | 10143 }) {
  const router = useRouter();
  const { data } = useReadContracts({
    contracts: (["title", "commitCount", "partySize", "state", "isPrivate"] as const).map(
      (functionName) => ({ address: pot, abi: potAbi, functionName, chainId })
    ),
  });
  const [title, count, size, state, priv] = (data?.map((d) => d.result) ?? []) as [
    string | undefined,
    bigint | undefined,
    bigint | undefined,
    number | undefined,
    boolean | undefined,
  ];
  return (
    <li>
      <button
        onClick={() => router.push(`/pot/${pot}`)}
        className="w-full rounded-xl border bg-white px-4 py-3 text-left shadow-sm hover:border-emerald-900"
      >
        <span className="flex items-center justify-between gap-2">
          <strong>
            {priv && <span title="Invite-only">🔒 </span>}
            {title ?? "Loading…"}
          </strong>
          {state === 1 && <span>🎉</span>}
          {state === 2 && <span className="text-xs text-gray-500">refunding</span>}
        </span>
        {count !== undefined && size !== undefined && (
          <span className="text-sm text-gray-600">
            {count.toString()}/{size.toString()} committed
          </span>
        )}
        <span className="mt-1 block font-mono text-[11px] text-gray-400">{pot}</span>
      </button>
    </li>
  );
}

function RecentPots({
  factory,
  count,
  chainId,
  onOpen,
}: {
  factory: `0x${string}`;
  count: bigint | undefined;
  chainId: 143 | 10143;
  onOpen: (a: string) => void;
}) {
  const n = count === undefined ? 0 : Number(count);
  const [addrs, setAddrs] = useState<string[]>([]);
  const client = usePublicClient({ chainId });
  useEffect(() => {
    if (!client || n === 0) {
      setAddrs([]);
      return;
    }
    const start = Math.max(0, n - 10);
    const idx = Array.from({ length: n - start }, (_, i) => BigInt(start + i));
    Promise.all(
      idx.map((i) =>
        client.readContract({ address: factory, abi: factoryAbi, functionName: "allPots", args: [i] })
      )
    )
      .then((a) => setAddrs((a as string[]).reverse()))
      .catch(() => setAddrs([]));
  }, [client, factory, n]);
  if (n === 0) return <p className="mt-2 text-sm">No pots yet — start the first one.</p>;
  return <PotCards factory={factory} addrs={addrs} chainId={chainId} onOpen={onOpen} />;
}

/** Titled cards with live progress. Global scope — "Your pots" filters above. */
function PotCards({
  factory,
  addrs,
  chainId,
  onOpen,
}: {
  factory: `0x${string}`;
  addrs: string[];
  chainId: 143 | 10143;
  onOpen?: (a: string) => void;
}) {
  void factory;
  if (addrs.length === 0) return <p className="mt-2 text-sm">Loading…</p>;
  return (
    <ul className="mt-3 grid gap-2">
      {addrs.map((a) => (
        <PotCard key={a} pot={a as `0x${string}`} chainId={chainId} onOpen={onOpen} />
      ))}
    </ul>
  );
}

function PotCard({
  pot,
  chainId,
  onOpen,
}: {
  pot: `0x${string}`;
  chainId: 143 | 10143;
  onOpen?: (a: string) => void;
}) {
  const router = useRouter();
  const open = onOpen ?? ((a: string) => router.push(`/pot/${a}`));
  const { data } = useReadContracts({
    contracts: (["title", "commitCount", "partySize", "state", "isPrivate"] as const).map(
      (functionName) => ({
        address: pot,
        abi: potAbi,
        functionName,
        chainId,
      })
    ),
  });
  const [title, count, size, state, priv] = (data?.map((d) => d.result) ?? []) as [
    string | undefined,
    bigint | undefined,
    bigint | undefined,
    number | undefined,
    boolean | undefined,
  ];
  if (priv) return null; // invite-only pots never appear in the public feed
  const pct =
    count !== undefined && size !== undefined && size > 0n
      ? `${(Number(count) / Number(size)) * 100}%`
      : "0%";
  return (
    <li>
      <button
        onClick={() => open(pot)}
        className="w-full rounded-xl border bg-white px-4 py-3 text-left shadow-sm hover:border-emerald-900"
      >
        <span className="flex items-center justify-between gap-2">
          <strong>{title ?? "Loading…"}</strong>
          {state === 1 && <span>🎉</span>}
          {state === 2 && <span className="text-xs text-gray-500">refunding</span>}
        </span>
        {count !== undefined && size !== undefined && (
          <>
            <span className="text-sm text-gray-600">
              {count.toString()}/{size.toString()} committed
            </span>
            <span className="mt-1 block h-2 overflow-hidden rounded-full bg-gray-200">
              <span className="block h-full rounded-full bg-emerald-700" style={{ width: pct }} />
            </span>
          </>
        )}
        <span className="mt-1 block font-mono text-[11px] text-gray-400">{pot}</span>
      </button>
    </li>
  );
}
