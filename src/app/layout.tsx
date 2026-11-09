import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AdminNamePicker } from "@/components/admin-name-picker";
import { AppShell } from "@/components/app-shell";
import { getAdminName } from "@/lib/adminName";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gestão de Frota",
  description: "Dashboard de gestão de frota e uso pessoal",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const adminName = await getAdminName();

  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-zinc-50 text-zinc-900">
        <AppShell adminName={adminName} adminNamePicker={<AdminNamePicker />}>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
