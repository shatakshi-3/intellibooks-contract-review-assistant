import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { DemoProcessingBanner } from "@/components/demo/demo-banner";
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
  return (
    <ClerkProvider>
      <html lang="en" className="h-full antialiased font-sans">
        <body className="min-h-full flex flex-col bg-background text-foreground">
          <DemoProcessingBanner />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
