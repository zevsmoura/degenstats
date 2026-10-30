import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Degenstats",
  description: "Read-only Solana wallet trading analytics.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
