"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { useDataset } from "@/lib/datasetStore";

const LINKS = [
  { href: "/", label: "Análisis" },
  { href: "/tablero", label: "Tablero" },
];

export function NavBar() {
  const pathname = usePathname();
  const { result } = useDataset();

  if (!result) return null;

  const sectionLinks = [
    result.analysis.kpis.length > 0 || result.analysis.insights.length > 0 ? { href: "#hallazgos", label: "Insights" } : null,
    result.analysis.charts.length > 0 ? { href: "#graficas", label: "Gráficas" } : null,
    { href: "#columnas", label: "Columnas detectadas" },
    { href: "#vista-previa", label: "Vista previa" },
  ].filter((l): l is { href: string; label: string } => l !== null);

  return (
    <header className="sticky top-0 z-10 border-b border-hairline bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-2 px-4 py-3 sm:px-6">
        <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center">
          <Link href="/" className="justify-self-start text-sm font-bold tracking-wide text-accent">
            KANVA
          </Link>
          <nav className="flex items-center gap-1 justify-self-center rounded-full bg-page p-1">
            {LINKS.map((link) => {
              const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
              return (
                <Link key={link.href} href={link.href} className="relative px-3 py-1.5 text-sm font-medium">
                  {active && (
                    <motion.span
                      layoutId="nav-active"
                      className="absolute inset-0 rounded-full bg-accent"
                      transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    />
                  )}
                  <span className={`relative ${active ? "text-accent-ink" : "text-ink-secondary"}`}>{link.label}</span>
                </Link>
              );
            })}
          </nav>
          <span className="justify-self-end" />
        </div>

        {pathname === "/" && sectionLinks.length > 0 && (
          <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            {sectionLinks.map((link) => (
              <a key={link.href} href={link.href} className="text-xs font-medium text-ink-muted hover:text-accent">
                {link.label}
              </a>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}
