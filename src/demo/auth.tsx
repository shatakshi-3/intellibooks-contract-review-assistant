"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { DEMO_USER_1, DEMO_USER_2, DEMO_USERS, type DemoUser } from "./config";

interface DemoAuthContextType {
  isLoaded: boolean;
  isSignedIn: boolean;
  userId: string;
  user: DemoUser;
  switchUser: (targetId: string) => Promise<void>;
  isSwitching: boolean;
}

const DemoAuthContext = createContext<DemoAuthContextType>({
  isLoaded: true,
  isSignedIn: true,
  userId: DEMO_USER_1.id,
  user: DEMO_USER_1,
  switchUser: async () => {},
  isSwitching: false,
});

export function DemoAuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<DemoUser>(DEMO_USER_1);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);

  // Sync active demo identity from server cookie
  useEffect(() => {
    let ignore = false;
    fetch("/api/demo/user")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!ignore && data?.data?.activeUser) {
          setCurrentUser(data.data.activeUser);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!ignore) setIsLoaded(true);
      });

    return () => {
      ignore = true;
    };
  }, []);

  const switchUser = useCallback(async (targetId: string) => {
    setIsSwitching(true);
    try {
      const res = await fetch("/api/demo/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: targetId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.activeUser) {
          setCurrentUser(data.activeUser);
        }
        // Force full page refresh to re-evaluate server-side queries under the new tenant
        window.location.reload();
      }
    } catch (err) {
      console.error("Failed to switch demo user:", err);
    } finally {
      setIsSwitching(false);
    }
  }, []);

  return (
    <DemoAuthContext.Provider
      value={{
        isLoaded,
        isSignedIn: true,
        userId: currentUser.id,
        user: currentUser,
        switchUser,
        isSwitching,
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
  const { user, switchUser, isSwitching } = useDemoAuth();
  const otherUser = user.id === DEMO_USER_1.id ? DEMO_USER_2 : DEMO_USER_1;

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2);

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs shadow-sm">
        <div className="h-6 w-6 rounded-full bg-indigo-600 flex items-center justify-center text-white text-[10px] font-bold">
          {initials}
        </div>
        <div className="text-left hidden sm:block">
          <div className="font-semibold text-slate-800 leading-none">{user.name}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">{user.tenantLabel}</div>
        </div>
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
            user.role === "admin"
              ? "bg-indigo-50 text-indigo-700"
              : "bg-amber-50 text-amber-700"
          }`}
        >
          {user.role === "admin" ? "Admin" : "Reviewer"}
        </span>
      </div>

      <button
        type="button"
        onClick={() => switchUser(otherUser.id)}
        disabled={isSwitching}
        title={`Switch to ${otherUser.name}`}
        className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2 py-1 rounded border border-indigo-200 transition disabled:opacity-50"
      >
        {isSwitching ? "Switching..." : `Switch to ${otherUser.name.split(" ")[0]}`}
      </button>
    </div>
  );
}
