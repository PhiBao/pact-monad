"use client";

import SessionBar from "./SessionBar";

export default function SiteHeader() {
  return (
    <header className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-6 pt-4">
      <span className="flex items-center gap-4">
        <a href="/" className="text-xl font-black tracking-tight">
          WeMadeIt 🎉
        </a>
        <a href="/browse" className="text-sm font-semibold underline">
          Browse
        </a>
      </span>
      <SessionBar />
    </header>
  );
}
