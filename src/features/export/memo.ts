import { formatBalance, type Timeline } from "@/lib/calc/balance";
import { formatRange, parseManwon } from "@/lib/calc/money";
import type { RangeAmount } from "@/types/scenario";

const clean = (value: string) => value.replace(/\s+/g, " ").trim();

function itemDescription(label: string, amount: RangeAmount) {
  const text = clean(label);
  const stated = text.match(/^([\d,.]+)\s*만원(?:\s|$)/);
  if (stated && amount.min === amount.max && parseManwon(stated[1]) === amount.min) return text;
  return text + " " + formatRange(amount);
}

export function formatMemo(timeline: Timeline): string {
  const sections: string[] = [];
  for (const [index, group] of timeline.groups.entries()) {
    const count = sections.length + 1;
    const heading = group.event.label.includes("월급") ? "월급" : "입금";
    sections.push(
      "[" + count + ". " + heading + "]\n* " + clean(group.event.label) + " " + formatRange(group.amount) +
      " → 잔액 " + formatBalance(group.balance),
    );
    if (group.items.length) {
      const rows = group.items.map(({ item, amount, balance }) =>
        "* " + (item.priority ? "[" + item.priority + "] " : "") +
        itemDescription(item.label, amount) + " → 잔액 " + formatBalance(balance),
      );
      sections.push("[" + (count + 1) + ". " + (index + 1) + "차 계획]\n" + rows.join("\n"));
    }
  }
  return sections.join("\n\n");
}
