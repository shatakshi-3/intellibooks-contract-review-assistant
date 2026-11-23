import type { ReactNode } from "react";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

interface MetricsCardProps {
  title: string;
  value: string | number;
  target?: string;
  status?: "pass" | "warn" | "fail" | "neutral";
  subtitle?: string;
  icon?: ReactNode;
}

export function MetricsCard({
  title,
  value,
  target,
  status = "neutral",
  subtitle,
  icon,
}: MetricsCardProps) {
  const statusStyles = {
    pass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warn: "bg-amber-50 text-amber-700 border-amber-200",
    fail: "bg-rose-50 text-rose-700 border-rose-200",
    neutral: "bg-slate-50 text-slate-700 border-slate-200",
  };

  const statusIcons = {
    pass: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />,
    warn: <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />,
    fail: <XCircle className="h-3.5 w-3.5 text-rose-600" />,
    neutral: null,
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition hover:shadow-sm">
      <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-2">
        <span>{title}</span>
        {icon && <div className="text-slate-400">{icon}</div>}
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold tracking-tight text-slate-900">{value}</span>
        {status !== "neutral" && (
          <span
            className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold border ${statusStyles[status]}`}
          >
            {statusIcons[status]}
            {status.toUpperCase()}
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
        <span>{subtitle || "Evaluated against benchmark"}</span>
        {target && <span className="font-mono">Target: {target}</span>}
      </div>
    </div>
  );
}
