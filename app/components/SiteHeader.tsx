"use client";

import Link from "next/link";
import SessionBar from "./SessionBar";

export default function SiteHeader() {
  return (
    <header className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-6 pt-4">
      {/* Next Link = client-side nav: no document reload, so the in-memory
          passkey session survives. A plain <a> would log Face ID users out. */}
      <Link href="/" className="text-xl font-black tracking-tight">
        WeMadeIt 🎉
      </Link>
      <SessionBar />
    </header>
  );
}
