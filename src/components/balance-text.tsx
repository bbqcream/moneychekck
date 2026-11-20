import { formatBalance, type Balance } from "@/lib/calc/balance";

export function BalanceText({ balance, large = false }: { balance: Balance; large?: boolean }) {
  const exact = balance.best === balance.worst
    ? balance.best.toLocaleString("ko-KR") + "원"
    : balance.best.toLocaleString("ko-KR") + "원 ~ " + balance.worst.toLocaleString("ko-KR") + "원";
  return (
    <span className={"balance-text" + (balance.shortage ? " balance-negative" : "") + (large ? " balance-large" : "")}>
      <span className="amount-number" title={exact}>{formatBalance(balance)}</span>
      <span className="balance-unit">만원</span>
      {balance.shortage && <span className="badge badge-warn">모자람</span>}
    </span>
  );
}
