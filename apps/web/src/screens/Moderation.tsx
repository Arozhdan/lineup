/* 6.4 Модерация игроков. */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { api, unwrap } from "@/api/client";
import { useAction } from "@/app/AppContext";
import { Avatar, Badge, Button, Card, EmptyState, Input, NavBar, Sheet } from "@/ds";
import { I } from "@/icons";
import { fmtDay } from "@/lib/format";
import type { ModerationKind } from "@lineup/shared";

type Flagged = { id: number; name: string; photoUrl: string; reliability: number; issue: string; sev: string; banned: boolean };

export function Moderation() {
  const navigate = useNavigate();
  const run = useAction();
  const [warnSheet, setWarnSheet] = useState<Flagged | null>(null);
  const [banSheet, setBanSheet] = useState<Flagged | null>(null);
  const [resolveSheet, setResolveSheet] = useState<{ id: number; name: string } | null>(null);
  const [measure, setMeasure] = useState<ModerationKind>("warning");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const modQuery = useQuery({
    queryKey: ["moderation"],
    queryFn: () => unwrap(api.moderation.$get()),
  });

  const flagged = (modQuery.data?.flagged ?? []) as Flagged[];
  const complaintList = modQuery.data?.complaints ?? [];
  const actions = modQuery.data?.actions ?? [];

  const act = async (userId: number, kind: ModerationKind, text: string) => {
    setSaving(true);
    const ok = await run(
      () => unwrap(api.moderation.$post({ json: { userId, kind, reason: text.trim() } })),
      {
        ok: kind === "ban" ? "Игрок забанен" : kind === "penalty" ? "Надёжность снижена" : "Предупреждение отправлено",
        invalidate: [["moderation"]],
      },
    );
    setSaving(false);
    if (ok) {
      setReason("");
      setWarnSheet(null);
      setBanSheet(null);
      setResolveSheet(null);
    }
  };

  const dismissComplaint = (complaintId: number) =>
    void run(() => unwrap(api.complaints[":id"].dismiss.$post({ param: { id: String(complaintId) } })), {
      ok: "Жалоба отклонена",
      invalidate: [["moderation"]],
    });

  const liftBan = (userId: number) => {
    const ban = actions.find((a) => a.kind === "ban" && !a.liftedAt && a.user?.id === userId);
    if (!ban) return;
    void run(() => unwrap(api.moderation[":id"].lift.$post({ param: { id: String(ban.id) } })), {
      ok: "Бан снят",
      invalidate: [["moderation"]],
    });
  };

  return (
    <div className="lu-scr">
      <NavBar title="Модерация" onBack={() => navigate(-1)} backLabel="Назад" />
      <div className="lu-scr__body">
        <p className="lu-lede" style={{ padding: "0 2px" }}>
          Игроки, требующие внимания. Бан закрывает запись на игры.
        </p>

        {modQuery.isPending && <div className="lu-skel" style={{ height: 120, borderRadius: "var(--radius-lg)" }} />}

        {complaintList.length > 0 && (
          <>
            <div className="lu-section-label" style={{ paddingLeft: 2 }}>Жалобы · {complaintList.length}</div>
            {complaintList.map((x) => (
              <Card pad key={x.id} className="lu-card--accent" style={{ borderLeftColor: "var(--warning)" }}>
                <div className="lu-row" style={{ gap: 12 }}>
                  <Avatar name={x.about.name} src={x.about.photoUrl || undefined} size={42} />
                  <div className="lu-grow">
                    <div style={{ fontSize: 16, fontWeight: 600 }}>{x.about.name}</div>
                    <div className="lu-muted">
                      от {x.by} · {fmtDay(x.createdAt)}
                      {x.gameTitle ? ` · ${x.gameTitle}` : ""}
                    </div>
                  </div>
                  {x.banned && <Badge variant="danger">бан</Badge>}
                </div>
                <p style={{ margin: "10px 0 0", fontSize: 14, color: "var(--text)" }}>«{x.reason}»</p>
                <div className="lu-row" style={{ marginTop: 12, gap: 8 }}>
                  <Button size="sm" variant="ghost" className="lu-grow" onClick={() => dismissComplaint(x.id)}>
                    Отклонить
                  </Button>
                  <Button
                    size="sm"
                    className="lu-grow"
                    leadingIcon={<I.Shield width={14} height={14} />}
                    onClick={() => {
                      setReason(x.reason);
                      setMeasure("warning");
                      setResolveSheet({ id: x.about.id, name: x.about.name });
                    }}
                  >
                    Принять меры
                  </Button>
                </div>
              </Card>
            ))}
            <div className="lu-section-label" style={{ paddingLeft: 2 }}>Автофлаги</div>
          </>
        )}

        {flagged.map((p) => (
          <Card pad key={p.id}>
            <div className="lu-row" style={{ gap: 12 }}>
              <Avatar name={p.name} src={p.photoUrl || undefined} size={42} />
              <div className="lu-grow">
                <div style={{ fontSize: 16, fontWeight: 600 }}>{p.name}</div>
                <div className="lu-muted">Надёжность {p.reliability}%</div>
              </div>
              {p.banned ? (
                <Badge variant="danger">бан</Badge>
              ) : (
                <Badge variant={p.sev === "high" ? "danger" : p.sev === "mid" ? "warning" : "neutral"}>
                  <I.AlertTriangle width={11} height={11} />
                  {p.issue}
                </Badge>
              )}
            </div>
            <div className="lu-row" style={{ marginTop: 12, gap: 8 }}>
              {p.banned ? (
                <Button size="sm" variant="secondary" className="lu-grow" onClick={() => liftBan(p.id)}>
                  Снять бан
                </Button>
              ) : (
                <>
                  <Button size="sm" variant="secondary" className="lu-grow" onClick={() => { setReason(""); setWarnSheet(p); }}>
                    Предупредить
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="lu-grow"
                    leadingIcon={<I.Ban width={14} height={14} />}
                    onClick={() => { setReason(""); setBanSheet(p); }}
                  >
                    Забанить
                  </Button>
                </>
              )}
            </div>
          </Card>
        ))}

        {!modQuery.isPending && !flagged.length && !complaintList.length && (
          <EmptyState icon={<I.Shield />} title="Всё спокойно" description="Сейчас нет игроков, требующих внимания." />
        )}

        <div className="lu-section-label" style={{ paddingLeft: 2 }}>История действий</div>
        {actions.length > 0 ? (
          <Card pad style={{ padding: "4px 16px" }}>
            {actions.map((a) => (
              <div className="lu-log-row" key={a.id}>
                <span
                  className="lu-log-row__dot"
                  style={{ background: a.kind === "ban" ? "var(--danger)" : a.kind === "penalty" ? "var(--info)" : "var(--warning)" }}
                >
                  {a.kind === "ban" ? <I.Ban width={15} height={15} /> : a.kind === "penalty" ? <I.BarChart width={15} height={15} /> : <I.AlertTriangle width={15} height={15} />}
                </span>
                <div className="lu-grow">
                  <div style={{ fontSize: 14, color: "var(--text)" }}>
                    <b>{a.user?.name ?? "Игрок"}</b>{" "}
                    {a.kind === "ban" ? "— бан" : a.kind === "penalty" ? "— снижение надёжности" : "— предупреждение"}
                    {a.liftedAt ? " · снят" : ""}
                  </div>
                  <div className="lu-log-row__when">{a.reason} · {fmtDay(a.createdAt)}</div>
                </div>
                {a.kind === "penalty" && !a.liftedAt && (
                  <button
                    className="lu-navbar__btn"
                    style={{ fontSize: 13 }}
                    onClick={() =>
                      void run(() => unwrap(api.moderation[":id"].lift.$post({ param: { id: String(a.id) } })), {
                        ok: "Штраф снят",
                        invalidate: [["moderation"]],
                      })
                    }
                  >
                    снять
                  </button>
                )}
              </div>
            ))}
          </Card>
        ) : (
          <p className="lu-note lu-center">Действий ещё не было.</p>
        )}
      </div>

      <Sheet open={!!resolveSheet} onClose={() => setResolveSheet(null)} title={resolveSheet ? `Меры · ${resolveSheet.name}` : ""}>
        <p className="lu-sheet-lede">Игрок получит уведомление с причиной. Жалоба закроется автоматически.</p>
        <div className="lu-list__sec" style={{ marginBottom: 12 }}>
          {(
            [
              ["warning", "Предупреждение", "просто уведомить игрока"],
              ["penalty", "Снизить надёжность", "штраф · считается как одна неявка"],
              ["ban", "Бан", "закрыть запись на игры"],
            ] as [ModerationKind, string, string][]
          ).map(([kind, title, sub]) => (
            <div key={kind} className="lu-radio" data-on={measure === kind} onClick={() => setMeasure(kind)}>
              <span className="lu-grow">
                <span style={{ display: "block", fontSize: 15, color: kind === "ban" ? "var(--danger)" : "var(--text)" }}>{title}</span>
                <span style={{ fontSize: 12, color: "var(--text-hint)" }}>{sub}</span>
              </span>
              <span className="lu-radio__dot" />
            </div>
          ))}
        </div>
        <div className="lu-stack" style={{ gap: 12 }}>
          <Input label="Причина" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="видна игроку" />
          <Button
            block
            size="lg"
            variant={measure === "ban" ? "destructive" : "primary"}
            loading={saving}
            disabled={!reason.trim()}
            onClick={() => resolveSheet && act(resolveSheet.id, measure, reason)}
          >
            {measure === "ban" ? "Забанить" : measure === "penalty" ? "Снизить надёжность" : "Отправить предупреждение"}
          </Button>
        </div>
      </Sheet>

      <Sheet open={!!warnSheet} onClose={() => setWarnSheet(null)} title={warnSheet ? `Предупредить ${warnSheet.name}` : ""}>
        <p className="lu-sheet-lede">Игрок получит уведомление. Действие попадёт в журнал.</p>
        <div className="lu-stack" style={{ gap: 12 }}>
          <Input label="Причина" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="напр. поздняя отмена" />
          <Button block size="lg" loading={saving} disabled={!reason.trim()} onClick={() => warnSheet && act(warnSheet.id, "warning", reason)}>
            Отправить предупреждение
          </Button>
        </div>
      </Sheet>

      <Sheet open={!!banSheet} onClose={() => setBanSheet(null)} title={banSheet ? `Забанить ${banSheet.name}?` : ""}>
        <p className="lu-sheet-lede">Игрок больше не сможет записываться на игры. Действие попадёт в журнал и его можно отменить.</p>
        <div className="lu-stack" style={{ gap: 12 }}>
          <Input label="Причина" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="напр. 3 неявки за 60 дней" />
          <Button block size="lg" variant="destructive" loading={saving} disabled={!reason.trim()} onClick={() => banSheet && act(banSheet.id, "ban", reason)}>
            Забанить
          </Button>
          <Button block variant="ghost" onClick={() => setBanSheet(null)}>Отмена</Button>
        </div>
      </Sheet>
    </div>
  );
}
