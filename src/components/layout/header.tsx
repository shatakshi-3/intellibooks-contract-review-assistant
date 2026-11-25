"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { ShieldCheck, FileText, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/95 backdrop-blur-md shadow-xs">
      <div className="flex h-16 items-center justify-between px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="flex items-center gap-2.5 font-bold text-slate-900 text-lg group">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white shadow-sm shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <span className="tracking-tight">IntelliBooks</span>
          </Link>
          <span className="hidden sm:inline-flex items-center rounded-md bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-700/10">
            Contract Intelligence
          </span>
        </div>

        <div className="flex items-center gap-6">
          <nav className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition",
                pathname.startsWith("/dashboard") || pathname.startsWith("/contracts")
                  ? "bg-indigo-50 text-indigo-700 font-bold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
              )}
            >
              <FileText className="h-3.5 w-3.5" />
              Contracts
            </Link>
            <Link
              href="/evaluation"
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition",
                pathname.startsWith("/evaluation")
                  ? "bg-indigo-50 text-indigo-700 font-bold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
              )}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Evaluation QA
            </Link>
          </nav>

          <div className="h-4 w-px bg-slate-200" />

          <UserButton
            appearance={{
              elements: {
                userButtonAvatarBox: "h-8 w-8 shadow-sm ring-2 ring-indigo-500/20",
              },
            }}
          />
        </div>
      </div>
    </header>
  );
}
