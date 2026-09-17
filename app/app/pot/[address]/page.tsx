"use client";

import { use, useEffect, useState } from "react";
import PasskeyConnect from "../../../components/PasskeyConnect";
import DynamicLogin from "../../../components/DynamicLogin";
import { dynamicEnabled } from "../../../lib/wagmi";
import { passkeyApprove, passkeyCommit, passkeyCall } from "../../../lib/pactWrite";
import { scorePotLegit } from "../../../lib/assist";

function LegitBadge({
  pot,
  title,
  perPerson,
  size,
}: {
  pot: string;
  title: string;
  perPerson: string;
  size: string;
}) {
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    const key = `pact.legit.${pot}`;
    const cached = localStorage.getItem(key);
    if (cached) {
      setLabel(cached);
      return;
    }
    if (!title) return;
    scorePotLegit({ title, perPerson, partySize: size, token: "MON" }).then((r) => {
      if (!r) return;
      const text =
        r.label === "looks good" ? `✓ looks legitimate (${Math.round(r.p * 100)}%)` : "⚠ check details";
      localStorage.setItem(key, text);
      setLabel(text);
    });
  }, [pot, title, perPerson, size]);
  if (!label) return null;
  return <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs">{label}</span>;
}
import {
  useAccount,
  useConnect,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatEther } from "viem";
import { potAbi, erc20Abi } from "../../../lib/abi";
import { factoryAddress, activeChain } from "../../../lib/monad";

const ZERO = "0x0000000000000000000000000000000000000000";

function usePot(address: `0x${string}`) {
  return useReadContracts({
    contracts: [
      { address, abi: potAbi, functionName: "state" },
      { address, abi: potAbi, functionName: "commitCount" },
      { address, abi: potAbi, functionName: "partySize" },
      { address, abi: potAbi, functionName: "perPerson" },
      { address, abi: potAbi, functionName: "deadline" },
      { address, abi: potAbi, functionName: "token" },
      { address, abi: potAbi, functionName: "payee" },
      { address, abi: potAbi, functionName: "contributors" },
      { address, abi: potAbi, functionName: "title" },
    ],
    query: { refetchInterval: 2000 },
  });
}

