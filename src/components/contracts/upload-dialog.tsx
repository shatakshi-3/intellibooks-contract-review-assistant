"use client";

import { useState, useRef } from "react";
import { upload } from "@vercel/blob/client";
import { UploadCloud, FileText, X, AlertCircle, Loader2 } from "lucide-react";
import { ALLOWED_EXTENSIONS, MAX_FILE_SIZE_BYTES } from "@/lib/validation/contracts";
import { isDemoMode } from "@/demo/config";

interface UploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: () => void;
}

export function UploadDialog({ isOpen, onClose, onUploadSuccess }: UploadDialogProps) {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  function validateSelectedFile(selected: File): boolean {
    setError(null);

    const ext = selected.name.split(".").pop()?.toLowerCase();
    if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
      setError(`Unsupported file format. Please upload a ${ALLOWED_EXTENSIONS.join(", ").toUpperCase()} document.`);
      return false;
    }

    if (selected.size > MAX_FILE_SIZE_BYTES) {
      setError(`File size (${(selected.size / (1024 * 1024)).toFixed(1)} MB) exceeds the 20 MB limit.`);
      return false;
    }

    if (selected.size === 0) {
      setError("File cannot be empty.");
      return false;
    }

    return true;
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (validateSelectedFile(selected)) {
        setFile(selected);
      }
    }
  }

  function handleDrag(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const dropped = e.dataTransfer.files[0];
      if (validateSelectedFile(dropped)) {
        setFile(dropped);
      }
    }
  }

  async function handleStartUpload() {
    if (!file) return;

    setIsUploading(true);
    setError(null);
    setProgress(5);
    setStatusMessage("Creating contract record...");

    try {
      const ext = file.name.split(".").pop()?.toLowerCase() as "pdf" | "docx" | "txt";
      const contentType = file.type || (ext === "pdf" ? "application/pdf" : ext === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "text/plain");

      // Step 1: Create pending record in Neon database
      const initRes = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          fileSize: file.size,
          fileType: ext,
          contentType,
        }),
      });

      if (!initRes.ok) {
        const errorData = await initRes.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to initialize contract record");
      }

      const { contract } = await initRes.json();
      setProgress(20);
      if (isDemoMode()) {
        setProgress(50);
        setStatusMessage("Extracting text and chunking document sections...");
        await new Promise((r) => setTimeout(r, 400));
        setProgress(85);
        await fetch(`/api/contracts/${contract.id}/process`, { method: "POST" });
        setProgress(100);
        setStatusMessage("Contract uploaded and indexed successfully!");
        setTimeout(() => {
          setIsUploading(false);
          setFile(null);
          onUploadSuccess();
          onClose();
        }, 700);
        return;
      }

      setStatusMessage("Uploading directly to private Blob storage...");

      // Step 2: Upload directly from browser to Vercel Blob store
      await upload(file.name, file, {
        access: "public", // Will be secured by private access in Vercel
        handleUploadUrl: "/api/upload",
        clientPayload: JSON.stringify({
          contractId: contract.id,
          filename: file.name,
          fileSize: file.size,
          fileType: ext,
          contentType,
        }),
        onUploadProgress: (progressEvent) => {
          // Map browser upload progress from 20% to 90%
          const percentage = Math.round(20 + progressEvent.percentage * 0.7);
          setProgress(percentage);
        },
      });

      setProgress(100);
      setStatusMessage("Upload verified successfully!");

      setTimeout(() => {
        setIsUploading(false);
        setFile(null);
        onUploadSuccess();
        onClose();
      }, 800);
    } catch (err) {
      setIsUploading(false);
      setProgress(0);
      setStatusMessage("");
      setError(err instanceof Error ? err.message : "Failed to upload file. Please try again.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <UploadCloud className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-base">Upload Agreement</h3>
              <p className="text-xs text-slate-500">PDF, DOCX, or TXT documents up to 20 MB</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {!file ? (
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
              dragActive
                ? "border-indigo-600 bg-indigo-50/50"
                : "border-slate-300 hover:border-indigo-400 hover:bg-slate-50/50"
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.docx,.txt"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500 mb-3">
              <UploadCloud className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium text-slate-800">
              Drag and drop your document here, or <span className="text-indigo-600 underline">browse</span>
            </p>
            <p className="text-xs text-slate-400 mt-1">Supports PDF, Word (DOCX), and Plain Text</p>
            <div className="mt-4 pt-3 border-t border-slate-200/80">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const sampleFile = new File(
                    ["MASTER SERVICES AGREEMENT\n\nThis Master Services Agreement is entered into as of January 15, 2026 by and between CloudScale Technologies, Inc. and Acme Global Enterprises, LLC."],
                    "Master_Services_Agreement_CloudScale.pdf",
                    { type: "application/pdf" }
                  );
                  setFile(sampleFile);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50/80 hover:bg-indigo-100/80 px-3 py-1.5 rounded-lg transition"
              >
                <span>📄 Use Sample Contract (CloudScale MSA)</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50/50">
              <div className="flex items-center gap-3 overflow-hidden">
                <FileText className="h-6 w-6 text-indigo-600 shrink-0" />
                <div className="truncate">
                  <p className="text-sm font-medium text-slate-900 truncate">{file.name}</p>
                  <p className="text-xs text-slate-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                </div>
              </div>
              {!isUploading && (
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="p-1 text-slate-400 hover:text-rose-600 transition"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {isUploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-slate-600 font-medium">
                  <span>{statusMessage}</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 mt-6 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleStartUpload}
            disabled={!file || isUploading}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition disabled:opacity-50"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              "Upload Contract"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
