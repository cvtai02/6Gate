import type { Metadata } from "next";
import "./globals.css";
import { AppSidebar } from "@/components/app-sidebar";

export const metadata: Metadata = {
  title: "6Gate — Social Gateway",
  description: "Local social media gateway for posting videos across platforms",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-screen flex bg-[var(--background)] text-[var(--foreground)]">
        <AppSidebar />
        <main className="flex-1 overflow-auto">{children}</main>
      </body>
    </html>
  );
}
