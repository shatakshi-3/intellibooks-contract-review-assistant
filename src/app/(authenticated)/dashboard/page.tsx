"use client";

import { useState, useEffect, useMemo } from "react";
import {
  PlusCircle,
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Search,
  RefreshCw,
} from "lucide-react";
import { ContractList } from "@/components/contracts/contract-list";
import { UploadDialog } from "@/components/contracts/upload-dialog";
import { DeleteDialog } from "@/components/contracts/delete-dialog";
import type { Contract } from "@/lib/db/schema";

export default function DashboardPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Contract | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "ready" | "processing" | "failed">("all");
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });

  useEffect(() => {
    let ignore = false;

    fetch(`/api/contracts?page=${pagination.page}&limit=20`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!ignore && json) {
          setContracts(json.data || []);
          if (json.pagination) {
            setPagination(json.pagination);
          }
        }
      })
      .catch((error) => {
        console.error("Error fetching contracts:", error);
      })
      .finally(() => {
        if (!ignore) {
          setIsLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [pagination.page, refreshTrigger]);

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/contracts/${deleteTarget.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setDeleteTarget(null);
        setRefreshTrigger((prev) => prev + 1);
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to delete contract");
      }
    } catch {
      alert("Network error while deleting contract");
    } finally {
      setIsDeleting(false);
    }
  }

  // Calculate live metrics
  const totalCount = pagination.total || contracts.length;
  const readyCount = contracts.filter((c) => c.status === "ready").length;
  const inProcessingCount = contracts.filter((c) =>
    ["pending_upload", "uploading", "uploaded", "processing", "extracting", "chunking", "embedding"].includes(c.status)
  ).length;
  const failedCount = contracts.filter((c) => c.status === "failed").length;

  // Filtered contracts based on search and status tab
  const filteredContracts = useMemo(() => {
    return contracts.filter((c) => {
      // 1. Search filter
      const matchesSearch =
        !searchQuery ||
        c.originalFilename.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.id.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      // 2. Status filter
      if (statusFilter === "all") return true;
      if (statusFilter === "ready") return c.status === "ready";
      if (statusFilter === "processing") {
        return ["pending_upload", "uploading", "uploaded", "processing", "extracting", "chunking", "embedding"].includes(c.status);
      }
      if (statusFilter === "failed") return c.status === "failed";
      return true;
    });
  }, [contracts, searchQuery, statusFilter]);

  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Contract Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage legal agreements, track processing pipelines, and inspect compliance audits.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setRefreshTrigger((prev) => prev + 1)}
            title="Refresh contracts"
            className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setIsUploadOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition"
          >
            <PlusCircle className="h-4 w-4" />
            Upload Contract
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => setStatusFilter("all")}
          className={`bg-white p-5 rounded-xl border transition cursor-pointer shadow-xs ${
            statusFilter === "all" ? "border-indigo-500 ring-2 ring-indigo-500/20" : "border-slate-200 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Contracts
            </span>
            <div className="h-8 w-8 rounded-lg bg-slate-50 text-slate-600 flex items-center justify-center">
              <FileText className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{totalCount}</p>
          <span className="text-xs text-slate-400 mt-1 inline-block">
            All user agreements
          </span>
        </div>

        <div
          onClick={() => setStatusFilter("ready")}
          className={`bg-white p-5 rounded-xl border transition cursor-pointer shadow-xs ${
            statusFilter === "ready" ? "border-emerald-500 ring-2 ring-emerald-500/20" : "border-slate-200 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Ready for Review
            </span>
            <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{readyCount}</p>
          <span className="text-xs text-slate-400 mt-1 inline-block">
            Indexed with pgvector
          </span>
        </div>

        <div
          onClick={() => setStatusFilter("processing")}
          className={`bg-white p-5 rounded-xl border transition cursor-pointer shadow-xs ${
            statusFilter === "processing" ? "border-amber-500 ring-2 ring-amber-500/20" : "border-slate-200 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              In Processing
            </span>
            <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{inProcessingCount}</p>
          <span className="text-xs text-slate-400 mt-1 inline-block">
            Extracting & chunking
          </span>
        </div>

        <div
          onClick={() => setStatusFilter("failed")}
          className={`bg-white p-5 rounded-xl border transition cursor-pointer shadow-xs ${
            statusFilter === "failed" ? "border-rose-500 ring-2 ring-rose-500/20" : "border-slate-200 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Failed / Retried
            </span>
            <div className="h-8 w-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{failedCount}</p>
          <span className="text-xs text-slate-400 mt-1 inline-block">
            Validation errors
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search contracts by name or ID..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50/50 text-slate-900 focus:outline-hidden focus:border-indigo-500 focus:bg-white transition"
          />
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-center overflow-x-auto w-full sm:w-auto">
          {(
            [
              { id: "all", label: "All", count: totalCount },
              { id: "ready", label: "Ready", count: readyCount },
              { id: "processing", label: "Processing", count: inProcessingCount },
              { id: "failed", label: "Failed", count: failedCount },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 ${
                statusFilter === tab.id
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
      </div>

      {/* Contract List */}
      <ContractList
        contracts={filteredContracts}
        isLoading={isLoading}
        onDeleteClick={(contract) => setDeleteTarget(contract)}
        onUploadClick={() => setIsUploadOpen(true)}
        pagination={pagination}
        onPageChange={(p) => setPagination((prev) => ({ ...prev, page: p }))}
      />

      {/* Modals */}
      <UploadDialog
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadSuccess={() => setRefreshTrigger((prev) => prev + 1)}
      />

      <DeleteDialog
        isOpen={!!deleteTarget}
        filename={deleteTarget?.originalFilename || ""}
        isDeleting={isDeleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
