"use client";

import { useState, useEffect } from "react";
import {
  ShieldAlert,
  Play,
  CheckCircle2,
  Clock,
  BarChart3,
  FileCheck,
  FileText,
  AlertCircle,
  Eye,
  Award,
} from "lucide-react";
import { MetricsCard } from "@/components/evaluation/metrics-card";
import { FailureDetails, type FailedCaseItem } from "@/components/evaluation/failure-details";
import { CHECKLIST_LABELS, type ChecklistItem } from "@/modules/reviews/constants";

interface DashboardData {
  totalRuns: number;
  latestRun: {
    id: string;
    modelId: string;
    promptVersion: string;
    embeddingModel: string | null;
    totalCases: number;
    passedCases: number;
    failedCases: number;
    passRate: number;
    statusAccuracy: number;
    quoteValidityRate: number;
    precisionScore: number;
    recallScore: number;
    f1Score: number;
    missingClauseDetectionRate: number;
    durationMs: number | null;
    createdAt: string;
    detailedMetrics?: {
      perCategory?: Record<
        ChecklistItem,
        {
          precision: number;
          recall: number;
          f1: number;
          truePositives: number;
          falsePositives: number;
          falseNegatives: number;
        }
      >;
    };
  } | null;
  recentRuns: Array<{
    id: string;
    runType: string;
    modelId: string;
    passRate: number;
    f1Score: number;
    quoteValidityRate: number;
    durationMs: number | null;
    createdAt: string;
  }>;
  averageMetrics: {
    passRate: number;
    statusAccuracy: number;
    quoteValidityRate: number;
    f1Score: number;
  };
}

