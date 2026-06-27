import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { LanguageProvider } from "@/components/LanguageProvider";

export const metadata: Metadata = {
  title: "Kumbh Setu — Missing Persons Management",
  description:
    "Missing Persons Management System for the Kumbh Mela. Intake, AI matching, and reunification.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <LanguageProvider>
          <Navbar />
          <main className="mx-auto w-full max-w-6xl px-4 py-6">{children}</main>
        </LanguageProvider>
      </body>
    </html>
  );
}
