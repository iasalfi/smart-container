"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "@/app/providers";
import type { Persona } from "@/lib/types";

const PERSONAS: Persona[] = ["operator", "quality", "security", "customer"];

export function Header() {
  const { t, lang, setLang, persona, setPersona } = useApp();
  const path = usePathname() ?? "/";
  const nav = [
    { href: "/", label: t("nav_fleet"), match: (p: string) => p === "/" || p.startsWith("/container") || p.startsWith("/route") || p.startsWith("/health") || p.startsWith("/replay") || p.startsWith("/modules") || p.startsWith("/report") },
    { href: "/alerts/", label: t("nav_alerts"), match: (p: string) => p.startsWith("/alerts") },
    ...(persona === "customer" ? [] : [{ href: "/admin/", label: t("nav_admin"), match: (p: string) => p.startsWith("/admin") }]),
  ];
  return (
    <header className="topbar">
      <a className="skip" href="#main">{t("skip")}</a>
      <Link href="/" className="brand" aria-label={t("app_name")}>
        <span className="brand-mark" aria-hidden="true" />
        <span>{t("app_name")}</span>
      </Link>
      <nav aria-label="Main">
        {nav.map((n) => (
          <Link key={n.href} href={n.href} aria-current={n.match(path) ? "page" : undefined}>{n.label}</Link>
        ))}
      </nav>
      <div className="controls">
        <span className="badge" data-testid="synthetic-badge">{t("synthetic")}</span>
        <label className="persona">
          <span>{t("persona")}</span>
          <select value={persona} onChange={(e) => setPersona(e.target.value as Persona)} data-testid="persona-select">
            {PERSONAS.map((p) => (<option key={p} value={p}>{t(`persona_${p}` as const)}</option>))}
          </select>
        </label>
        <div className="lang" role="group" aria-label={t("language")}>
          <button type="button" aria-pressed={lang === "en"} onClick={() => setLang("en")} data-testid="lang-en">EN</button>
          <button type="button" aria-pressed={lang === "ar"} onClick={() => setLang("ar")} data-testid="lang-ar">AR</button>
        </div>
      </div>
    </header>
  );
}
