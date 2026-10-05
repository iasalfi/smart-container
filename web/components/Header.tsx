"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useApp } from "@/app/providers";
import type { Persona } from "@/lib/types";

const PERSONAS: Persona[] = ["operator", "quality", "security", "customer"];

const ICONS: Record<string, ReactNode> = {
  fleet: <path d="M3 7l9-4 9 4v10l-9 4-9-4V7zm9-1.8L6 8l6 2.7L18 8l-6-2.8zM5 9.6v6.1l6 2.7v-6.1L5 9.6zm14 0l-6 2.7v6.1l6-2.7V9.6z" />,
  alerts: <path d="M12 3a6 6 0 00-6 6v3.6L4.3 15A1 1 0 005 16.700h14a1 1 0 00.7-1.700L18 12.600V9a6 6 0 00-6-6zm-2 15a2 2 0 004 0h-4z" />,
  operations: <path d="M4 5h16v2H4V5zm0 6h10v2H4v-2zm0 6h16v2H4v-2zm13-7.500l4 2.500-4 2.500V9.500z" />,
  admin: <path d="M12 8.500A3.500 3.500 0 1012 15.500 3.500 3.500 0 0012 8.500zm8.500 4.700l1.600 1.200-1.600 2.800-1.900-.6a7 7 0 01-1.600.9L16.700 19.500h-3.200l-.3-2a7 7 0 01-1.600-.9l-1.900.6-1.600-2.800 1.600-1.200a7 7 0 010-1.800L7.700 10.200l1.600-2.800 1.900.6a7 7 0 011.600-.9l.3-2h3.200l.3 2a7 7 0 011.600.9l1.900-.6 1.600 2.800-1.600 1.200c.1.600.1 1.200 0 1.800z" />,
};

function Icon({ name }: { name: string }) {
  return <svg className="nav-ic" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false" fill="currentColor">{ICONS[name]}</svg>;
}

export function Sidebar() {
  const { t, persona } = useApp();
  const path = usePathname() ?? "/";
  const nav = [
    { icon: "fleet", href: "/", label: t("nav_fleet"), match: (p: string) => p === "/" || p.startsWith("/container") || p.startsWith("/route") || p.startsWith("/health") || p.startsWith("/replay") || p.startsWith("/modules") || p.startsWith("/report") },
    { icon: "alerts", href: "/alerts/", label: t("nav_alerts"), match: (p: string) => p.startsWith("/alerts") },
    ...(persona === "customer" ? [] : [{ icon: "operations", href: "/operations/", label: t("nav_operations"), match: (p: string) => p.startsWith("/operations") }]),
    ...(persona === "customer" ? [] : [{ icon: "admin", href: "/admin/", label: t("nav_admin"), match: (p: string) => p.startsWith("/admin") }]),
  ];
  return (
    <aside className="sidebar">
      <a className="skip" href="#main">{t("skip")}</a>
      <Link href="/" className="brand" aria-label={t("app_name")}>
        <span className="brand-mark" aria-hidden="true" />
        <span>{t("app_name")}</span>
      </Link>
      <nav aria-label="Main">
        {nav.map((n) => (
          <Link key={n.href} href={n.href} aria-current={n.match(path) ? "page" : undefined}><Icon name={n.icon} /><span>{n.label}</span></Link>
        ))}
      </nav>
    </aside>
  );
}

export function Header() {
  const { t, lang, setLang, persona, setPersona } = useApp();
  return (
    <header className="topbar">
      <span className="badge" data-testid="synthetic-badge">{t("synthetic")}</span>
      <div className="controls">
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
