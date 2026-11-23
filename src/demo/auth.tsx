"use client";

import React, { createContext, useContext } from "react";
import { DEMO_USER } from "./config";

interface DemoAuthContextType {
  isLoaded: boolean;
  isSignedIn: boolean;
  userId: string;
  user: typeof DEMO_USER;
}

const DemoAuthContext = createContext<DemoAuthContextType>({
  isLoaded: true,
  isSignedIn: true,
  userId: DEMO_USER.id,
  user: DEMO_USER,
});

export function DemoAuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <DemoAuthContext.Provider
      value={{
        isLoaded: true,
        isSignedIn: true,
        userId: DEMO_USER.id,
        user: DEMO_USER,
      }}
    >
      {children}
    </DemoAuthContext.Provider>
  );
}

export function useDemoAuth() {
  return useContext(DemoAuthContext);
}

export function DemoUserBadge() {
  return (
    <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm">
      <div className="h-6 w-6 rounded-full bg-indigo-600 flex items-center justify-center text-white text-[10px] font-bold">
        DC
      </div>
      <span className="hidden sm:inline">Demo Counsel</span>
      <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">
        Admin
      </span>
    </div>
  );
}
