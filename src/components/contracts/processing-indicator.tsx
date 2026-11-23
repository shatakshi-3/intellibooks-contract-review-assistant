import { CheckCircle2, Clock, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProcessingIndicatorProps {
  status: string;
  className?: string;
}

export function ProcessingIndicator({ status, className }: ProcessingIndicatorProps) {
  switch (status) {
    case "ready":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
            className
          )}
        >
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          Ready
        </span>
      );

    case "failed":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-600/20",
            className
          )}
        >
          <AlertCircle className="h-3.5 w-3.5 text-rose-600" />
          Failed
        </span>
      );

    case "pending_upload":
    case "uploading":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20",
            className
          )}
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-600" />
          Uploading
        </span>
      );

    case "uploaded":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20",
            className
          )}
        >
          <Clock className="h-3.5 w-3.5 text-blue-600" />
          Uploaded
        </span>
      );

    case "processing":
    case "extracting":
    case "chunking":
    case "embedding":
    default:
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-600/20",
            className
          )}
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600" />
          Processing
        </span>
      );
  }
}
