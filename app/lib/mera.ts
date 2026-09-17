"use client";

// Mera passkey accounts: Face ID / Touch ID → deterministic EOA on Monad.
// One ceremony reproduces the same address on every synced device; no seed
// phrase, no contract, no bundler. Key lives only in page memory (session).

import {
  createPasskeyWithPrfOutput,
  getPasskeyPrfOutput,
  createSecp256k1SigningSession,
} from "@category-labs/mera";
import type { Secp256k1SigningSession } from "@category-labs/mera";
import { toViemAccount } from "@category-labs/mera/viem";
import { entropyToMnemonic, mnemonicToSeedSync } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { HDKey } from "@scure/bip32";

const CRED_KEY = "pact.passkey.credential";

export type PactSession = {
  session: Secp256k1SigningSession;
  address: `0x${string}`;
};

let live: PactSession | null = null;

function derivePrivateKey(prfOutput: Uint8Array, index = 0): Uint8Array {
  const mnemonic = entropyToMnemonic(prfOutput, wordlist);
  const seed = mnemonicToSeedSync(mnemonic);
  const node = HDKey.fromMasterSeed(seed).derive(`m/44'/60'/0'/0/${index}`);
  if (!node.privateKey) throw new Error("derivation produced no key");
  return node.privateKey;
}

function openSession(prfOutput: Uint8Array): PactSession {
  const session = createSecp256k1SigningSession({ privateKey: derivePrivateKey(prfOutput) });
  const account = toViemAccount(session);
  live = { session, address: account.address };
  return live;
}

function readStoredCredential() {
  try {
    const raw = localStorage.getItem(CRED_KEY);
    return raw ? (JSON.parse(raw) as { credentialId: string }) : undefined;
  } catch {
    return undefined;
  }
}

/** Face ID sign-in. Reuses the stored passkey, or creates one on first run. */
export async function passkeyConnect(displayName = "Pact user"): Promise<PactSession> {
  if (live) return live;
  const rpId = window.location.hostname;
  const known = readStoredCredential();
  try {
    const got = await getPasskeyPrfOutput({ rpId, credential: known });
    localStorage.setItem(CRED_KEY, JSON.stringify({ credentialId: got.credentialId }));
    return openSession(got.prfOutput);
  } catch {
    // No usable passkey yet — create one.
    const created = await createPasskeyWithPrfOutput({
      rp: { id: rpId, name: "Pact" },
      user: { name: `pact-${Date.now()}`, displayName },
    });
    localStorage.setItem(
      CRED_KEY,
      JSON.stringify({ credentialId: created.credentialId })
    );
    return openSession(created.prfOutput);
  }
}

export function passkeySession(): PactSession | null {
  return live;
}

export function passkeyDisconnect() {
  try {
    live?.session.end();
  } finally {
    live = null;
  }
}

export function shortAddress(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}
