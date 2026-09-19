"use client";

// Personal pot vault: every pot you create, join, or open is remembered on
// this device — including invite keys for private pots. The chain can't list
// "pots I can access" (private pots are invisible by design), so the vault is
// what makes them re-findable and re-shareable. Secrets here are no more
// exposed than they already are in browser history (they arrive via the link).

export type VaultRole = "organizer" | "member" | "visited";

export type VaultEntry = {
  secret?: `0x${string}`;
  role: VaultRole;
  title?: string;
  seenAt: number;
  /** Hidden from Your pots, but never deleted — always recoverable below. */
  hidden?: boolean;
};

const KEY = "wemadeit.pots.v1";

type Vault = Record<string, Record<string, VaultEntry>>;

function load(): Vault {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Vault) : {};
  } catch {
    return {};
  }
}

function save(v: Vault) {
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    /* private mode — vault just doesn't persist */
  }
}

function rank(r: VaultRole): number {
  return r === "organizer" ? 2 : r === "member" ? 1 : 0;
}

export function rememberPot(
  chainId: number,
  addr: string,
  patch: Partial<VaultEntry> & { role?: VaultRole } = {}
) {
  const v = load();
  const c = v[String(chainId)] ?? {};
  const prev = c[addr.toLowerCase()];
  const role = patch.role ?? prev?.role ?? "visited";
  c[addr.toLowerCase()] = {
    secret: patch.secret ?? prev?.secret,
    title: patch.title ?? prev?.title,
    role: rank(role) >= rank(prev?.role ?? "visited") ? role : prev!.role,
    seenAt: Date.now(),
    // Any fresh remember clears hidden (re-viewing = "I want this back");
    // only an explicit hide sets it.
    hidden: patch.hidden ?? false,
  };
  v[String(chainId)] = c;
  save(v);
}

export function vaultEntry(chainId: number, addr: string): VaultEntry | null {
  return load()[String(chainId)]?.[addr.toLowerCase()] ?? null;
}

export function vaultPots(chainId: number): { addr: string; entry: VaultEntry }[] {
  const c = load()[String(chainId)] ?? {};
  return Object.entries(c)
    .filter(([, entry]) => !entry.hidden)
    .map(([addr, entry]) => ({ addr, entry }))
    .sort((a, b) => b.entry.seenAt - a.entry.seenAt);
}

/** Hide from Your pots without deleting — recoverable via hiddenPots. */
export function forgetPot(chainId: number, addr: string) {
  rememberPot(chainId, addr, { hidden: true });
}

export function unhidePot(chainId: number, addr: string) {
  rememberPot(chainId, addr, { hidden: false });
}

export function hiddenPots(chainId: number): { addr: string; entry: VaultEntry }[] {
  const c = load()[String(chainId)] ?? {};
  return Object.entries(c)
    .filter(([, entry]) => entry.hidden)
    .map(([addr, entry]) => ({ addr, entry }))
    .sort((a, b) => b.entry.seenAt - a.entry.seenAt);
}
