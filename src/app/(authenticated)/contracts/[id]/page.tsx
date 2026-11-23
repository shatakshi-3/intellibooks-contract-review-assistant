"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  FileText,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  ShieldAlert,
  Copy,
  Check,
  Search,
} from "lucide-react";
import { CHECKLIST_ITEMS, CHECKLIST_LABELS, type ChecklistItem } from "@/modules/reviews/constants";
import type { Contract, Review, ReviewFinding } from "@/lib/db/schema";

interface ContractDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function ContractDetailPage({ params }: ContractDetailPageProps) {
  const resolvedParams = use(params);
  const contractId = resolvedParams.id;

  const [contract, setContract] = useState<Contract | null>(null);
  const [reviewsList, setReviewsList] = useState<Review[]>([]);
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [findings, setFindings] = useState<ReviewFinding[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStartingReview, setIsStartingReview] = useState(false);
  const [copiedQuoteId, setCopiedQuoteId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 1. Fetch Contract & Reviews
  useEffect(() => {
    let ignore = false;

    async function loadData() {
      setIsLoading(true);
      setErrorMsg(null);
      try {
        const [contractRes, reviewsRes] = await Promise.all([
          fetch(`/api/contracts/${contractId}`),
          fetch(`/api/contracts/${contractId}/reviews`),
        ]);

        if (contractRes.ok) {
          const contractJson = await contractRes.json();
          if (!ignore) setContract(contractJson.contract);
        } else {
          if (!ignore) setErrorMsg("Contract not found or access denied");
        }

        if (reviewsRes.ok) {
          const reviewsJson = await reviewsRes.json();
          if (!ignore && reviewsJson.reviews) {
            setReviewsList(reviewsJson.reviews);
            if (reviewsJson.reviews.length > 0) {
              setSelectedReview(reviewsJson.reviews[0]);
            }
          }
        }
      } catch (err) {
        if (!ignore) setErrorMsg(err instanceof Error ? err.message : "Failed to load contract");
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    loadData();
    return () => {
      ignore = true;
    };
  }, [contractId]);

  // 2. Fetch Findings for selected review
  useEffect(() => {
    if (!selectedReview) {
      return;
    }

    let ignore = false;

    fetch(`/api/contracts/${contractId}/reviews/${selectedReview.id}/findings`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!ignore && json) {
          setFindings(json.findings || []);
        }
      })
      .catch((err) => {
        console.error("Failed to load findings:", err);
      });

    // Poll if review is still processing
    let pollInterval: NodeJS.Timeout | null = null;
    if (selectedReview.overallStatus === "processing") {
      pollInterval = setInterval(async () => {
        try {
          const revRes = await fetch(`/api/contracts/${contractId}/reviews/${selectedReview.id}`);
          if (revRes.ok) {
            const revJson = await revRes.json();
            if (revJson.review && revJson.review.overallStatus !== "processing") {
              setSelectedReview(revJson.review);
            }
          }
        } catch {
          // ignore polling errors
        }
      }, 3000);
    }

    return () => {
      ignore = true;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [contractId, selectedReview]);

  // Start new review
  async function handleStartReview() {
    setIsStartingReview(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/contracts/${contractId}/reviews`, {
        method: "POST",
      });

      const json = await res.json();
      if (res.ok || res.status === 202) {
        // Refresh reviews list
        const refreshedRes = await fetch(`/api/contracts/${contractId}/reviews`);
        if (refreshedRes.ok) {
          const refreshedJson = await refreshedRes.json();
          setReviewsList(refreshedJson.reviews || []);
          if (refreshedJson.reviews?.length > 0) {
            setSelectedReview(refreshedJson.reviews[0]);
          }
        }
      } else if (res.status === 409) {
        setErrorMsg("A review run is already actively processing for this contract.");
      } else {
        setErrorMsg(json.error || "Failed to start review");
      }
    } catch {
      setErrorMsg("Network error starting review");
    } finally {
      setIsStartingReview(false);
    }
  }

  function handleCopyQuote(findingId: string, quote: string) {
    navigator.clipboard.writeText(quote);
    setCopiedQuoteId(findingId);
    setTimeout(() => setCopiedQuoteId(null), 2000);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          <p className="text-sm font-medium text-slate-600">Loading contract review data...</p>
        </div>
      </div>
    );
  }

  if (errorMsg && !contract) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center">
        <h3 className="text-base font-semibold text-rose-900">Error Loading Contract</h3>
        <p className="text-sm text-rose-700 mt-1">{errorMsg}</p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 mt-4 text-sm font-medium text-indigo-600 hover:text-indigo-500"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
      </div>
    );
  }

  // Findings indexed by category
  const findingsByCategory = new Map<ChecklistItem, ReviewFinding>();
  for (const f of findings) {
    findingsByCategory.set(f.checklistItem as ChecklistItem, f);
  }

  const foundCount = findings.filter((f) => f.status === "found").length;
  const notFoundCount = findings.filter((f) => f.status === "not_found").length;
  const unclearCount = findings.filter((f) => f.status === "unclear").length;

  return (
    <div className="space-y-8">
      {/* Back Link & Header */}
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Contracts Dashboard
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
          <div className="flex items-start gap-3.5">
            <div className="h-11 w-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-bold text-slate-900">
                  {contract?.originalFilename}
                </h1>
                <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 uppercase">
                  {contract?.fileType}
                </span>
                <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                  Status: {contract?.status}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Contract ID: <span className="font-mono text-slate-600">{contract?.id}</span> • Uploaded on{" "}
                {contract?.createdAt ? new Date(contract.createdAt).toLocaleDateString() : "N/A"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={isStartingReview || contract?.status !== "ready"}
              onClick={handleStartReview}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isStartingReview ? (
                <>
                  <Clock className="h-4 w-4 animate-spin" />
                  Dispatching Review...
                </>
              ) : selectedReview ? (
                <>
                  <RotateCcw className="h-4 w-4" />
                  Re-run Review
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Run Contract Review
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-lg bg-rose-50 border border-rose-200 p-4 text-sm text-rose-800 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-rose-500 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Automated Analysis Notice */}
      <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 flex items-start gap-3 text-xs text-amber-900">
        <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-amber-950">Automated Legal Document Analysis: </span>
          The findings below are generated via automated NLP and verifiable quote extraction. This report is provided for informational and preliminary review purposes only and does not constitute formal legal advice or guarantees of compliance. All terms should be independently verified with a qualified attorney.
        </div>
      </div>

      {/* Main Review Section */}
      {selectedReview ? (
        <div className="space-y-6">
          {/* Review Status Banner */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-base font-semibold text-slate-900">Review Execution Status</h3>
                  {selectedReview.overallStatus === "complete" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Complete
                    </span>
                  ) : selectedReview.overallStatus === "processing" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                      <Clock className="h-3.5 w-3.5 animate-spin" />
                      Analyzing Checklist (In Progress)...
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700">
                      <XCircle className="h-3.5 w-3.5" />
                      {selectedReview.overallStatus}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Model: <span className="font-mono">{selectedReview.modelId}</span> • Prompt Version:{" "}
                  <span className="font-mono">{selectedReview.promptVersion}</span> • Executed:{" "}
                  {new Date(selectedReview.createdAt).toLocaleString()}
                </p>
              </div>

              {/* Tally Stats */}
              <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {foundCount} Found
                </div>
                <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
                  <XCircle className="h-3.5 w-3.5" />
                  {notFoundCount} Not Found
                </div>
                <div className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {unclearCount} Unclear
                </div>
              </div>
            </div>
          </div>

          {/* 8 Checklist Items Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {CHECKLIST_ITEMS.map((category) => {
              const finding = findingsByCategory.get(category);
              const label = CHECKLIST_LABELS[category];

              return (
                <div
                  key={category}
                  className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-300 transition flex flex-col justify-between"
                >
                  <div>
                    {/* Header: Title & Status */}
                    <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
                      <h4 className="font-semibold text-slate-900 text-sm">{label}</h4>
                      {finding ? (
                        finding.status === "found" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                            <CheckCircle2 className="h-3 w-3" />
                            Found
                          </span>
                        ) : finding.status === "not_found" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                            <XCircle className="h-3 w-3" />
                            Not Found
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                            <AlertCircle className="h-3 w-3" />
                            Unclear
                          </span>
                        )
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-xs text-slate-400">
                          Pending...
                        </span>
                      )}
                    </div>

                    {/* Summary */}
                    <div className="mt-3">
                      <p className="text-xs font-medium text-slate-800">
                        {finding?.summary || "Analyzing category..."}
                      </p>
                      {finding?.reasoning && (
                        <p className="text-xs text-slate-500 mt-1 italic">
                          {finding.reasoning}
                        </p>
                      )}
                    </div>

                    {/* Verbatim Quote Box */}
                    {finding?.status === "found" && finding.exactQuote && (
                      <div className="mt-3.5 rounded-lg bg-slate-50 border border-slate-200 p-3">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                            <Search className="h-3 w-3 text-indigo-600" />
                            Verified Verbatim Quote:
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyQuote(finding.id, finding.exactQuote!)}
                            className="inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-500 font-medium"
                          >
                            {copiedQuoteId === finding.id ? (
                              <>
                                <Check className="h-3 w-3 text-emerald-600" />
                                <span className="text-emerald-600">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" />
                                Copy
                              </>
                            )}
                          </button>
                        </div>
                        <p className="font-mono text-xs text-slate-800 leading-relaxed break-words bg-white p-2 rounded border border-slate-200">
                          &ldquo;{finding.exactQuote}&rdquo;
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Metadata Footer */}
                  {finding && (
                    <div className="flex items-center justify-between gap-2 pt-3 mt-4 border-t border-slate-100 text-[11px] text-slate-500 flex-wrap">
                      <div className="flex items-center gap-2">
                        {finding.pageNumber && (
                          <span>Page {finding.pageNumber}</span>
                        )}
                        {finding.sectionReference && (
                          <span>• {finding.sectionReference}</span>
                        )}
                        {finding.startCharOffset !== null && finding.startCharOffset !== undefined && (
                          <span className="font-mono text-[10px] text-slate-400">
                            [{finding.startCharOffset}..{finding.endCharOffset}]
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {finding.quoteVerified && (
                          <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-medium text-emerald-700 text-[10px]">
                            {finding.verificationMethod === "exact_match" ? "Exact Match" : "Normalized"}
                          </span>
                        )}
                        {finding.confidenceLabel && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600 text-[10px]">
                            {finding.confidenceLabel} confidence
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Review History */}
          {reviewsList.length > 1 && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h4 className="text-sm font-semibold text-slate-900 mb-3">Review Execution History</h4>
              <div className="divide-y divide-slate-100">
                {reviewsList.map((rev) => (
                  <div
                    key={rev.id}
                    onClick={() => setSelectedReview(rev)}
                    className={`py-2.5 px-3 rounded-lg flex items-center justify-between cursor-pointer transition ${
                      selectedReview.id === rev.id ? "bg-indigo-50/70" : "hover:bg-slate-50"
                    }`}
                  >
                    <div>
                      <p className="text-xs font-semibold text-slate-900">
                        Run on {new Date(rev.createdAt).toLocaleString()}
                      </p>
                      <p className="text-[11px] text-slate-500 font-mono">
                        ID: {rev.id} • Model: {rev.modelId} • Duration: {rev.durationMs ? `${rev.durationMs}ms` : "N/A"}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-medium uppercase px-2 py-0.5 rounded ${
                        rev.overallStatus === "complete"
                          ? "bg-emerald-50 text-emerald-700"
                          : rev.overallStatus === "processing"
                          ? "bg-indigo-50 text-indigo-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {rev.overallStatus}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Empty State */
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 mb-4">
            <Search className="h-7 w-7" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">No Review Findings Yet</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-6">
            Run an automated analysis to evaluate this contract across the standard 8-point checklist: Parties, Term, Payment, Termination, Liability, Confidentiality, Governing Law, and Auto-Renewal.
          </p>
          <button
            type="button"
            disabled={isStartingReview || contract?.status !== "ready"}
            onClick={handleStartReview}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 transition"
          >
            {isStartingReview ? (
              <>
                <Clock className="h-4 w-4 animate-spin" />
                Dispatching Review...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Start Review Now
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