export default function PotPage({ params }: { params: Promise<{ address: string }> }) {
  const { address: raw } = use(params);
  const pot = raw as `0x${string}`;
  const chain = activeChain();
  const factory = factoryAddress();
  const { address: me } = useAccount();
  const { connect, connectors } = useConnect();
  const { data, refetch } = usePot(pot);
  const [meraAddr, setMeraAddr] = useState<string | null>(null);
  const viewer = (me ?? meraAddr) as `0x${string}` | undefined;

  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const [pkHash, setPkHash] = useState<`0x${string}` | undefined>();
  const [pkBusy, setPkBusy] = useState(false);
  const [pkErr, setPkErr] = useState<string | null>(null);
  const { isSuccess } = useWaitForTransactionReceipt({ hash: hash ?? pkHash });

  const pk = async (fn: () => Promise<`0x${string}`>) => {
    setPkBusy(true);
    setPkErr(null);
    try {
      setPkHash(await fn());
    } catch (e) {
      setPkErr(e instanceof Error ? e.message.slice(0, 200) : "transaction failed");
    } finally {
      setPkBusy(false);
    }
  };

  const { data: myCommitted } = useReadContract({
    address: pot,
    abi: potAbi,
    functionName: "committed",
    args: [viewer!],
    query: { enabled: !!viewer },
  });
  void factory;

  if (!data) return <main className="p-8">Loading pot…</main>;
  const [state, count, size, perPerson, deadline, token, payee, contributors, potTitle] = data.map(
    (d) => d.result
  ) as [number, bigint, bigint, bigint, bigint, string, string, string[], string];

  const full = count >= size;
  const expired = Date.now() / 1000 >= Number(deadline);
  const isNative = token === ZERO;
  const stateLabel = ["Open", "Tilted — paid out", "Refunding"][state] ?? "Unknown";
  const left = Math.max(0, Number(deadline) - Math.floor(Date.now() / 1000));
  const explorer = `${chain.blockExplorers!.default.url}/address/${pot}`;

  const act = (fn: () => void) => {
    reset?.();
    fn();
  };

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <a href="/" className="text-sm underline">
        ← all pots
      </a>
      <h1 className="mt-2 text-3xl font-black">{potTitle || "Untitled pot"}</h1>
      <p className="font-mono text-xs text-gray-500 break-all">{pot}</p>
      <p className="mt-1 text-sm">
        Status: <strong>{stateLabel}</strong>
        <LegitBadge
          pot={pot}
          title={potTitle}
          perPerson={formatEther(perPerson)}
          size={size.toString()}
        />{" "}
        <a href={explorer} target="_blank" className="underline">
          explorer
        </a>
      </p>

      {/* Progress */}
      <div className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex items-end justify-between">
          <p className="text-5xl font-black">
            {count.toString()}
            <span className="text-2xl text-gray-500">/{size.toString()}</span>
          </p>
          <p className="text-right text-sm">
            {formatEther(perPerson)} {isNative ? "MON" : "tokens"} each
            <br />
            {expired ? "deadline passed" : `${Math.floor(left / 3600)}h ${Math.floor((left % 3600) / 60)}m left`}
          </p>
        </div>
        <div className="mt-4 h-4 overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-emerald-700 transition-all"
            style={{ width: `${(Number(count) / Number(size)) * 100}%` }}
          />
        </div>
        {full && state === 0 && (
          <p className="mt-3 animate-pulse text-xl font-black text-emerald-800">TILTED 🎉</p>
        )}
      </div>

      {/* Contributors */}
      <div className="mt-4 rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="font-bold">Committed ({contributors.length})</h2>
        {contributors.length === 0 && <p className="text-sm">Nobody yet — be the first.</p>}
        <ul className="mt-2 grid gap-1 font-mono text-xs">
          {contributors.map((c) => (
            <li key={c}>
              {c} {c === me ? "(you)" : ""}
            </li>
          ))}
        </ul>
      </div>

      {/* Actions */}
      <div className="mt-4 rounded-2xl border bg-white p-6 shadow-sm">
        {!viewer ? (
          <div className="grid gap-4">
            <PasskeyConnect onChange={setMeraAddr} />
            {dynamicEnabled ? (
              <DynamicLogin />
            ) : (
              <button
                onClick={() => connect({ connector: connectors[0] })}
                className="rounded-xl border px-6 py-3 font-semibold"
              >
                Use a wallet app
              </button>
            )}
          </div>
        ) : state === 0 && !full && !expired ? (
          myCommitted ? (
            <p className="font-semibold text-emerald-800">You&apos;re in ✓ — share the link to fill the rest.</p>
          ) : isNative ? (
            <button
              onClick={() =>
                meraAddr
                  ? pk(() => passkeyCommit(pot, perPerson))
                  : act(() =>
                      writeContract({ address: pot, abi: potAbi, functionName: "commit", value: perPerson })
                    )
              }
              disabled={isPending || pkBusy}
              className="rounded-xl bg-emerald-900 px-6 py-3 font-semibold text-white disabled:opacity-50"
            >
              {isPending || pkBusy ? "Committing…" : `Commit ${formatEther(perPerson)} MON`}
            </button>
          ) : (
            <Erc20Commit
              pot={pot}
              token={token as `0x${string}`}
              perPerson={perPerson}
              viaPasskey={!!meraAddr}
              pk={pk}
            />
          )
        ) : state === 0 && full ? (
          <button
            onClick={() =>
              meraAddr
                ? pk(() => passkeyCall(pot, "release"))
                : act(() => writeContract({ address: pot, abi: potAbi, functionName: "release" }))
            }
            disabled={isPending || pkBusy}
            className="rounded-xl bg-emerald-700 px-6 py-3 font-semibold text-white disabled:opacity-50"
          >
            {isPending || pkBusy ? "Releasing…" : `Release ${formatEther(perPerson * size)} to organizer`}
          </button>
        ) : state === 0 && expired ? (
          <ExpireRefund
            pot={pot}
            me={viewer!}
            myCommitted={!!myCommitted}
            viaPasskey={!!meraAddr}
            pk={pk}
          />
        ) : state === 2 ? (
          myCommitted ? (
            <button
              onClick={() =>
                meraAddr
                  ? pk(() => passkeyCall(pot, "refund"))
                  : act(() => writeContract({ address: pot, abi: potAbi, functionName: "refund" }))
              }
              disabled={isPending || pkBusy}
              className="rounded-xl bg-gray-900 px-6 py-3 font-semibold text-white disabled:opacity-50"
            >
              {isPending || pkBusy ? "Refunding…" : "Claim my refund"}
            </button>
          ) : (
            <p>Pot missed its goal. Contributors can claim refunds.</p>
          )
        ) : (
          <p>
            Paid out to <span className="font-mono text-xs">{payee}</span>
          </p>
        )}
        {error && <p className="mt-2 text-sm text-red-700">{error.message.slice(0, 220)}</p>}
        {pkErr && <p className="mt-2 text-sm text-red-700">{pkErr}</p>}
        {isSuccess && (
          <p className="mt-2 text-sm text-emerald-800">
            Confirmed ✓ <button className="underline" onClick={() => refetch()}>refresh</button>
          </p>
        )}
      </div>

      {/* Share */}
      <div className="mt-4 rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="font-bold">Share this pot</h2>
        <ShareLink />
      </div>
    </main>
  );
}

