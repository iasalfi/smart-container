"use client";
import { NotFoundState } from "@/components/ui";
import { useApp } from "./providers";

export default function NotFound() {
  const { t } = useApp();
  return <NotFoundState title={t("not_found_title")} body={t("not_found_body")} />;
}
