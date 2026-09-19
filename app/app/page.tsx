"use client";

import { useEffect, useMemo, useState } from "react";
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
import { isAddress, parseAbiItem, parseEther } from "viem";
import { ausdAddress, POT_BOUNDS } from "../lib/monad";
import { useAppChain } from "../lib/app-chain";
import { factoryAbi, potAbi } from "../lib/abi";
import PasskeyConnect from "../components/PasskeyConnect";
import DynamicLogin from "../components/DynamicLogin";
import { useMera } from "../lib/mera-context";
import { ChainGuard, useWrongChain } from "../components/ChainGuard";
import { dynamicEnabled } from "../lib/wagmi";
import { parsePotText, type PotProposal } from "../lib/assist";
import VisibilityBadge from "../components/VisibilityBadge";
import { forgetPot, hiddenPots, rememberPot, unhidePot, vaultEntry, vaultPots } from "../lib/potVault";
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
  const [showCreate, setShowCreate] = useState(false);

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

  // Floors only — the contract sets no ceilings, so neither do we.
  const sizeNum = Number(partySize);
  const sizeErr =
    !/^\d+$/.test(partySize.trim()) || sizeNum < POT_BOUNDS.minParty
      ? `At least ${POT_BOUNDS.minParty} people. No upper limit.`
      : null;
  const amountErr = !(Number(amount) > 0) ? "Amount must be above zero." : null;
  const daysNum = Number(days);
  const daysErr =
    !/^\d+$/.test(days.trim()) || daysNum < POT_BOUNDS.minDays
      ? `At least ${POT_BOUNDS.minDays} day.`
      : null;
  const payeeErr =
    payee.trim() && !isAddress(payee.trim()) ? "Payee must be a valid address — or empty for you." : null;
  const titleErr =
    title.trim().length > POT_BOUNDS.maxTitle
      ? `Keep it under ${POT_BOUNDS.maxTitle} characters.`
      : null;
  const formValid = !sizeErr && !amountErr && !daysErr && !payeeErr && !titleErr;

  const { data: receipt } = useWaitForTransactionReceipt({ hash: hash ?? pkHash });

  // Creation confirmed → take the organizer straight to their pot.
  // Private pots carry the invite secret in the link fragment (never the query).
  useEffect(() => {
    if (!receipt || !factory) return;
    const pot = potFromReceipt(receipt, factory);
    if (pot) {
      // Vault it immediately: even if the redirect is interrupted, the pot
      // (and its invite key) stays re-findable in Your pots.
      rememberPot(appChainId, pot, {
        role: "organizer",
        ...(isPrivate && secret ? { secret } : {}),
      });
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
        <>
          <div className="mt-8">
            <button
              onClick={() => setShowCreate((v) => !v)}
              className="rounded-xl bg-emerald-900 px-6 py-3 font-semibold text-white"
            >
              {showCreate ? "Close" : "＋ Create a pot"}
            </button>
          </div>
          {showCreate && (
          <section className="mt-4 rounded-2xl border bg-white p-6 shadow-sm">
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
              {amountErr && <span className="text-xs text-red-700">{amountErr}</span>}
            </label>
            <label className="grid gap-1 text-sm">
              Group size (including you — no upper limit, fundraisers welcome)
              <input
                value={partySize}
                onChange={(e) => setPartySize(e.target.value)}
                inputMode="numeric"
                className="rounded-lg border px-3 py-2"
              />
              {sizeErr && <span className="text-xs text-red-700">{sizeErr}</span>}
            </label>
            <label className="grid gap-1 text-sm">
              Deadline (days from now)
              <input
                value={days}
                onChange={(e) => setDays(e.target.value)}
                inputMode="numeric"
                className="rounded-lg border px-3 py-2"
              />
              {daysErr && <span className="text-xs text-red-700">{daysErr}</span>}
            </label>
            <label className="grid gap-1 text-sm">
              Payee (defaults to you)
              <input
                value={payee}
                onChange={(e) => setPayee(e.target.value)}
                placeholder={address}
                className="rounded-lg border px-3 py-2 font-mono text-xs"
              />
              {payeeErr && <span className="text-xs text-red-700">{payeeErr}</span>}
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
              disabled={isPending || pkBusy || checking || wrongChain || !formValid}
              title={wrongChain ? "Switch network first" : !formValid ? "Fix the highlighted fields" : undefined}
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
        </>
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
        <PublicFeed factory={factory} count={potCount} chainId={appChainId} />
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
  const [vaultTick, setVaultTick] = useState(0);
  useEffect(() => {
    const load = () => {
      // Union of onchain-organized pots and the device vault (joined/visited
      // pots, and anything created while a scan was unavailable).
      const vaulted = vaultPots(chainId).map((v) => v.addr);
      if (!client || !viewer) {
        setMine(vaulted);
        return;
      }
      // NOTE: this signature must match the factory's PotCreated event exactly
      // (topic0 is the full signature hash) — a stale field list silently
      // matches nothing, which once made organizer pots vault-only.
      const POT_CREATED = parseAbiItem(
        "event PotCreated(address indexed pot, address indexed organizer, address indexed payee, address token, uint256 perPerson, uint256 partySize, uint256 deadline, string title, bool isPrivate)"
      );
      // Public RPCs cap eth_getLogs at ~100 blocks per call — one big range
      // fails outright, so the scan walks forward in small windows.
      const fetchOrganized = () =>
        client.getBlockNumber().then((latest) => {
          if (latest < deployBlock) return [];
          const spans: [bigint, bigint][] = [];
          const STEP = 100n;
          for (let from = deployBlock; from <= latest; from += STEP) {
            const to = from + STEP - 1n > latest ? latest : from + STEP - 1n;
            spans.push([from, to]);
          }
          return Promise.all(
            spans.map(([fromBlock, toBlock]) =>
              client.getLogs({ address: factory, event: POT_CREATED, args: { organizer: viewer }, fromBlock, toBlock })
            )
          ).then((pages) => pages.flat());
        });
      fetchOrganized()
        .catch(() => fetchOrganized()) // one retry: a single RPC hiccup must not blank Your pots
        .then((ls) => {
          const scanned = ls.map((l) => (l.args as unknown as { pot: string }).pot.toLowerCase());
          const hidden = new Set(hiddenPots(chainId).map((h) => h.addr));
          setMine([...new Set([...scanned, ...vaulted])].reverse().filter((a) => !hidden.has(a)));
        })
        .catch(() => setMine(vaulted));
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, factory, viewer, deployBlock, chainId, vaultTick]);
  const [showHidden, setShowHidden] = useState(false);
  const hidden = viewer ? hiddenPots(chainId) : [];
  if (!viewer || (mine.length === 0 && hidden.length === 0)) return null;
  return (
    <>
      <h2 className="text-xl font-bold">Your pots ({mine.length})</h2>
      <ul className="mt-3 grid gap-2">
        {mine.map((a) => (
          <OwnPotCard
            key={a}
            pot={a as `0x${string}`}
            chainId={chainId}
            onForget={() => {
              forgetPot(chainId, a);
              setVaultTick((t) => t + 1);
            }}
          />
        ))}
      </ul>
      {hidden.length > 0 && (
        <div className="mt-2">
          <button
            onClick={() => setShowHidden((v) => !v)}
            className="text-xs text-gray-500 underline"
          >
            {showHidden ? "Hide hidden pots" : `Hidden pots (${hidden.length}) — nothing is ever deleted`}
          </button>
          {showHidden && (
            <ul className="mt-2 grid gap-2 opacity-80">
              {hidden.map(({ addr, entry }) => (
                <li
                  key={addr}
                  className="flex items-center justify-between gap-2 rounded-xl border border-dashed bg-white px-4 py-2"
                >
                  <span className="min-w-0">
                    <strong className="block truncate text-sm">
                      {entry.title ?? "Untitled pot"}
                    </strong>
                    <span className="block truncate font-mono text-[11px] text-gray-400">{addr}</span>
                  </span>
                  <button
                    onClick={() => {
                      unhidePot(chainId, addr);
                      setVaultTick((t) => t + 1);
                    }}
                    className="shrink-0 rounded-lg border px-3 py-1 text-xs font-semibold"
                  >
                    Unhide
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}

function OwnPotCard({
  pot,
  chainId,
  onForget,
}: {
  pot: `0x${string}`;
  chainId: 143 | 10143;
  onForget: () => void;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const stored = vaultEntry(chainId, pot);
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
  const open = () => {
    // Re-attach the stored invite key so private pots open ready to commit.
    router.push(priv && stored?.secret ? `/pot/${pot}#s=${stored.secret}` : `/pot/${pot}`);
  };
  const copyInvite = () => {
    if (!stored?.secret || typeof window === "undefined") return;
    navigator.clipboard.writeText(`${window.location.origin}/pot/${pot}#s=${stored.secret}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <li className="rounded-xl border bg-white px-4 py-3 shadow-sm">
      <button onClick={open} className="block w-full text-left">
        <span className="flex items-center justify-between gap-2">
          <strong>{title ?? stored?.title ?? "Loading…"}</strong>
          <span className="flex items-center gap-2">
            {priv !== undefined && <VisibilityBadge isPrivate={priv} />}
            {state === 1 && <span>🎉</span>}
            {state === 2 && <span className="text-xs text-gray-500">refunding</span>}
          </span>
        </span>
        {count !== undefined && size !== undefined && (
          <span className="text-sm text-gray-600">
            {count.toString()}/{size.toString()} committed
          </span>
        )}
        <span className="mt-1 block font-mono text-[11px] text-gray-400">{pot}</span>
      </button>
      <span className="mt-1 flex gap-3 text-xs">
        {priv && stored?.secret && (
          <button onClick={copyInvite} className="font-semibold text-emerald-900 underline">
            {copied ? "Invite link copied ✓" : "Copy invite link"}
          </button>
        )}
        <button onClick={onForget} className="text-gray-400 underline">
          Hide
        </button>
      </span>
    </li>
  );
}

type FeedCard = {
  addr: string;
  title: string;
  count: bigint;
  size: bigint;
  state: number;
};

/** The single public discovery feed: search + status filter over recent pots.
 *  Invite-only pots are excluded at the data layer, never rendered. */
function PublicFeed({
  factory,
  count,
  chainId,
}: {
  factory: `0x${string}`;
  count: bigint | undefined;
  chainId: 143 | 10143;
}) {
  const router = useRouter();
  const n = count === undefined ? 0 : Number(count);
  const [addrs, setAddrs] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "filling" | "tilted">("all");
  const client = usePublicClient({ chainId });

  useEffect(() => {
    if (!client || n === 0) {
      setAddrs([]);
      return;
    }
    const start = Math.max(0, n - 30);
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
      { address: a as `0x${string}`, abi: potAbi, functionName: "title", chainId },
      { address: a as `0x${string}`, abi: potAbi, functionName: "commitCount", chainId },
      { address: a as `0x${string}`, abi: potAbi, functionName: "partySize", chainId },
      { address: a as `0x${string}`, abi: potAbi, functionName: "state", chainId },
      { address: a as `0x${string}`, abi: potAbi, functionName: "isPrivate", chainId },
    ]),
    query: { enabled: addrs.length > 0 },
  });

  const cards: FeedCard[] = useMemo(() => {
    if (!data) return [];
    const out: FeedCard[] = [];
    for (let i = 0; i < addrs.length; i++) {
      const r = data.slice(i * 5, i * 5 + 5).map((d) => d.result) as [
        string | undefined,
        bigint | undefined,
        bigint | undefined,
        number | undefined,
        boolean | undefined,
      ];
      if (r[4]) continue; // invite-only stays out of the public feed
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

  if (n === 0)
    return (
      <div>
        <h2 className="text-xl font-bold">Public pots</h2>
        <p className="mt-2 text-sm">No pots yet — start the first one.</p>
      </div>
    );

  return (
    <div>
      <h2 className="text-xl font-bold">
        {/* Count is joinable public pots, not the raw factory total. */}
        Public pots{data ? ` (${cards.length})` : ""}
      </h2>
      <p className="mt-1 text-xs text-gray-600">
        Anyone can join these. Invite-only pots never appear here — they live in
        their members&apos; Your pots.
      </p>
      <div className="mt-3 flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name…"
          className="w-full rounded-lg border bg-white px-3 py-2"
        />
        {(["all", "filling", "tilted"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg border bg-white px-3 py-2 text-sm font-semibold capitalize ${filter === f ? "border-emerald-900 bg-emerald-50" : ""}`}
          >
            {f}
          </button>
        ))}
      </div>
      {addrs.length === 0 || !data ? (
        <p className="mt-3 text-sm">Loading…</p>
      ) : shown.length === 0 ? (
        <p className="mt-3 text-sm">Nothing matches. Try another search.</p>
      ) : (
        <ul className="mt-3 grid gap-2">
          {shown.map((c) => (
            <li key={c.addr}>
              <button
                onClick={() => router.push(`/pot/${c.addr}`)}
                className="w-full rounded-xl border bg-white px-4 py-3 text-left shadow-sm hover:border-emerald-900"
              >
                <span className="flex items-center justify-between gap-2">
                  <strong>{c.title}</strong>
                  <span className="flex items-center gap-2">
                    <VisibilityBadge isPrivate={false} />
                    {c.state === 1 && <span>🎉</span>}
                    {c.state === 2 && <span className="text-xs text-gray-500">refunding</span>}
                  </span>
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
    </div>
  );
}
