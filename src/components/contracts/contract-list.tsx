"use client";

import { ContractCard } from "./contract-card";
import { FileText, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import type { Contract } from "@/lib/db/schema";

interface ContractListProps {
  contracts: Contract[];
  isLoading: boolean;
  onDeleteClick: (contract: Contract) => void;
  onUploadClick: () => void;
  pagination?: {
    page: number;
    totalPages: number;
    total: number;
  };
  onPageChange?: (newPage: number) => void;
}

export function ContractList({
  contracts,
  isLoading,
  onDeleteClick,
  onUploadClick,
  pagination,
  onPageChange,
}: ContractListProps) {
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-16 flex flex-col items-center justify-center text-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mb-3" />
        <p className="text-sm font-medium text-slate-600">Loading contracts...</p>
      </div>
    );
  }

  if (contracts.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-12 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <FileText className="h-6 w-6" />
        </div>
        <h3 className="mt-4 text-base font-semibold text-slate-900">
          No contracts uploaded yet
        </h3>
        <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
          Upload PDF, DOCX, or TXT agreements (up to 20 MB) to inspect verified clauses and automated compliance findings.
        </p>
        <div className="mt-6">
          <button
            type="button"
            onClick={onUploadClick}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition"
          >
            Upload First Contract
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {contracts.map((contract) => (
          <ContractCard
            key={contract.id}
            contract={contract}
            onDeleteClick={onDeleteClick}
          />
        ))}
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-200 pt-4 px-2">
          <p className="text-xs text-slate-500">
            Showing page <span className="font-semibold text-slate-700">{pagination.page}</span> of{" "}
            <span className="font-semibold text-slate-700">{pagination.totalPages}</span> ({pagination.total} total)
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={pagination.page <= 1}
              onClick={() => onPageChange?.(pagination.page - 1)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Previous
            </button>
            <button
              type="button"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => onPageChange?.(pagination.page + 1)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
