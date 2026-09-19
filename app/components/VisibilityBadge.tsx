"use client";

// One-glance visibility: invite-only pots admit joiners solely via the keyed
// share link (enforced onchain); public pots accept anyone with the link.
export default function VisibilityBadge({ isPrivate }: { isPrivate: boolean }) {
  if (isPrivate) {
    return (
      <span
        title="Invite-only: joining requires the invite link"
        className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900"
      >
        🔒 Invite-only
      </span>
    );
  }
  return (
    <span
      title="Public: anyone with the link can join"
      className="inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-900"
    >
      🌍 Public
    </span>
  );
}
