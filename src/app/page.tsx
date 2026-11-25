import Link from "next/link";
import {
  ShieldCheck,
  ArrowRight,
  Lock,
  Scale,
  Sparkles,
  CheckCircle2,
  Layers,
} from "lucide-react";
import { auth } from "@clerk/nextjs/server";

export default async function HomePage() {
  let userId: string | null = null;
  try {
    const authResult = await auth();
    userId = authResult.userId;
  } catch {
    userId = null;
  }

  const checklistItems = [
    { title: "Contracting Parties", desc: "Entity names, corporate status, signatory roles" },
    { title: "Start Date & Term", desc: "Effective dates, performance periods, expirations" },
    { title: "Payment Terms", desc: "Fee schedules, Net 30/60 terms, late penalties" },
    { title: "Termination", desc: "For cause, convenience, notice periods, cure windows" },
    { title: "Limitation of Liability", desc: "Aggregate caps, consequential damage exclusions" },
    { title: "Confidentiality", desc: "NDA clauses, definition of trade secrets, survival" },
    { title: "Governing Law", desc: "State/federal venue, jurisdiction, conflict of laws" },
    { title: "Auto-Renewal", desc: "Successive term extensions, opt-out notice deadlines" },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-indigo-500/30">
      {/* Glow Effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-indigo-500/10 via-cyan-500/5 to-transparent blur-3xl pointer-events-none" />

      {/* Navigation */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex h-16 items-center justify-between px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <span className="font-bold text-white text-lg tracking-tight">IntelliBooks</span>
              <span className="hidden sm:inline-block ml-2 text-[10px] font-semibold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full">
                Contract Intelligence
              </span>
            </div>
          </div>

          <nav className="flex items-center gap-3">
            {!userId ? (
              <>
                <Link
                  href="/sign-in"
                  className="text-sm font-medium text-slate-300 hover:text-white px-3.5 py-2 transition"
                >
                  Sign In
                </Link>
                <Link
                  href="/sign-up"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-500 shadow-md shadow-indigo-600/25 transition active:scale-[0.98]"
                >
                  Get Started
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </>
            ) : (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 text-sm font-semibold rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-500 shadow-md shadow-indigo-600/25 transition"
              >
                Go to Dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="relative px-6 lg:px-8 pt-20 pb-24 text-center max-w-5xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3.5 py-1.5 text-xs font-semibold text-indigo-300 mb-8 shadow-inner">
            <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
            <span>AI Contract Audit & Verification Gate</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.1]">
            Verify agreements with{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-cyan-400 to-indigo-300">
              zero hallucinations
            </span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-slate-400 max-w-3xl mx-auto leading-relaxed">
            IntelliBooks automatically audits agreements against 8 critical legal categories, enforces strict character-offset quotation verification against source text, and enables semantic RAG chat powered by Neon pgvector.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            {userId ? (
              <Link
                href="/dashboard"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-7 py-4 text-base font-semibold text-white shadow-xl shadow-indigo-600/30 hover:bg-indigo-500 transition active:scale-[0.98]"
              >
                Enter Contract Dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <>
                <Link
                  href="/sign-up"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-7 py-4 text-base font-semibold text-white shadow-xl shadow-indigo-600/30 hover:bg-indigo-500 transition active:scale-[0.98]"
                >
                  Start Reviewing Contracts
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/sign-in"
                  className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl border border-slate-700/80 bg-slate-900/80 px-7 py-4 text-base font-medium text-slate-200 hover:bg-slate-800 hover:text-white transition"
                >
                  Sign In to Workspace
                </Link>
              </>
            )}
          </div>

          {/* Interactive Contract Verification Preview Card */}
          <div className="mt-16 rounded-2xl border border-slate-800 bg-slate-900/80 p-6 sm:p-8 text-left shadow-2xl backdrop-blur-sm max-w-4xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
                  PDF
                </div>
                <div>
                  <h3 className="font-semibold text-white text-base">Enterprise Cloud Services Agreement.pdf</h3>
                  <p className="text-xs text-slate-400">Status: Verified • 8 Categories Evaluated • Neon pgvector Indexed</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-xs font-semibold text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Quote Verified (Exact Match)
                </span>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">Limitation of Liability</span>
                  <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">found</span>
                </div>
                <p className="text-xs text-slate-300 mt-2">
                  Total aggregate liability is capped at the fees paid in the preceding 12 months. Consequential and punitive damages excluded.
                </p>
                <div className="mt-3 bg-slate-900/90 rounded-lg border border-slate-800 p-2.5 font-mono text-[11px] text-slate-300">
                  &ldquo;Neither party&apos;s aggregate liability shall exceed the total fees paid by Customer in the 12 months preceding the incident.&rdquo;
                </div>
                <div className="mt-2 text-[10px] text-slate-500 flex items-center justify-between">
                  <span>Page 6 • Section 11.2</span>
                  <span className="font-mono text-slate-400">Offset: [4,812..4,948]</span>
                </div>
              </div>

              <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">Termination & Notice</span>
                  <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">found</span>
                </div>
                <p className="text-xs text-slate-300 mt-2">
                  Either party may terminate for convenience with 30 days prior written notice, or immediately for uncured material breach.
                </p>
                <div className="mt-3 bg-slate-900/90 rounded-lg border border-slate-800 p-2.5 font-mono text-[11px] text-slate-300">
                  &ldquo;Either party may terminate this Agreement without cause upon thirty (30) days prior written notice to the other party.&rdquo;
                </div>
                <div className="mt-2 text-[10px] text-slate-500 flex items-center justify-between">
                  <span>Page 4 • Section 8.1</span>
                  <span className="font-mono text-slate-400">Offset: [2,630..2,746]</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 8 Categories Checklist Section */}
        <section className="py-20 border-t border-slate-800/80 bg-slate-950/40 px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">Comprehensive Compliance</span>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mt-2">
                Automated 8-Category Legal Audit
              </h2>
              <p className="mt-3 text-slate-400 text-sm sm:text-base">
                Every contract is systematically examined against eight core standard provisions with verified source citations.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {checklistItems.map((item, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 hover:border-indigo-500/40 hover:bg-slate-900/70 transition"
                >
                  <div className="h-8 w-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-xs mb-3">
                    0{idx + 1}
                  </div>
                  <h3 className="font-semibold text-white text-sm">{item.title}</h3>
                  <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Architecture & Verification Pillars */}
        <section className="py-20 border-t border-slate-800/80 px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">Built for Enterprise Trust</span>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mt-2">
                Rigorous Architecture with Grounding Guarantees
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 flex flex-col justify-between">
                <div>
                  <div className="h-10 w-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-4">
                    <Scale className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-semibold text-white">Quotation Verification Gate</h3>
                  <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                    Every quotation extracted by the LLM is programmatically verified against extracted raw document text. Unmatched citations are automatically demoted to protect against hallucinations.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-800/80 text-xs font-mono text-indigo-400">
                  Exact Match & Normalized Fuzzy Alignment
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 flex flex-col justify-between">
                <div>
                  <div className="h-10 w-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-4">
                    <Layers className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-semibold text-white">Neon pgvector Retrieval</h3>
                  <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                    Documents are parsed, chunked with structural section metadata, embedded via OpenAI text-embedding-3-small, and retrieved with cosine distance vector indexes.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-800/80 text-xs font-mono text-cyan-400">
                  1536-Dimensional Embeddings & HNSW
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 flex flex-col justify-between">
                <div>
                  <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4">
                    <Lock className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-semibold text-white">Strict Multi-Tenant Isolation</h3>
                  <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                    Every database query, vector search, and API endpoint binds directly to Clerk&apos;s authenticated user ID on the server. Cross-tenant access attempts return 404 to prevent enumeration.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-slate-800/80 text-xs font-mono text-emerald-400">
                  Zero Data Leakage Boundary
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-8 text-center text-xs text-slate-500 bg-slate-950">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-indigo-400" />
            <span className="font-semibold text-slate-300">IntelliBooks Contract Intelligence</span>
          </div>
          <p>&copy; {new Date().getFullYear()} IntelliBooks Inc. Production Architecture Ready for Vercel.</p>
        </div>
      </footer>
    </div>
  );
}
