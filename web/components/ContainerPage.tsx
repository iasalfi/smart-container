"use client";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { useApp } from "@/app/providers";
import { ApiError, fetchContainer, fetchSeries } from "@/lib/api";
import { CUSTOMER_PERSONA_NAME } from "@/app/providers";
import type { Container, Sample } from "@/lib/types";
import { ApiGate, ContainerHead, NotFoundState, Tabs } from "./ui";

type Load = { id: string; c: Container; s: Sample[] } | { id: string; missing: true } | { id: string; error: string };

function Inner({ current, children }: { current: string; children: (c: Container, s: Sample[]) => ReactNode }) {
  const params = useSearchParams();
  const { t, persona } = useApp();
  const id = params.get("id");
  const [state, setState] = useState<Load | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!id) return;
    let live = true;
    Promise.all([fetchContainer(id), fetchSeries(id)])
      .then(([c, s]) => { if (live) setState({ id, c: c.container, s: s.samples }); })
      .catch((e: unknown) => {
        if (!live) return;
        if (e instanceof ApiError && e.status === 404) setState({ id, missing: true });
        else setState({ id, error: e instanceof ApiError ? e.message : "Cannot reach the API." });
      });
    return () => { live = false; };
  }, [id, attempt]);

  if (!id) return <NotFoundState title={t("not_found_title")} body={t("not_found_body")} />;
  const cur = state && state.id === id ? state : null;
  if (!cur || "error" in cur) return <ApiGate error={cur && "error" in cur ? cur.error : null} onRetry={() => { setState(null); setAttempt((n) => n + 1); }} />;
  if ("missing" in cur) return <NotFoundState title={t("not_found_title")} body={t("not_found_body")} />;
  const { c, s } = cur;
  if (persona === "customer" && c.customer !== CUSTOMER_PERSONA_NAME) return <NotFoundState title={t("not_found_title")} body={t("not_found_body")} />;
  return (
    <div className="page">
      <ContainerHead c={c} />
      <Tabs id={c.id} current={current} />
      {children(c, s)}
    </div>
  );
}

export function ContainerPage({ current, children }: { current: string; children: (c: Container, s: Sample[]) => ReactNode }) {
  return (
    <Suspense fallback={<p className="state" aria-busy="true">…</p>}>
      <Inner current={current}>{children}</Inner>
    </Suspense>
  );
}
