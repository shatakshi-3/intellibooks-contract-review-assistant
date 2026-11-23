import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { isDemoMode } from "@/demo/config";
import { DemoAuthProvider } from "@/demo/auth";
import { DemoBanner } from "@/components/demo/demo-banner";
import "./globals.css";

export const metadata: Metadata = {
  title: "IntelliBooks — Contract Intelligence & Review",
  description:
    "AI-powered contract review, clause verification, and semantic search.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const demoActive = isDemoMode();

  const content = (
    <html lang="en" className="h-full antialiased font-sans">
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {demoActive && <DemoBanner />}
        {children}
      </body>
    </html>
  );

  if (demoActive) {
    return <DemoAuthProvider>{content}</DemoAuthProvider>;
  }

  return <ClerkProvider>{content}</ClerkProvider>;
}


