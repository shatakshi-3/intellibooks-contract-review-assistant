"use client";

import { Sparkles, Users, RefreshCw, Terminal, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useDemoAuth } from "@/demo/auth";
import { DEMO_USER_1, DEMO_USER_2 } from "@/demo/config";

export function DemoBanner() {
  const { user, switchUser, isSwitching } = useDemoAuth();
  const otherUser = user.id === DEMO_USER_1.id ? DEMO_USER_2 : DEMO_USER_1;

  return (
    <div className="w-full bg-slate-900 text-white text-xs px-4 py-2 flex flex-wrap items-center justify-between border-b border-slate-800 gap-2 shadow-sm">
      <div className="flex items-center gap-2.5">
        <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="font-semibold flex items-center gap-1.5 text-indigo-300">
          <Sparkles className="h-3.5 w-3.5 text-yellow-400" />
          Demo Mode:
        </span>
        <span className="text-slate-300 hidden md:inline">
          Server-side tenant isolation active. Zero external API keys required.
        </span>
      </div>

      <div className="flex items-center gap-2.5">
        {/* Active Tenant Indicator */}
        <div className="flex items-center gap-1.5 bg-slate-800/90 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200">
          <Users className="h-3.5 w-3.5 text-indigo-400" />
          <span className="font-medium text-white">{user.name}</span>
          <span className="text-slate-400 text-[11px]">({user.tenantLabel.split(" ")[0]})</span>
        </div>

        {/* 1-Click Tenant Switcher */}
        <button
          type="button"
          onClick={() => switchUser(otherUser.id)}
          disabled={isSwitching}
          className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-2.5 py-1 rounded-lg border border-indigo-500 transition disabled:opacity-50 text-[11px] shadow-sm"
        >
          <RefreshCw className={`h-3 w-3 ${isSwitching ? "animate-spin" : ""}`} />
          {isSwitching ? "Switching..." : `Switch to ${otherUser.tenantLabel.split(" ")[0]}`}
        </button>

        <div className="h-3.5 w-px bg-slate-700 hidden sm:block" />

        <Link
          href="/dashboard"
          className="text-xs text-slate-300 hover:text-white transition hidden sm:inline"
        >
          Dashboard
        </Link>
      </div>
    </div>
  );
}
