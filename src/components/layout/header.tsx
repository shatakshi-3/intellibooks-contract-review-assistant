"use client";

import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { ShieldCheck } from "lucide-react";

export function Header() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="flex h-16 items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-2 font-bold text-slate-900 text-lg">
            <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <span>IntelliBooks</span>
          </Link>
          <span className="hidden sm:inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-700/10">
            Contract Intelligence
          </span>
        </div>

        <div className="flex items-center gap-5">
          <Link
            href="/dashboard"
            className="text-xs text-slate-600 hover:text-indigo-600 transition font-medium"
          >
            Contracts
          </Link>
          <Link
            href="/evaluation"
            className="text-xs text-slate-600 hover:text-indigo-600 transition font-medium"
          >
            QA Evaluation
          </Link>
          <div className="h-4 w-px bg-slate-200" />
          <UserButton
            appearance={{
              elements: {
                userButtonAvatarBox: "h-8 w-8",
              },
            }}
          />
        </div>
      </div>
    </header>
  );
}
