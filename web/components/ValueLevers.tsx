"use client";
import Link from "next/link";
import { useApp } from "@/app/providers";
import type { Analytics } from "@/lib/analytics";
import { journeyStatus } from "@/lib/journey";
import type { Key } from "@/lib/i18n";

/** Six levers the app pulls, each with a baseline read live from the data on screen. Targets are proposals. */
export function ValueLevers({ a }: { a: Analytics }) {
  const { t, journeys, workOrders, released, fleet } = useApp();
  const done = journeys.filter((j) => journeyStatus(j) === "completed").length;
  const reefers = (fleet ?? []).filter((c) => c.reefer);
  const oobMean = reefers.length ? Math.round(reefers.reduce((s, c) => s + c.outOfBandMin, 0) / reefers.length) : 0;
  const base: Record<number, Record<string, string | number>> = {
    1: { u: a.cases.unowned, a: a.cases.active, s: a.itsm.breached },
    2: { w: workOrders.length, c: Math.max(0, a.cases.active - a.cases.inMro) },
    3: { d: done, r: released },
    4: { m: oobMean, a: a.itsm.active },
    5: { p: a.mro.preventive, n: workOrders.length, d: a.devices.total },
    6: { c: a.people.carrierScore, s: a.people.driverScore, x: a.people.onExpiredLicence },
  };
  return (
    <section className="card" data-testid="value-levers" aria-labelledby="vl-h">
      <h2 id="vl-h">{t("vl_title")}</h2>
      <p className="muted small">{t("vl_sub")}</p>
      <div className="table-wrap" tabIndex={0} role="region" aria-label={t("vl_title")}>
        <table className="table">
          <thead><tr><th scope="col">{t("vl_lever")}</th><th scope="col">{t("vl_op")}</th><th scope="col">{t("vl_biz")}</th><th scope="col">{t("vl_measure")}</th><th scope="col">{t("vl_base")}</th><th scope="col">{t("vl_target")}</th></tr></thead>
          <tbody>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <tr key={n} data-testid="value-row">
                <th scope="row">{t(`vl_l${n}` as Key)}</th>
                <td>{t(`vl_l${n}_op` as Key)}</td><td>{t(`vl_l${n}_biz` as Key)}</td><td>{t(`vl_l${n}_m` as Key)}</td>
                <td data-testid={`value-base-${n}`}>{t(`vl_l${n}_b` as Key, base[n])}</td>
                <td>{n === 1 ? t("vl_l1_t") : <span className="muted">{t("vl_tbc")}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function ReportsLink() {
  const { t } = useApp();
  return <Link className="btn small ghost" href="/reports/" data-testid="an-reports-link">{t("an_open_reports")}</Link>;
}