function Erc20Commit({
  pot,
  token,
  perPerson,
  viaPasskey,
  pk,
}: {
  pot: `0x${string}`;
  token: `0x${string}`;
  perPerson: bigint;
  viaPasskey: boolean;
  pk: (fn: () => Promise<`0x${string}`>) => Promise<void>;
}) {
  const { address: me } = useAccount();
  const viewer = me ?? undefined;
  const { writeContract, isPending, data: txHash } = useWriteContract();
  const { data: allowance, refetch } = useReadContract({
    address: token,
    abi: erc20Abi,
    functionName: "allowance",
    args: [viewer!, pot],
    query: { enabled: !!viewer, refetchInterval: 2000 },
  });
  const { isSuccess: txDone } = useWaitForTransactionReceipt({ hash: txHash });
  useEffect(() => {
    if (txDone) refetch();
  }, [txDone, refetch]);
  const ok = (allowance ?? 0n) >= perPerson;
  const approve = () =>
    viaPasskey
      ? pk(async () => {
          const h = await passkeyApprove(token, pot, perPerson);
          refetch();
          return h;
        })
      : writeContract({ address: token, abi: erc20Abi, functionName: "approve", args: [pot, perPerson] });
  const commit = () =>
    viaPasskey
      ? pk(() => passkeyCommit(pot, 0n))
      : writeContract({ address: pot, abi: potAbi, functionName: "commit" });
  return ok ? (
    <button
      onClick={commit}
      disabled={isPending}
      className="rounded-xl bg-emerald-900 px-6 py-3 font-semibold text-white disabled:opacity-50"
    >
      Commit tokens
    </button>
  ) : (
    <button
      onClick={approve}
      disabled={isPending}
      className="rounded-xl bg-emerald-900 px-6 py-3 font-semibold text-white disabled:opacity-50"
    >
      Approve then commit
    </button>
  );
}

function ExpireRefund({
  pot,
  me,
  myCommitted,
  viaPasskey,
  pk,
}: {
  pot: `0x${string}`;
  me: string;
  myCommitted: boolean;
  viaPasskey: boolean;
  pk: (fn: () => Promise<`0x${string}`>) => Promise<void>;
}) {
  const { writeContract, isPending } = useWriteContract();
  void me;
  const expire = () =>
    viaPasskey
      ? pk(() => passkeyCall(pot, "expire"))
      : writeContract({ address: pot, abi: potAbi, functionName: "expire" });
  const refund = () =>
    viaPasskey
      ? pk(() => passkeyCall(pot, "refund"))
      : writeContract({ address: pot, abi: potAbi, functionName: "refund" });
  return (
    <div className="grid gap-2">
      <p className="text-sm">Deadline passed without filling. Open refunds, then claim yours.</p>
      <div className="flex gap-2">
        <button
          onClick={expire}
          disabled={isPending}
          className="rounded-xl bg-gray-900 px-6 py-3 font-semibold text-white disabled:opacity-50"
        >
          Open refunds
        </button>
        {myCommitted && (
          <button
            onClick={refund}
            disabled={isPending}
            className="rounded-xl border px-6 py-3 font-semibold disabled:opacity-50"
          >
            Claim refund
          </button>
        )}
      </div>
    </div>
  );
}

function ShareLink() {
  const [copied, setCopied] = useState(false);
  if (typeof window === "undefined") return null;
  const url = window.location.href;
  return (
    <div className="mt-2 flex gap-2">
      <input readOnly value={url} className="w-full rounded-lg border px-3 py-2 font-mono text-xs" />
      <button
        onClick={() => {
          navigator.clipboard.writeText(url);
          setCopied(true);
        }}
        className="rounded-lg border px-4 py-2 text-sm font-semibold"
      >
        {copied ? "Copied ✓" : "Copy"}
      </button>
    </div>
  );
}
