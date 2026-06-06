/* 6.4 Модерация игроков. */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { api, unwrap } from "@/api/client";
import { useAction } from "@/app/AppContext";
import { Avatar, Badge, Button, Card, EmptyState, Input, NavBar, Sheet } from "@/ds";
import { I } from "@/icons";
import { fmtDay } from "@/lib/format";

type Flagged = { id: number; name: string; photoUrl: string; reliability: number; issue: string; sev: string; banned: boolean };

export function Moderation() {
  const navigate = useNavigate();
  const run = useAction();
  const [warnSheet, setWarnSheet] = useState<Flagged | null>(null);
  const [banSheet, setBanSheet] = useState<Flagged | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const modQuery = useQuery({
    queryKey: ["moderation"],
    queryFn: () => unwrap(api.moderation.$get()),
  });

  const flagged = (modQuery.data?.flagged ?? []) as Flagged[];
  const actions = modQuery.data?.actions ?? [];

  const act = async (userId: number, kind: "warning" | "ban", text: string) => {
    setSaving(true);
    const ok = await run(
      () => unwrap(api.moderation.$post({ json: { userId, kind, reason: text.trim() } })),
      { ok: kind === "ban" ? "Игрок забанен" : "Предупреждение отправлено", invalidate: [["moderation"]] },
    );
    setSaving(false);
    if (ok) {
      setReason("");
      setWarnSheet(null);
      setBanSheet(null);
    }
  };

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

        {!modQuery.isPending && !flagged.length && (
          <EmptyState icon={<I.Shield />} title="Всё спокойно" description="Сейчас нет игроков, требующих внимания." />
        )}

        <div className="lu-section-label" style={{ paddingLeft: 2 }}>История действий</div>
        {actions.length > 0 ? (
          <Card pad style={{ padding: "4px 16px" }}>
            {actions.map((a) => (
              <div className="lu-log-row" key={a.id}>
                <span className="lu-log-row__dot" style={{ background: a.kind === "ban" ? "var(--danger)" : "var(--warning)" }}>
                  {a.kind === "ban" ? <I.Ban width={15} height={15} /> : <I.AlertTriangle width={15} height={15} />}
                </span>
                <div className="lu-grow">
                  <div style={{ fontSize: 14, color: "var(--text)" }}>
                    <b>{a.user?.name ?? "Игрок"}</b> {a.kind === "ban" ? "— бан" : "— предупреждение"}
                    {a.liftedAt ? " · снят" : ""}
                  </div>
                  <div className="lu-log-row__when">{a.reason} · {fmtDay(a.createdAt)}</div>
                </div>
              </div>
            ))}
          </Card>
        ) : (
          <p className="lu-note lu-center">Действий ещё не было.</p>
        )}
      </div>

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
