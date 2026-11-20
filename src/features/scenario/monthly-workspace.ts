import { calculateTimeline } from "@/lib/calc/balance";
import type { Scenario } from "@/types/scenario";

export function getMonthlyWorkspace(scenarios: Scenario[], month: string) {
  const oldest = (plans: Scenario[]) => plans.reduce<Scenario | undefined>((first, plan) =>
    !first || plan.createdAt < first.createdAt ? plan : first, undefined);
  const base = oldest(scenarios.filter(({ monthScope }) => monthScope === "base")) ??
    oldest(scenarios.filter(({ monthScope }) => monthScope === undefined));
  const details = scenarios.filter(({ id }) => id !== base?.id).flatMap((scenario) => {
    if (scenario.monthScope && scenario.monthScope !== "base" && scenario.monthScope !== month) return [];
    const timeline = calculateTimeline(scenario);
    if (scenario.monthScope !== month) {
      const dated = timeline.groups.filter(({ event }) => event.date !== null);
      if (dated.length ? !dated.some(({ event }) => event.date?.startsWith(month)) : !scenario.createdAt.startsWith(month)) return [];
    }
    return [{ scenario, timeline }];
  }).sort((a, b) => b.scenario.updatedAt.localeCompare(a.scenario.updatedAt));
  return { base, details };
}
