import Link from "next/link";
import { FileText, PlusCircle, CheckCircle2, Clock, AlertTriangle } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Contract Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage your legal agreements, track AI review statuses, and inspect verified clauses.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition"
          >
            <PlusCircle className="h-4 w-4" />
            Upload Contract
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Total Contracts
            </span>
            <FileText className="h-4 w-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">0</p>
          <span className="text-xs text-slate-400 mt-1 inline-block">
            Uploaded in workspace
          </span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Reviewed
            </span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">0</p>
          <span className="text-xs text-slate-400 mt-1 inline-block">
            Passed verification
          </span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              In Processing
            </span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">0</p>
          <span className="text-xs text-slate-400 mt-1 inline-block">
            Extracting & chunking
          </span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              High Risk Items
            </span>
            <AlertTriangle className="h-4 w-4 text-rose-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">0</p>
          <span className="text-xs text-slate-400 mt-1 inline-block">
            Missing required clauses
          </span>
        </div>
      </div>

      {/* Empty State */}
      <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-12 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <FileText className="h-6 w-6" />
        </div>
        <h3 className="mt-4 text-base font-semibold text-slate-900">
          No contracts uploaded yet
        </h3>
        <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
          Upload PDF, DOCX, or TXT agreements to run automated compliance checks and semantic clause search.
        </p>
        <div className="mt-6">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
          >
            <PlusCircle className="h-4 w-4" />
            Upload First Contract
          </button>
        </div>
      </div>
    </div>
  );
}
