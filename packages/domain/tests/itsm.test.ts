import { describe, expect, it } from "vitest";
import { getAlerts, getContainer } from "../src/fleet";
import {
  PRIORITY_MATRIX, SLA_TARGETS, TRANSITIONS, canMove, classify, formatMinutes, itsmStats, nextProblemId, priorityOf,
  problemCandidates, queueOrder, slaFor, tierFor, ticketView, type TicketRecord,
} from "../src/itsm";
import type { Alert } from "../src/types";

const alert = (over: Partial<Alert> = {}): Alert => ({ id: "SC-1001-temperature_critical-0", containerId: "SC-1001", type: "temperature_critical", severity: "critical", minutesAgo: 0, state: "open", params: {}, ...over });

describe("ITSM rules", () => {
  it("TC-U-090 the priority matrix gives P1 for high impact and urgency and P4 for the lowest", () => {
    expect(priorityOf(1, 1)).toBe(1);
    expect(priorityOf(1, 2)).toBe(2);
    expect(priorityOf(2, 2)).toBe(3);
    expect(priorityOf(3, 3)).toBe(4);
    expect(PRIORITY_MATRIX).toHaveLength(3);
  });

  it("TC-U-091 impact and urgency follow the alert type, cargo and age", () => {
    expect(classify(alert({ type: "gas_high" }), "dry")).toMatchObject({ impact: 1, urgency: 1, priority: 1 });
    expect(classify(alert({ minutesAgo: 60 }), "pharma").priority).toBe(1);
    expect(classify(alert({ minutesAgo: 0 }), "frozen")).toMatchObject({ impact: 2, urgency: 2, priority: 3 });
    expect(classify(alert({ type: "route_deviation", severity: "warning" }), "dry").priority).toBe(4);
  });

  it("TC-U-092 response and resolution targets get longer as priority drops", () => {
    for (const p of [1, 2, 3] as const) {
      expect(SLA_TARGETS[p].respondMin).toBeLessThan(SLA_TARGETS[(p + 1) as 2 | 3 | 4].respondMin);
      expect(SLA_TARGETS[p].resolveMin).toBeLessThan(SLA_TARGETS[(p + 1) as 2 | 3 | 4].resolveMin);
    }
  });

  it("TC-U-093 an open alert breaches its response clock once its age reaches the target", () => {
    expect(slaFor(5, 1, undefined, "open").response.state).toBe("running");
    expect(slaFor(8, 1, undefined, "open").response.state).toBe("at_risk");
    expect(slaFor(10, 1, undefined, "open").response.state).toBe("breached");
    expect(slaFor(10, 1, undefined, "open").worst).toBe("breached");
  });

  it("TC-U-094 acknowledging stops the response clock and resolving stops the resolution clock", () => {
    const rec: TicketRecord = { ackAge: 4, resolveAge: 100, log: [] };
    const acked = slaFor(130, 1, rec, "acknowledged");
    expect(acked.response).toMatchObject({ state: "met", elapsedMin: 4 });
    expect(acked.resolution.state).toBe("breached");
    const late = slaFor(50, 1, { ackAge: 40, log: [] }, "in_progress");
    expect(late.response.state).toBe("met_late");
    const done = slaFor(500, 1, rec, "closed");
    expect(done.resolution).toMatchObject({ state: "met", elapsedMin: 100 });
  });

  it("TC-U-095 breaches and major incidents lift the support tier", () => {
    const fresh = slaFor(1, 3, undefined, "open");
    expect(tierFor(3, fresh, undefined)).toBe(1);
    expect(tierFor(1, fresh, undefined)).toBe(2);
    expect(tierFor(3, slaFor(70, 3, undefined, "open"), undefined)).toBe(2);
    expect(tierFor(3, slaFor(600, 3, { ackAge: 2, log: [] }, "acknowledged"), undefined)).toBe(3);
    expect(tierFor(4, fresh, { major: true, log: [] })).toBe(3);
    expect(tierFor(4, fresh, { manualTier: 2, log: [] })).toBe(2);
  });

  it("TC-U-096 the lifecycle only allows the next step and closure needs a resolution", () => {
    expect(canMove("open", "acknowledged")).toBe(true);
    expect(canMove("open", "closed")).toBe(false);
    expect(canMove("acknowledged", "closed")).toBe(false);
    expect(canMove("acknowledged", "resolved")).toBe(true);
    expect(canMove("resolved", "closed")).toBe(true);
    expect(canMove("resolved", "in_progress")).toBe(true);
    expect(TRANSITIONS.closed).toEqual([]);
  });

  it("TC-U-097 statistics count active tickets, SLA risk, owners and mean times", () => {
    const profile = (id: string) => getContainer(id)!.profileId;
    const alerts = getAlerts();
    const views = alerts.map((a) => ticketView(a, profile(a.containerId), undefined));
    const stats = itsmStats(views);
    expect(stats.active).toBe(102);
    expect(stats.unassigned).toBe(102);
    expect(stats.byState.open).toBe(102);
    expect(stats.matrix.flat().reduce((s, n) => s + n, 0)).toBe(102);
    expect(Object.values(stats.byPriority).reduce((s, n) => s + n, 0)).toBe(102);
    expect(stats.mtta).toBeNull();
    const rec: TicketRecord = { ackAge: 10, resolveAge: 40, owner: "me", log: [] };
    const one = [ticketView({ ...alerts[0], state: "closed" }, profile(alerts[0].containerId), rec), ticketView({ ...alerts[1], state: "open" }, profile(alerts[1].containerId), undefined)];
    const s2 = itsmStats(one);
    expect(s2).toMatchObject({ active: 1, mtta: 10, mttr: 40 });
  });

  it("TC-U-098 recurring alerts on one corridor become problem candidates", () => {
    const fleet = new Map<string, string>();
    for (const a of getAlerts()) fleet.set(a.containerId, getContainer(a.containerId)!.routeId);
    const cands = problemCandidates(getAlerts(), (id) => fleet.get(id));
    expect(cands.length).toBeGreaterThan(0);
    for (const c of cands) { expect(c.count).toBeGreaterThanOrEqual(4); expect(c.alertIds).toHaveLength(c.count); }
    for (let i = 1; i < cands.length; i++) expect(cands[i - 1].count).toBeGreaterThanOrEqual(cands[i].count);
    expect(nextProblemId([])).toBe("PRB-001");
    expect(nextProblemId([{ id: "PRB-007" } as never])).toBe("PRB-008");
  });

  it("TC-U-099 queues order by priority, then by the oldest alert", () => {
    const a = ticketView(alert({ id: "a", type: "gas_high" }), "dry", undefined);
    const b = ticketView(alert({ id: "b", severity: "warning", type: "route_deviation" }), "dry", undefined);
    expect([b, a].sort(queueOrder)[0].alert.id).toBe("a");
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(125)).toBe("2 h 5 min");
    expect(formatMinutes(120)).toBe("2 h");
  });
});
