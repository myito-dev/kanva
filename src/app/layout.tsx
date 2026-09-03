import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { NavBar } from "@/components/NavBar";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Kanva",
  description: "Carga un archivo, obtén un perfil y análisis de tus datos, y compón un tablero exportable a PDF.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={cn("h-full", "antialiased", "font-sans", inter.variable)}>
      <body className="min-h-full bg-page text-ink">
        <NavBar />
        {children}
      </body>
    </html>
  );
}
