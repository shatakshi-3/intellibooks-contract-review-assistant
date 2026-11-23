"use client";

import { AlertTriangle, Loader2 } from "lucide-react";

interface DeleteDialogProps {
  isOpen: boolean;
  filename: string;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteDialog({
  isOpen,
  filename,
  isDeleting,
  onConfirm,
  onCancel,
}: DeleteDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-200">
        <div className="flex items-center gap-3 text-rose-600 mb-4">
          <div className="h-10 w-10 rounded-full bg-rose-100 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">Delete Contract</h3>
        </div>

        <p className="text-sm text-slate-600 mb-6 leading-relaxed">
          Are you sure you want to delete <span className="font-semibold text-slate-900">&ldquo;{filename}&rdquo;</span>?
          This will permanently delete the agreement, its stored file in private storage, and all associated extracted clauses and reviews.
        </p>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-500 focus-visible:outline-rose-600 transition disabled:opacity-50"
          >
            {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
