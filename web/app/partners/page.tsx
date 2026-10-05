"use client";
import { useApp } from "../providers";
import { ApiGate, NotFoundState } from "@/components/ui";
import { PeopleManager } from "@/components/PeopleManager";

export default function PartnersPage() {
  const { t, persona, fleet, apiError, retry } = useApp();
  if (persona === "customer") return <NotFoundState title={t("not_allowed_title")} body={t("not_allowed_body")} />;
  if (!fleet) return <ApiGate error={apiError} onRetry={retry} />;
  return (
    <div className="page" data-testid="partners-page">
      <div className="page-head"><div><h1>{t("pp_title")}</h1><p className="muted">{t("pp_sub")}</p></div></div>
      <PeopleManager />
    </div>
  );
}
