"use client";

import { useState, useEffect } from "react";
import { PlusCircle, FileText, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
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
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Total Contracts
            </span>
            <FileText className="h-4 w-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{totalCount}</p>
          <span className="text-xs text-slate-400 mt-1 inline-block">
            Agreements stored
          </span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Ready for Review
            </span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{readyCount}</p>
          <span className="text-xs text-slate-400 mt-1 inline-block">
            Vectors indexed
          </span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              In Processing
            </span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{inProcessingCount}</p>
          <span className="text-xs text-slate-400 mt-1 inline-block">
            Extracting & chunking
          </span>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Failed / Retried
            </span>
            <AlertTriangle className="h-4 w-4 text-rose-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{failedCount}</p>
          <span className="text-xs text-slate-400 mt-1 inline-block">
            Validation errors
          </span>
        </div>
      </div>

      {/* Contract List */}
      <ContractList
        contracts={contracts}
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
