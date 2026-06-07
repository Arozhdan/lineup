/* 6.2 Возвраты. */
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { api, unwrap } from "@/api/client";
import { useAction } from "@/app/AppContext";
import { Avatar, Badge, Button, Card, NavBar } from "@/ds";
import { I } from "@/icons";
import { fmtMoney } from "@/lib/format";

export function Refunds() {
  const navigate = useNavigate();
  const run = useAction();

  const refundsQuery = useQuery({
    queryKey: ["refunds"],
    queryFn: () => unwrap(api.money.refunds.$get()),
  });

  const list = refundsQuery.data ?? [];
  const toRefund = list.filter((r) => r.status === "pending").reduce((s, r) => s + r.amount, 0);

  const decide = (refundId: number, approve: boolean) =>
    void run(
      () => unwrap(api.money.refunds[":id"].decide.$post({ param: { id: String(refundId) }, json: { approve } })),
      { ok: approve ? "Возврат отправлен" : "Отклонено", invalidate: [["refunds"]] },
    );

  return (
    <div className="lu-scr">
      <NavBar title="Возвраты" onBack={() => navigate(-1)} backLabel="Финансы" />
      <div className="lu-scr__body">
        <Card pad>
          <div className="lu-row lu-row--between">
            <span className="lu-section-label">К возврату</span>
            <span className="lu-display" style={{ fontSize: 22, color: "var(--text)" }}>{fmtMoney(toRefund)}</span>
          </div>
        </Card>

        {refundsQuery.isPending && <div className="lu-skel" style={{ height: 120, borderRadius: "var(--radius-lg)" }} />}

        {list.map((r) => (
          <Card pad key={r.id}>
            <div className="lu-row lu-row--between">
              <div className="lu-row" style={{ gap: 10 }}>
                <Avatar name={r.user?.name ?? "?"} src={r.user?.photoUrl || undefined} size={38} />
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{r.user?.name ?? "Игрок"}</div>
                  <div className="lu-muted">{r.reason}</div>
                </div>
              </div>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, color: "var(--text)" }}>{fmtMoney(r.amount)}</span>
            </div>
            <div className="lu-row" style={{ marginTop: 12, gap: 8 }}>
              {r.status === "done" ? (
                <Badge variant="success"><I.Check width={11} height={11} />возвращено</Badge>
              ) : r.status === "rejected" ? (
                <Badge variant="neutral">отклонено</Badge>
              ) : r.auto ? (
                <Badge variant="success"><I.Check width={11} height={11} />по отмене</Badge>
              ) : (
                <Badge variant="warning">нужно решение</Badge>
              )}
              <span className="lu-grow" />
              {r.status === "pending" && (
                <>
                  <Button size="sm" variant="secondary" onClick={() => decide(r.id, false)}>Отклонить</Button>
                  <Button size="sm" onClick={() => decide(r.id, true)}>Вернуть</Button>
                </>
              )}
            </div>
          </Card>
        ))}

        <p className="lu-note lu-center">Возврат закрывается, когда организатор фактически вернул деньги.</p>
      </div>
    </div>
  );
}
