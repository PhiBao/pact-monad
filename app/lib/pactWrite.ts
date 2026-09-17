"use client";

// Direct viem write path for Mera passkey accounts (bypasses wagmi connectors).
// Wagmi-connected wallets keep using useWriteContract; passkey sessions use this.

import { createPublicClient, createWalletClient, http } from "viem";
import { toViemAccount } from "@category-labs/mera/viem";
import { activeChain } from "./monad";
import { erc20Abi, factoryAbi, potAbi } from "./abi";
import { passkeySession } from "./mera";

const chain = activeChain();

export const pactPublic = createPublicClient({ chain, transport: http() });

export async function passkeyCommit(pot: `0x${string}`, value: bigint) {
  const s = passkeySession();
  if (!s) throw new Error("no passkey session");
  const wallet = createWalletClient({
    chain,
    transport: http(),
    account: toViemAccount(s.session),
  });
  return wallet.writeContract({ address: pot, abi: potAbi, functionName: "commit", value });
}

export async function passkeyCreatePot(
  factory: `0x${string}`,
  args: {
    token: `0x${string}`;
    perPerson: bigint;
    partySize: bigint;
    deadline: bigint;
    payee: `0x${string}`;
    title: string;
  }
) {
  const s = passkeySession();
  if (!s) throw new Error("no passkey session");
  const wallet = createWalletClient({
    chain,
    transport: http(),
    account: toViemAccount(s.session),
  });
  return wallet.writeContract({
    address: factory,
    abi: factoryAbi,
    functionName: "createPot",
    args: [args.token, args.perPerson, args.partySize, args.deadline, args.payee, args.title],
  });
}

export async function passkeyApprove(token: `0x${string}`, spender: `0x${string}`, amount: bigint) {
  const s = passkeySession();
  if (!s) throw new Error("no passkey session");
  const wallet = createWalletClient({
    chain,
    transport: http(),
    account: toViemAccount(s.session),
  });
  return wallet.writeContract({ address: token, abi: erc20Abi, functionName: "approve", args: [spender, amount] });
}

export async function passkeyCall(
  pot: `0x${string}`,
  fn: "release" | "expire" | "refund",
  args?: readonly unknown[]
) {
  const s = passkeySession();
  if (!s) throw new Error("no passkey session");
  const wallet = createWalletClient({
    chain,
    transport: http(),
    account: toViemAccount(s.session),
  });
  return wallet.writeContract({
    address: pot,
    abi: potAbi,
    functionName: fn,
    // release() needs fee args; caller passes them for that case.
    ...(args ? { args: args as never } : {}),
  });
}
