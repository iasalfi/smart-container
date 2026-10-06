"use client";
import { useEffect } from "react";
import { arText } from "./arlocal";
import type { Lang } from "./types";

const ATTRS = ["placeholder", "aria-label", "title", "alt"];
const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA"]);
const TITLE_AR = "عرض تجريبي لمراقبة الحاويات الذكية";

/**
 * In Arabic, everything the app prints reads in Arabic, numbers included. The dictionaries cover the words;
 * this covers what comes from data: digits and separators, units, plates, names of places, companies and people.
 * It converts text on screen and keeps doing so as the page changes, and puts the original back when the language changes back.
 */
export function useArabicDom(lang: Lang) {
  useEffect(() => {
    if (lang !== "ar") return;
    const texts = new Map<Text, { o: string; c: string }>();
    const attrs = new Map<Element, Map<string, { o: string; c: string }>>();
    const title = document.title;
    document.title = TITLE_AR;

    const doText = (n: Text) => {
      const v = n.nodeValue ?? "";
      const known = texts.get(n);
      if (known && known.c === v) return;
      const c = arText(v);
      if (c === v) { texts.delete(n); return; }
      texts.set(n, { o: v, c });
      n.nodeValue = c;
    };
    const doAttrs = (e: Element) => {
      for (const a of ATTRS) {
        const v = e.getAttribute(a);
        if (v === null) continue;
        let m = attrs.get(e);
        const known = m?.get(a);
        if (known && known.c === v) continue;
        const c = arText(v);
        if (c === v) { m?.delete(a); continue; }
        if (!m) { m = new Map(); attrs.set(e, m); }
        m.set(a, { o: v, c });
        e.setAttribute(a, c);
      }
    };
    const walk = (root: Node) => {
      if (root.nodeType === Node.TEXT_NODE) { if (!SKIP.has((root.parentElement?.tagName) ?? "")) doText(root as Text); return; }
      if (root.nodeType !== Node.ELEMENT_NODE) return;
      const el = root as Element;
      if (SKIP.has(el.tagName)) return;
      doAttrs(el);
      for (let c = el.firstChild; c; c = c.nextSibling) walk(c);
    };

    walk(document.body);
    const mo = new MutationObserver((records) => {
      mo.disconnect();
      for (const r of records) {
        if (r.type === "characterData") { if (r.target.nodeType === Node.TEXT_NODE && !SKIP.has(r.target.parentElement?.tagName ?? "")) doText(r.target as Text); }
        else if (r.type === "attributes") doAttrs(r.target as Element);
        else r.addedNodes.forEach((n) => walk(n));
      }
      mo.observe(document.body, OPTS);
    });
    const OPTS: MutationObserverInit = { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS };
    mo.observe(document.body, OPTS);

    return () => {
      mo.disconnect();
      document.title = title;
      texts.forEach((v, n) => { if (n.isConnected && n.nodeValue === v.c) n.nodeValue = v.o; });
      attrs.forEach((m, e) => m.forEach((v, a) => { if (e.isConnected && e.getAttribute(a) === v.c) e.setAttribute(a, v.o); }));
    };
  }, [lang]);
}