export default function EvaluationDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isTriggering, setIsTriggering] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isForbidden, setIsForbidden] = useState(false);

  // Selected run details modal
  const [selectedRunReport, setSelectedRunReport] = useState<{
    id: string;
    markdown: string;
    failures: FailedCaseItem[];
  } | null>(null);

  const loadDashboardData = async () => {
    setErrorMsg(null);
    try {
      const res = await fetch("/api/evaluation/dashboard");
      if (res.status === 403) {
        setIsForbidden(true);
        return;
      }
      if (!res.ok) {
        throw new Error("Failed to load evaluation dashboard data");
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error connecting to dashboard API");
    }
  };

  useEffect(() => {
    let ignore = false;
    async function init() {
      try {
        const res = await fetch("/api/evaluation/dashboard");
        if (res.status === 403) {
          if (!ignore) setIsForbidden(true);
          return;
        }
        if (!res.ok) throw new Error("Failed to load evaluation dashboard data");
        const json = await res.json();
        if (!ignore) setData(json);
      } catch (err) {
        if (!ignore) setErrorMsg(err instanceof Error ? err.message : "Error connecting to dashboard API");
      }
    }
    init();
    return () => {
      ignore = true;
    };
  }, []);

  const handleTriggerRun = async () => {
    setIsTriggering(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/evaluation/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runType: "full" }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Failed with status ${res.status}`);
      }
      await loadDashboardData();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to execute evaluation run");
    } finally {
      setIsTriggering(false);
    }
  };

  const handleViewReport = async (runId: string) => {
    try {
      const res = await fetch(`/api/evaluation/runs/${runId}`);
      if (!res.ok) throw new Error("Failed to fetch run details");
      const json = await res.json();

      interface RawEvalCase {
        statusMatch?: boolean;
        quoteValid?: boolean;
        fixtureName: string;
        checklistItem: string;
        expectedStatus: string;
        actualStatus?: string | null;
        expectedQuoteSubstring?: string | null;
        actualQuote?: string | null;
        failureReason?: string | null;
      }

      const failedCases: FailedCaseItem[] = (json.cases || [])
        .filter((c: RawEvalCase) => !c.statusMatch || !c.quoteValid)
        .map((c: RawEvalCase) => ({
          fixtureName: c.fixtureName,
          checklistItem: c.checklistItem,
          expectedStatus: c.expectedStatus,
          actualStatus: c.actualStatus,
          expectedQuoteSubstring: c.expectedQuoteSubstring,
          actualQuote: c.actualQuote,
          failureReason: c.failureReason,
        }));

      setSelectedRunReport({
        id: runId,
        markdown: json.reportMarkdown || "",
        failures: failedCases,
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to view report");
    }
  };

  if (isForbidden) {
    return (
      <div className="max-w-2xl mx-auto my-16 rounded-2xl border border-rose-200 bg-rose-50/50 p-8 text-center shadow-xs">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600 mb-4">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Admin Permissions Required</h2>
        <p className="mt-2 text-sm text-slate-600">
          The QA Evaluation Benchmark Dashboard is role-gated to administrators only. Please switch to an account with the{" "}
          <code className="rounded bg-rose-100 px-1.5 py-0.5 font-mono text-xs text-rose-800">admin</code> role.
        </p>
      </div>
    );
  }

  const latest = data?.latestRun;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              QA Evaluation Dashboard
            </h1>
            <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 border border-indigo-200">
              Gold Standard Benchmark
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Automated precision, recall, and quote-validity evaluation across 32 synthetic contract test cases.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={isTriggering}
            onClick={handleTriggerRun}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 transition"
          >
            {isTriggering ? (
              <>
                <Clock className="h-4 w-4 animate-spin" />
                Running Benchmark...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Trigger Evaluation Run
              </>
            )}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-lg bg-rose-50 border border-rose-200 p-4 text-sm text-rose-800 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-rose-500 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* KPI Cards Grid */}
      {latest ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricsCard
            title="Overall Pass Rate"
            value={`${(latest.passRate * 100).toFixed(1)}%`}
            target="≥ 90.0%"
            status={latest.passRate >= 0.9 ? "pass" : "warn"}
            subtitle={`${latest.passedCases} passed / ${latest.totalCases} cases`}
            icon={<Award className="h-4 w-4" />}
          />
          <MetricsCard
            title="F1 Score"
            value={(latest.f1Score * 100).toFixed(1)}
            target="≥ 90.0"
            status={latest.f1Score >= 0.9 ? "pass" : "warn"}
            subtitle={`Precision: ${(latest.precisionScore * 100).toFixed(1)}% • Recall: ${(latest.recallScore * 100).toFixed(1)}%`}
            icon={<BarChart3 className="h-4 w-4" />}
          />
          <MetricsCard
            title="Quote Validity Rate"
            value={`${(latest.quoteValidityRate * 100).toFixed(1)}%`}
            target="100.0%"
            status={latest.quoteValidityRate >= 0.95 ? "pass" : "fail"}
            subtitle="Deterministic verbatim quote matching"
            icon={<FileCheck className="h-4 w-4" />}
          />
          <MetricsCard
            title="Missing Clause Detection"
            value={`${(latest.missingClauseDetectionRate * 100).toFixed(1)}%`}
            target="≥ 90.0%"
            status={latest.missingClauseDetectionRate >= 0.9 ? "pass" : "warn"}
            subtitle="Absence coverage detection accuracy"
            icon={<CheckCircle2 className="h-4 w-4" />}
          />
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-8 text-center">
          <p className="text-sm text-slate-500 mb-3">No evaluation benchmark runs recorded yet.</p>
          <button
            onClick={handleTriggerRun}
            disabled={isTriggering}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500"
          >
            <Play className="h-3.5 w-3.5" />
            Run First Benchmark Now
          </button>
        </div>
      )}

      {/* Per-Category Performance Heatmap */}
      {latest?.detailedMetrics?.perCategory && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Per-Category Performance Breakdown</h3>
              <p className="text-xs text-slate-500">Benchmark results by individual checklist category</p>
            </div>
            <span className="text-xs font-mono text-slate-400">
              Run: {latest.id.slice(0, 8)}...
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/70 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-5 py-3 font-semibold">Checklist Item</th>
                  <th className="px-4 py-3 font-semibold text-center">True Pos</th>
                  <th className="px-4 py-3 font-semibold text-center">False Pos</th>
                  <th className="px-4 py-3 font-semibold text-center">False Neg</th>
                  <th className="px-4 py-3 font-semibold text-center">Precision</th>
                  <th className="px-4 py-3 font-semibold text-center">Recall</th>
                  <th className="px-4 py-3 font-semibold text-center">F1 Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Object.entries(latest.detailedMetrics.perCategory).map(([catKey, metrics]) => {
                  const label = CHECKLIST_LABELS[catKey as keyof typeof CHECKLIST_LABELS] || catKey;
                  return (
                    <tr key={catKey} className="hover:bg-slate-50/60 transition">
                      <td className="px-5 py-3 font-medium text-slate-900">{label}</td>
                      <td className="px-4 py-3 text-center">{metrics.truePositives}</td>
                      <td className="px-4 py-3 text-center">{metrics.falsePositives}</td>
                      <td className="px-4 py-3 text-center">{metrics.falseNegatives}</td>
                      <td className="px-4 py-3 text-center font-mono">{(metrics.precision * 100).toFixed(0)}%</td>
                      <td className="px-4 py-3 text-center font-mono">{(metrics.recall * 100).toFixed(0)}%</td>
                      <td className="px-4 py-3 text-center font-semibold text-indigo-600 font-mono">
                        {(metrics.f1 * 100).toFixed(0)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Historical Evaluation Runs Table */}
      {data?.recentRuns && data.recentRuns.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Historical Evaluation Runs</h3>
            <span className="text-xs text-slate-500">Total Runs: {data.totalRuns}</span>
          </div>

          <div className="divide-y divide-slate-100">
            {data.recentRuns.map((r) => (
              <div
                key={r.id}
                className="px-5 py-3 flex items-center justify-between hover:bg-slate-50 transition"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-slate-900">
                      Run {r.id.slice(0, 8)}...
                    </span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 uppercase">
                      {r.runType}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {new Date(r.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Model: {r.modelId} • Duration: {r.durationMs ? `${r.durationMs}ms` : "N/A"}
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-xs font-bold text-slate-900">
                      Pass: {(r.passRate * 100).toFixed(1)}%
                    </p>
                    <p className="text-[10px] text-slate-400 font-mono">
                      F1: {(r.f1Score * 100).toFixed(1)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleViewReport(r.id)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-indigo-400 hover:text-indigo-600 transition shadow-2xs"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>View Report</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Report Modal / Slide-over */}
      {selectedRunReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-4xl max-h-[85vh] rounded-2xl bg-white shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Evaluation Report — {selectedRunReport.id.slice(0, 8)}...
                </h3>
                <p className="text-xs text-slate-500">Benchmark results and diagnostics</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRunReport(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Failure diagnostics */}
              <FailureDetails failures={selectedRunReport.failures} />

              {/* Raw Markdown Report */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  Markdown Report
                </h4>
                <pre className="whitespace-pre-wrap text-xs text-slate-700 font-mono bg-white p-4 rounded-lg border border-slate-200/60 overflow-x-auto leading-relaxed">
                  {selectedRunReport.markdown}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
