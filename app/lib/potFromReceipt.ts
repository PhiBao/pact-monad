import { parseEventLogs } from "viem";
import { factoryAbi } from "./abi";

// Extract the new pot address from a createPot receipt's PotCreated event.
// Returns null when the receipt carries no such event (caller shows fallback).
export function potFromReceipt(
  receipt: { logs: Parameters<typeof parseEventLogs>[0]["logs"] },
  factory: `0x${string}`
): `0x${string}` | null {
  try {
    const logs = parseEventLogs({
      abi: factoryAbi,
      eventName: "PotCreated",
      logs: receipt.logs,
      strict: false,
    });
    const mine = logs.find(
      (l) => l.address.toLowerCase() === factory.toLowerCase()
    );
    const pot = (mine?.args as unknown as { pot?: `0x${string}` } | undefined)?.pot;
    return pot ?? null;
  } catch {
    return null;
  }
}
