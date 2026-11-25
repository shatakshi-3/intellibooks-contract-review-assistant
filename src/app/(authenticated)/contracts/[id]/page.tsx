"use client";

import { useState, useEffect, use, useMemo } from "react";
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
  MessageSquare,
  ShieldCheck,
  Users,
  Calendar,
  CreditCard,
  AlertOctagon,
  Lock,
  Scale,
  RotateCw,
  FileCode,
} from "lucide-react";
import { ChatPanel } from "@/components/chat/chat-panel";
import { CHECKLIST_ITEMS, CHECKLIST_LABELS, type ChecklistItem } from "@/modules/reviews/constants";
import type { Contract, Review, ReviewFinding } from "@/lib/db/schema";

interface ContractDetailPageProps {
  params: Promise<{ id: string }>;
}

const CATEGORY_ICONS: Record<ChecklistItem, React.ComponentType<{ className?: string }>> = {
  parties: Users,
  start_date_and_term: Calendar,
  payment_terms: CreditCard,
  termination: AlertOctagon,
  limitation_of_liability: ShieldAlert,
  confidentiality: Lock,
  governing_law: Scale,
  auto_renewal: RotateCw,
};

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
  const [activeTab, setActiveTab] = useState<"review" | "chat" | "source">("review");
  const [statusFilter, setStatusFilter] = useState<"all" | "found" | "unclear" | "not_found">("all");
  const [sourceSearch, setSourceSearch] = useState("");

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
              // Also refresh findings
              const findRes = await fetch(`/api/contracts/${contractId}/reviews/${selectedReview.id}/findings`);
              if (findRes.ok) {
                const findJson = await findRes.json();
                setFindings(findJson.findings || []);
              }
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

  // Findings indexed by category
  const findingsByCategory = useMemo(() => {
    const map = new Map<ChecklistItem, ReviewFinding>();
    for (const f of findings) {
      map.set(f.checklistItem as ChecklistItem, f);
    }
    return map;
  }, [findings]);

  const foundCount = findings.filter((f) => f.status === "found").length;
  const notFoundCount = findings.filter((f) => f.status === "not_found").length;
  const unclearCount = findings.filter((f) => f.status === "unclear").length;

  // Filtered categories based on selected status filter
  const displayedCategories = useMemo(() => {
    return CHECKLIST_ITEMS.filter((category) => {
      if (statusFilter === "all") return true;
      const finding = findingsByCategory.get(category);
      if (!finding) return false;
      return finding.status === statusFilter;
    });
  }, [findingsByCategory, statusFilter]);

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
      <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm max-w-xl mx-auto my-12">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 mb-4 border border-amber-200">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h3 className="text-lg font-bold text-slate-900">Contract Inaccessible (404 Not Found)</h3>
        <p className="text-sm text-slate-600 mt-2 leading-relaxed">
          This document is protected by server-side row-level tenant isolation. It belongs to another organization and cannot be accessed by your current active identity.
        </p>
        <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500 font-mono text-left">
          Status: 404 Not Found (Tenant ownership verified on server)
        </div>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Return to My Dashboard
          </Link>
        </div>
      </div>
    );
  }

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
            <div className="h-11 w-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
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
                {contract?.pageCount && (
                  <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                    {contract.pageCount} {contract.pageCount === 1 ? "page" : "pages"}
                  </span>
                )}
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

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab("review")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
            activeTab === "review"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
          }`}
        >
          <ShieldCheck className="h-4 w-4" />
          <span>Review Checklist</span>
          {findings.length > 0 && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 font-mono">
              {findings.length}/8
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("chat")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
            activeTab === "chat"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
          }`}
        >
          <MessageSquare className="h-4 w-4" />
          <span>Contract Q&A Chat</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("source")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
            activeTab === "source"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
          }`}
        >
          <FileCode className="h-4 w-4" />
          <span>Extracted Source Text</span>
        </button>
      </div>

      {errorMsg && (
        <div className="rounded-lg bg-rose-50 border border-rose-200 p-4 text-sm text-rose-800 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-rose-500 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Tab 2: Chat */}
      {activeTab === "chat" && (
        <ChatPanel contractId={contractId} contractTitle={contract?.originalFilename} />
      )}

      {/* Tab 3: Source Text */}
      {activeTab === "source" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Document Raw Text</h3>
              <p className="text-xs text-slate-500">
                {contract?.extractedText ? `${contract.extractedText.length.toLocaleString()} characters` : "No text extracted"}
                {contract?.contentHash && ` • SHA-256: ${contract.contentHash.substring(0, 16)}...`}
              </p>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={sourceSearch}
                onChange={(e) => setSourceSearch(e.target.value)}
                placeholder="Search raw text..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50/50 text-slate-900 focus:outline-hidden focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs max-h-[600px] overflow-y-auto">
            {contract?.extractedText ? (
              <pre className="font-mono text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                {contract.extractedText}
              </pre>
            ) : (
              <p className="text-xs text-slate-400 italic">No text extracted yet. Ensure document processing is complete.</p>
            )}
          </div>
        </div>
      )}

      {/* Tab 1: Review Checklist */}
      {activeTab === "review" && (
        <>
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
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
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

                  {/* Tally Stats & Filter Buttons */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setStatusFilter("all")}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                        statusFilter === "all"
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      All (8)
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusFilter("found")}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                        statusFilter === "found"
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "border border-emerald-200 bg-emerald-50/50 text-emerald-700 hover:bg-emerald-100"
                      }`}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {foundCount} Found
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusFilter("unclear")}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                        statusFilter === "unclear"
                          ? "bg-amber-600 text-white shadow-xs"
                          : "border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                      }`}
                    >
                      <AlertCircle className="h-3.5 w-3.5" />
                      {unclearCount} Unclear
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusFilter("not_found")}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                        statusFilter === "not_found"
                          ? "bg-slate-700 text-white shadow-xs"
                          : "border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      {notFoundCount} Not Found
                    </button>
                  </div>
                </div>
              </div>

              {/* Checklist Items Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {displayedCategories.map((category) => {
                  const finding = findingsByCategory.get(category);
                  const label = CHECKLIST_LABELS[category];
                  const Icon = CATEGORY_ICONS[category] || ShieldCheck;

                  return (
                    <div
                      key={category}
                      className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs hover:border-slate-300 transition flex flex-col justify-between"
                    >
                      <div>
                        {/* Header: Title & Status */}
                        <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                              <Icon className="h-4 w-4" />
                            </div>
                            <h4 className="font-semibold text-slate-900 text-sm">{label}</h4>
                          </div>
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
                        {(finding?.status === "found" || finding?.status === "unclear") && finding?.exactQuote && (
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
                            <p className="font-mono text-xs text-slate-800 leading-relaxed break-words bg-white p-2.5 rounded border border-slate-200">
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
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
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
                        <span className="text-xs text-indigo-600 font-medium">Select</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-12 text-center shadow-xs">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 mb-4 border border-indigo-100">
                <ShieldCheck className="h-7 w-7 text-indigo-600" />
              </div>
              <h3 className="text-base font-bold text-slate-900">No Review Run Yet</h3>
              <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                Execute the automated 8-category compliance audit on this contract. All quotations will be independently verified against extracted text.
              </p>
              <div className="mt-6 flex items-center justify-center gap-3">
                <button
                  type="button"
                  disabled={isStartingReview || contract?.status !== "ready"}
                  onClick={handleStartReview}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 transition"
                >
                  <Play className="h-4 w-4" />
                  Run Contract Review
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
