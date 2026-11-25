import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AUBM PCheck — Fiches Todo PC",
  description:
    "Fiches de préparation PC avec checklist, historique SQLite, export PDF et impression.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
