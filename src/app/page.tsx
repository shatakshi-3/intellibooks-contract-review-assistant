import Link from "next/link";
import { ShieldCheck, ArrowRight, FileCheck2, Search, Cpu } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { isDemoMode } from "@/demo/config";

export default async function HomePage() {
  let userId: string | null = null;
  try {
    const authResult = await auth();
    userId = authResult.userId;
  } catch {
    userId = null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-900 text-slate-100">
      {/* Navigation */}
      <header className="border-b border-slate-800/80 bg-slate-950/40 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-2.5 font-bold text-white text-lg">
            <div className="h-8 w-8 rounded-lg bg-indigo-500 flex items-center justify-center text-white shadow-sm">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <span>IntelliBooks</span>
          </div>

          <div className="flex items-center gap-3">
            {!userId ? (
              <>
                <Link
                  href="/sign-in"
                  className="text-sm font-medium text-slate-300 hover:text-white px-3 py-1.5 transition"
                >
                  Sign In
                </Link>
                <Link
                  href="/sign-up"
                  className="text-sm font-semibold rounded-lg bg-indigo-500 px-4 py-2 text-white hover:bg-indigo-400 shadow transition"
                >
                  Get Started
                </Link>
              </>
            ) : (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 text-sm font-semibold rounded-lg bg-indigo-500 px-4 py-2 text-white hover:bg-indigo-400 shadow transition"
              >
                Go to Dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-300 mb-6">
          <span>AI Contract Review & Intelligence</span>
        </div>
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
          Verify agreements with{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
            zero hallucinations
          </span>
        </h1>
        <p className="mt-6 text-lg text-slate-400 max-w-2xl leading-relaxed">
          IntelliBooks automatically checks contracts against critical compliance provisions, enforces exact quote verification against original text, and indexes clauses with pgvector semantic search.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center gap-4">
          {userId ? (
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-500 px-6 py-3.5 text-base font-semibold text-white shadow-lg hover:bg-indigo-400 transition"
            >
              Enter Dashboard
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <>
              <Link
                href="/sign-up"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-500 px-6 py-3.5 text-base font-semibold text-white shadow-lg hover:bg-indigo-400 transition"
              >
                Start Free Trial
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/sign-in"
                className="inline-flex items-center justify-center rounded-xl border border-slate-700 bg-slate-800/80 px-6 py-3.5 text-base font-medium text-slate-200 hover:bg-slate-800 hover:text-white transition"
              >
                Sign In
              </Link>
            </>
          )}
        </div>

        {/* Feature Grid */}
        <div className="mt-20 grid grid-cols-1 sm:grid-cols-3 gap-6 text-left w-full">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <div className="h-10 w-10 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center mb-4">
              <FileCheck2 className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-white">8-Item Checklist</h3>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">
              Automated audit for indemnification, governing law, termination, liability caps, and more.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <div className="h-10 w-10 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center mb-4">
              <Cpu className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-white">Quote Verification</h3>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">
              Every citation is cross-checked against source text with exact character offsets.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <div className="h-10 w-10 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4">
              <Search className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-white">Scoped RAG & Chat</h3>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">
              Per-contract conversational intelligence strictly isolated to the document owner.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-6 text-center text-xs text-slate-500">
        &copy; {new Date().getFullYear()} IntelliBooks Inc. All rights reserved.
      </footer>
    </div>
  );
}
