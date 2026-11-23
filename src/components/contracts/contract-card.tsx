"use client";

import Link from "next/link";
import { FileText, Trash2, ArrowUpRight } from "lucide-react";
import { ProcessingIndicator } from "./processing-indicator";
import type { Contract } from "@/lib/db/schema";

interface ContractCardProps {
  contract: Contract;
  onDeleteClick: (contract: Contract) => void;
}

function formatBytes(bytes: number, decimals = 1) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

export function ContractCard({ contract, onDeleteClick }: ContractCardProps) {
  const formattedDate = new Date(contract.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-white rounded-xl border border-slate-200 shadow-sm hover:border-slate-300 transition group">
      <div className="flex items-start gap-4">
        <div className="h-10 w-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
          <FileText className="h-5 w-5" />
        </div>
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h4 className="font-semibold text-slate-900 group-hover:text-indigo-600 transition">
              {contract.originalFilename}
            </h4>
            <ProcessingIndicator status={contract.status} />
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500 mt-1.5">
            <span>{formatBytes(contract.fileSizeBytes)}</span>
            <span>•</span>
            <span className="uppercase">{contract.fileType}</span>
            <span>•</span>
            <span>Uploaded {formattedDate}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
        <Link
          href={`/contracts/${contract.id}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition"
        >
          View Details
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
        <button
          type="button"
          onClick={() => onDeleteClick(contract)}
          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
          title="Delete contract"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
