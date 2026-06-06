/* 3.7 Платежи и долги. */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { api, unwrap } from "@/api/client";
import { useAction } from "@/app/AppContext";
import { Button, Card, ListItem, ListSection, NavBar, Sheet } from "@/ds";
import { QrBox } from "@/ds/extras";
import { I } from "@/icons";
import { fmtDay, fmtMoney } from "@/lib/format";

export function Payments() {
  const navigate = useNavigate();
  const run = useAction();
  const [howOpen, setHowOpen] = useState(false);
  const [paying, setPaying] = useState(false);

  const paymentsQuery = useQuery({
    queryKey: ["payments"],
    queryFn: () => unwrap(api.money.payments.$get()),
  });
  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: () => unwrap(api.settings.$get()),
  });

  const debt = paymentsQuery.data?.debt ?? 0;
  const items = paymentsQuery.data?.items ?? [];
  const settings = settingsQuery.data;

  const remindAll = async () => {
    const unpaid = items.filter((x) => x.payStatus === "unpaid" || x.payStatus === "marked");
    setPaying(true);
    const ok = await run(
      () => Promise.all(unpaid.map((x) => unwrap(api.games[":id"]["remind-organizer"].$post({ param: { id: String(x.gameId) } })))),
      { ok: "Организатор предупреждён — подтвердит оплату", invalidate: [["payments"]] },
    );
    setPaying(false);
    if (ok) setHowOpen(false);
  };

  return (
    <div className="lu-scr">
      <NavBar title="Платежи" onBack={() => navigate(-1)} backLabel="Профиль" />
      <div className="lu-scr__body">
        <Card pad className={debt ? "lu-card--accent" : ""} style={debt ? { borderLeftColor: "var(--danger)" } : undefined}>
          <div className="lu-row lu-row--between">
            <div>
              <div className="lu-muted">К оплате</div>
              <div
                className="lu-display"
                style={{ fontSize: 30, color: debt ? "var(--danger)" : "var(--success)", whiteSpace: "nowrap" }}
              >
                {fmtMoney(debt)}
              </div>
            </div>
            {debt > 0 && (
              <Button variant="secondary" onClick={() => setHowOpen(true)}>
                Как оплатить
              </Button>
            )}
          </div>
          {debt > 0 && (
            <p className="lu-note" style={{ padding: "8px 0 0" }}>
              Взнос переводится организатору по QR или наличными на игре — в приложении оплата не проходит.
            </p>
          )}
        </Card>

        {paymentsQuery.isPending && (
          <div className="lu-skel" style={{ height: 160, borderRadius: "var(--radius-lg)" }} />
        )}

        {items.length > 0 && (
          <ListSection label="История платежей">
            {items.map((x) => (
              <ListItem
                key={x.gameId}
                title={x.title}
                subtitle={x.payStatus === "marked" ? `${fmtDay(x.startsAt)} · ждёт подтверждения` : fmtDay(x.startsAt)}
                leading={
                  <span className="lu-cell__lead">
                    <span className="lu-pay-state" data-s={x.payStatus} style={{ width: 10, height: 10 }} />
                  </span>
                }
                trailing={
                  x.payStatus === "waived" ? (
                    <span style={{ color: "var(--text-hint)", fontWeight: 600 }}>прощён</span>
                  ) : x.payStatus === "unpaid" || x.payStatus === "marked" ? (
                    <span style={{ color: "var(--danger)", fontWeight: 600 }}>{fmtMoney(x.owed)}</span>
                  ) : (
                    <span style={{ color: "var(--text)", fontWeight: 600 }}>✓ {fmtMoney(x.fee)}</span>
                  )
                }
              />
            ))}
          </ListSection>
        )}
        <p className="lu-note">Зелёный — оплачено, красный — ждёт оплаты, серый — взнос прощён организатором.</p>
      </div>

      <Sheet open={howOpen} onClose={() => setHowOpen(false)} title={`Оплатить ${fmtMoney(debt)}`}>
        <p className="lu-sheet-lede">
          В приложении платёж не проходит. Переведи организатору по QR или рассчитайся наличными на игре — он отметит оплату в
          сверке.
        </p>
        <div className="lu-qrbox" style={{ marginBottom: 16 }}>
          <QrBox src={settings?.qrImage} />
          <p className="lu-note lu-center" style={{ padding: 0 }}>
            QR сообщества «{settings?.name ?? "Lineup"}» · {fmtMoney(debt)}
          </p>
        </div>
        <div className="lu-stack lu-stack--sm">
          <Button block size="lg" loading={paying} leadingIcon={<I.Bell width={18} height={18} />} onClick={remindAll}>
            Я оплатил — напомнить организатору
          </Button>
          <Button
            block
            variant="ghost"
            onClick={() => {
              run(() => Promise.resolve(), { ok: "Напомним рассчитаться на игре" });
              setHowOpen(false);
            }}
          >
            Оплачу наличными на игре
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
