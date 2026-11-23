"use client";

import { Sparkles, Terminal } from "lucide-react";
import Link from "next/link";

export function DemoBanner() {
  return (
    <div className="w-full bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white text-xs px-4 py-2 flex items-center justify-between border-b border-indigo-700/50 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="font-semibold flex items-center gap-1.5 text-indigo-200">
          <Sparkles className="h-3.5 w-3.5 text-yellow-300" />
          Demo Mode Active:
        </span>
        <span className="text-slate-300 hidden md:inline">
          Running locally without Clerk credentials. Mock admin session & sample contracts loaded.
        </span>
      </div>
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="text-xs bg-indigo-600/80 hover:bg-indigo-600 px-2.5 py-1 rounded font-medium text-white transition flex items-center gap-1"
        >
          <Terminal className="h-3 w-3" />
          Dashboard
        </Link>
        <Link
          href="/evaluation"
          className="text-xs text-indigo-200 hover:text-white transition hidden sm:inline"
        >
          QA Dashboard &rarr;
        </Link>
      </div>
    </div>
  );
}
