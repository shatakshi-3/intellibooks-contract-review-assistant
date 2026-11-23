"use client";

import { Sparkles, Terminal } from "lucide-react";
import Link from "next/link";
import { isDemoMode } from "@/demo/config";

export function DemoProcessingBanner() {
  const isDemo = isDemoMode();
  if (!isDemo) return null;

  return (
    <div className="w-full bg-slate-900 text-white text-xs px-4 py-2 flex items-center justify-between border-b border-slate-800 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="font-semibold flex items-center gap-1.5 text-indigo-300">
          <Sparkles className="h-3.5 w-3.5 text-yellow-400" />
          Demo Processing Active:
        </span>
        <span className="text-slate-300 hidden md:inline">
          Deterministic local review engine active. Every user account and document is strictly isolated in Neon PostgreSQL.
        </span>
      </div>

      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="text-xs bg-indigo-600 hover:bg-indigo-500 px-2.5 py-1 rounded font-medium text-white transition flex items-center gap-1"
        >
          <Terminal className="h-3 w-3" />
          My Dashboard
        </Link>
        <Link
          href="/evaluation"
          className="text-xs text-indigo-200 hover:text-white transition hidden sm:inline"
        >
          QA Benchmark &rarr;
        </Link>
      </div>
    </div>
  );
}

// Backward-compatible alias
export const DemoBanner = DemoProcessingBanner;
