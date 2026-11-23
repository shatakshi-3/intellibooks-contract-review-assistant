"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, ShieldAlert, BarChart3, Settings, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Contracts", href: "/dashboard", icon: FileText },
  { name: "Evaluation & QA", href: "/evaluation", icon: BarChart3 },
];

const secondaryNavigation = [
  { name: "Settings", href: "#", icon: Settings },
  { name: "Support", href: "#", icon: HelpCircle },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-slate-200 bg-slate-50/50 flex flex-col justify-between shrink-0 min-h-[calc(100vh-4rem)]">
      <div className="p-4 space-y-6">
        <div>
          <p className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Workspace
          </p>
          <nav className="space-y-1">
            {navigation.map((item) => {
              const isActive =
                item.href === "/dashboard"
                  ? pathname === "/dashboard" || pathname.startsWith("/contracts")
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                    isActive
                      ? "bg-indigo-50 text-indigo-700 font-semibold"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
                  )}
                >
                  <item.icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      isActive ? "text-indigo-600" : "text-slate-400"
                    )}
                  />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
          <div className="flex items-center gap-2 text-indigo-900 text-xs font-semibold">
            <ShieldAlert className="h-4 w-4 text-indigo-600" />
            AI Review Pipeline
          </div>
          <p className="text-xs text-indigo-700/90 mt-1.5 leading-relaxed">
            Automated verification cross-checks 8 compliance clauses with zero hallucinations.
          </p>
        </div>
      </div>

      <div className="p-4 border-t border-slate-200 space-y-1">
        {secondaryNavigation.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-500 rounded-lg hover:text-slate-900 hover:bg-slate-100/80 transition-colors"
          >
            <item.icon className="h-4 w-4 text-slate-400" />
            {item.name}
          </Link>
        ))}
        <div className="pt-2 px-3">
          <p className="text-[11px] text-slate-400 font-mono">
            IntelliBooks v0.1.0 (Phase 2)
          </p>
        </div>
      </div>
    </aside>
  );
}
