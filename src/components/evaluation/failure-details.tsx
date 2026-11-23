"use client";

import { X, AlertCircle } from "lucide-react";
import { CHECKLIST_LABELS } from "@/modules/reviews/constants";

export interface FailedCaseItem {
  fixtureName: string;
  checklistItem: string;
  expectedStatus: string;
  actualStatus?: string | null;
  expectedQuoteSubstring?: string | null;
  actualQuote?: string | null;
  failureReason?: string | null;
}

interface FailureDetailsProps {
  failures: FailedCaseItem[];
  onClose?: () => void;
}

export function FailureDetails({ failures, onClose }: FailureDetailsProps) {
  if (failures.length === 0) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-6 text-center text-sm text-emerald-800">
        All evaluated cases passed without errors or discrepancy.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-rose-200 bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 bg-rose-50/70 border-b border-rose-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-rose-600" />
          <h3 className="text-sm font-semibold text-rose-950">
            Case Failure Diagnostics ({failures.length} Failed {failures.length === 1 ? "Case" : "Cases"})
          </h3>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-rose-500 hover:bg-rose-100 transition"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
        {failures.map((f, i) => {
          const catLabel = CHECKLIST_LABELS[f.checklistItem as keyof typeof CHECKLIST_LABELS] || f.checklistItem;
          return (
            <div key={i} className="p-4 text-xs space-y-2 hover:bg-slate-50 transition">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900">{catLabel}</span>
                <span className="font-mono text-slate-500 text-[11px] bg-slate-100 px-2 py-0.5 rounded">
                  {f.fixtureName}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2.5 rounded border border-slate-200/60">
                <div>
                  <span className="text-slate-500">Expected Status: </span>
                  <span className="font-semibold uppercase text-indigo-700">{f.expectedStatus}</span>
                  {f.expectedQuoteSubstring && (
                    <p className="mt-1 text-slate-600 font-mono text-[10px] truncate">
                      Quote: &ldquo;{f.expectedQuoteSubstring}&rdquo;
                    </p>
                  )}
                </div>
                <div>
                  <span className="text-slate-500">Actual Status: </span>
                  <span className="font-semibold uppercase text-rose-600">{f.actualStatus || "N/A"}</span>
                  {f.actualQuote && (
                    <p className="mt-1 text-slate-600 font-mono text-[10px] truncate">
                      Quote: &ldquo;{f.actualQuote}&rdquo;
                    </p>
                  )}
                </div>
              </div>

              {f.failureReason && (
                <p className="text-rose-700 text-[11px] font-medium bg-rose-50/50 p-2 rounded border border-rose-100">
                  <span className="font-bold">Failure Reason: </span>
                  {f.failureReason}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
