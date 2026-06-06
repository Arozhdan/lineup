/* 6.1 Сверка оплат по игре (организатор). */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router";
import { PAY_STATUS_LABEL, type PayMethod, type PayStatus } from "@lineup/shared";
import { api, unwrap } from "@/api/client";
import { useApp, useAction } from "@/app/AppContext";
import { Avatar, Badge, Button, Card, ListItem, ListSection, NavBar, Sheet } from "@/ds";
import { I } from "@/icons";
import { fmtDay, fmtMoney, plural } from "@/lib/format";

type ReconcileRow = {
  id: number;
  name: string;
  photoUrl: string;
  position: string | null;
  guests: number;
  payStatus: PayStatus;
  payMethod: PayMethod | null;
  fee: number;
  owed: number;
};

const methodLabel = (m: PayMethod | null): string => (m === "qr" ? " · QR" : m === "cash" ? " · наличные" : "");

export function Reconcile() {
  const navigate = useNavigate();
  const { id = "" } = useParams();
  const run = useAction();
  const { toast } = useApp();
  const [sheet, setSheet] = useState<ReconcileRow | null>(null);
  const [reminding, setReminding] = useState(false);

  const reconcileQuery = useQuery({
    queryKey: ["reconcile", id],
    queryFn: () => unwrap(api.money.games[":id"].reconcile.$get({ param: { id } })),
    enabled: !!id,
  });

  const data = reconcileQuery.data;
  const rows = (data?.rows ?? []) as ReconcileRow[];
  const paidCount = rows.filter((r) => r.payStatus === "paid").length;
  const debt = data?.debt ?? 0;
  const debtors = rows.filter((r) => r.owed > 0).length;
  const collected = data?.collected ?? 0;
  const rent = data?.rent ?? 0;
  const balance = collected - rent;

  const setPay = async (userId: number, payStatus: "paid" | "partial" | "waived" | "unpaid", payMethod: PayMethod | null, ok: string) => {
    await run(
      () => unwrap(api.money.games[":id"]["pay-status"].$post({ param: { id }, json: { userId, payStatus, payMethod } })),
      { ok, invalidate: [["reconcile", id]] },
    );
    setSheet(null);
  };

  const remind = async () => {
    setReminding(true);
    await run(
      async () => {
        const r = await unwrap(api.money.games[":id"]["remind-debtors"].$post({ param: { id } }));
        toast(`Напоминания отправлены: ${r.sent}`);
      },
      { invalidate: [["reconcile", id]] },
    );
    setReminding(false);
  };

  return (
    <div className="lu-scr">
      <NavBar
        title="Сверка оплат"
        subtitle={data ? `${data.title} · ${fmtDay(data.startsAt)}` : undefined}
        onBack={() => navigate(-1)}
        backLabel="Игра"
      />
      <div className="lu-scr__body">
        {data && (debt === 0 ? (
          <div className="lu-youin-banner">
            <I.CheckCircle width={18} height={18} />
            Все рассчитались · сборы закрыты
          </div>
        ) : (
          <div className="lu-countdown" style={{ alignSelf: "stretch", justifyContent: "center" }}>
            <I.AlertTriangle width={14} height={14} />
            Ждём оплату от {debtors} {plural(debtors, "игрока", "игроков", "игроков")}
          </div>
        ))}

        <div className="lu-money-summary">
          <div>
            <div className="v" style={{ color: "var(--success)" }}>{fmtMoney(collected)}</div>
            <div className="l">собрано</div>
          </div>
          <div>
            <div className="v">{fmtMoney(data?.expected ?? 0)}</div>
            <div className="l">ожидается</div>
          </div>
          <div>
            <div className="v" style={{ color: "var(--danger)" }}>{fmtMoney(debt)}</div>
            <div className="l">долг</div>
          </div>
        </div>

        <Card pad>
          <div className="lu-row lu-row--between">
            <span className="lu-section-label">Баланс игры (минус аренда {fmtMoney(rent)})</span>
            <span className="lu-display" style={{ fontSize: 22, color: balance >= 0 ? "var(--success)" : "var(--danger)" }}>
              {balance >= 0 ? "+" : ""}{fmtMoney(balance)}
            </span>
          </div>
          <p className="lu-note" style={{ padding: "6px 0 0" }}>
            {balance >= 0 ? "Аренда покрыта взносами." : `Не хватает ${fmtMoney(rent - collected)} — соберём с должников.`}
          </p>
        </Card>

        <div className="lu-row lu-row--between" style={{ padding: "0 2px" }}>
          <span className="lu-section-label">Участники · {paidCount}/{rows.length} оплатили</span>
          {data && <span className="lu-bar__lbl">взнос {fmtMoney(data.price)}</span>}
        </div>

        {reconcileQuery.isPending && <div className="lu-skel" style={{ height: 200, borderRadius: "var(--radius-lg)" }} />}

        {rows.length > 0 && (
          <Card>
            <div className="lu-pool">
              {rows.map((p) => (
                <button key={p.id} className="lu-pool-card" onClick={() => setSheet(p)}>
                  <Avatar name={p.name} src={p.photoUrl || undefined} size={34} />
                  <span className="lu-grow">
                    <span style={{ display: "block", fontSize: 15, color: "var(--text)" }}>{p.name}</span>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        fontSize: 12,
                        color: p.payStatus === "marked" ? "var(--info)" : "var(--text-hint)",
                      }}
                    >
                      <span className="lu-pay-state" data-s={p.payStatus} />
                      {PAY_STATUS_LABEL[p.payStatus]}
                      {methodLabel(p.payMethod)}
                    </span>
                  </span>
                  {p.payStatus === "waived" ? (
                    <Badge variant="neutral">—</Badge>
                  ) : p.owed > 0 ? (
                    <Badge variant={p.payStatus === "partial" ? "warning" : "danger"}>{fmtMoney(p.owed)}</Badge>
                  ) : (
                    <I.Check width={18} height={18} style={{ color: "var(--success)" }} />
                  )}
                </button>
              ))}
            </div>
          </Card>
        )}

        <div className="lu-form-grid">
          <Button
            variant="secondary"
            leadingIcon={<I.Bell width={16} height={16} />}
            disabled={debt === 0}
            loading={reminding}
            onClick={remind}
          >
            Напомнить всем
          </Button>
          <Button variant="secondary" leadingIcon={<I.Repeat width={16} height={16} />} onClick={() => navigate("/refunds")}>
            Возвраты
          </Button>
        </div>
      </div>

      <Sheet open={!!sheet} onClose={() => setSheet(null)} title={sheet?.name ?? ""}>
        {sheet && (
          <>
            <p className="lu-sheet-lede">Взнос {fmtMoney(sheet.fee)}. Отметь, как игрок рассчитался.</p>
            <ListSection>
              <ListItem
                icon={<I.QrCode width={16} height={16} />}
                iconColor="var(--accent)"
                title="Оплатил по QR"
                chevron
                onClick={() => void setPay(sheet.id, "paid", "qr", "Отмечено · QR")}
              />
              <ListItem
                icon={<I.Coins width={16} height={16} />}
                iconColor="var(--success)"
                title="Принял наличными"
                chevron
                onClick={() => void setPay(sheet.id, "paid", "cash", "Отмечено · наличные")}
              />
              <ListItem
                icon={<I.Wallet width={16} height={16} />}
                iconColor="var(--warning)"
                title="Оплатил половину"
                chevron
                onClick={() => void setPay(sheet.id, "partial", "qr", "Отмечено · частично")}
              />
              <ListItem
                icon={<I.X width={16} height={16} />}
                iconColor="var(--gray-500)"
                title="Не оплачено"
                chevron
                onClick={() => void setPay(sheet.id, "unpaid", null, "Отмечено · не оплачено")}
              />
              <ListItem
                icon={<I.X width={16} height={16} />}
                iconColor="var(--gray-500)"
                title="Списать взнос"
                subtitle="не платит за эту игру"
                chevron
                onClick={() => void setPay(sheet.id, "waived", null, "Взнос списан")}
              />
            </ListSection>
          </>
        )}
      </Sheet>
    </div>
  );
}
