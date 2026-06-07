/* 5.3 Пакетная статистика (role-scoped). */
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router";
import { api, unwrap } from "@/api/client";
import { useAction, useApp } from "@/app/AppContext";
import { Avatar, Button, Card, NavBar, PositionBadge } from "@/ds";
import { Stepper } from "@/ds/extras";
import { I } from "@/icons";

type Row = { userId: number; name: string; photoUrl: string; position: string | null; goals: number; assists: number; confirmed: boolean; isMe: boolean };

export function BatchStats() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { isOrganizer, me } = useApp();
  const run = useAction();
  const isPlayer = !isOrganizer;
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);

  const statsQuery = useQuery({
    queryKey: ["stats", id],
    queryFn: () => unwrap(api.games[":id"].stats.$get({ param: { id: String(id) } })),
    enabled: !!id,
  });

  // Match score caps self-reported numbers (nobody scores more than the total).
  const resultQuery = useQuery({
    queryKey: ["result", id],
    queryFn: () => unwrap(api.games[":id"].result.$get({ param: { id: String(id) } })),
    enabled: !!id && isPlayer,
  });
  const totalGoals = resultQuery.data ? resultQuery.data.scoreA + resultQuery.data.scoreB : 99;

  useEffect(() => {
    if (!statsQuery.data) return;
    setRows(
      statsQuery.data.map((s) => ({
        userId: s.id,
        name: s.name,
        photoUrl: s.photoUrl,
        position: s.position,
        goals: s.goals,
        assists: s.assists,
        confirmed: s.confirmed,
        isMe: s.id === me?.id,
      })),
    );
  }, [statsQuery.data, me?.id]);

  const upd = (userId: number, key: "goals" | "assists", delta: number) =>
    setRows((d) => d.map((p) => (p.userId === userId ? { ...p, [key]: Math.max(0, p[key] + delta) } : p)));

  const submit = async () => {
    const payload = isPlayer ? rows.filter((r) => r.isMe) : rows;
    if (!payload.length) {
      navigate(-1);
      return;
    }
    setBusy(true);
    const ok = await run(
      () => unwrap(api.games[":id"].stats.$post({ param: { id: String(id) }, json: { rows: payload.map((r) => ({ userId: r.userId, goals: r.goals, assists: r.assists })) } })),
      { ok: isPlayer ? "Твоя статистика отправлена" : "Статистика сохранена", invalidate: [["stats", id], ["result", id]] },
    );
    setBusy(false);
    if (ok) navigate(-1);
  };

  return (
    <div className="lu-scr">
      <NavBar title={isPlayer ? "Мои голы и пасы" : "Статистика матча"} onBack={() => navigate(-1)} backLabel="Итог" />
      <div className="lu-scr__body">
        <p className="lu-lede" style={{ padding: "0 2px" }}>
          {isPlayer
            ? "Запиши свои голы и передачи за матч. Организатор подтвердит — и они попадут в твою статистику и лидерборды."
            : "Проставь голы и передачи. Это попадёт в личную статистику игроков и лидерборды."}
        </p>
        <Card>
          <div className="lu-pool">
            {rows.map((p) => {
              const locked = p.confirmed && isPlayer;
              return (
                <div key={p.userId} className="lu-pool-card lu-statrow">
                  <div className="lu-row" style={{ gap: 10, width: "100%" }}>
                    <Avatar name={p.name} src={p.photoUrl || undefined} size={36} />
                    <span className="lu-grow lu-statrow__name">{p.isMe ? `${p.name} (вы)` : p.name}</span>
                    {p.position && <PositionBadge code={p.position} />}
                  </div>
                  {locked ? (
                    <p className="lu-note" style={{ width: "100%", margin: 0 }}>
                      Подтверждено организатором: {p.goals} гол · {p.assists} пас
                    </p>
                  ) : (
                    <div className="lu-statrow__steppers">
                      <div className="lu-statrow__stat">
                        <Stepper
                          value={p.goals}
                          onDec={() => upd(p.userId, "goals", -1)}
                          onInc={() => upd(p.userId, "goals", isPlayer && p.goals >= totalGoals ? 0 : 1)}
                        />
                        <div className="lu-statrow__cap">голы</div>
                      </div>
                      <div className="lu-statrow__stat">
                        <Stepper
                          value={p.assists}
                          onDec={() => upd(p.userId, "assists", -1)}
                          onInc={() => upd(p.userId, "assists", isPlayer && p.assists >= totalGoals ? 0 : 1)}
                        />
                        <div className="lu-statrow__cap">пасы</div>
                      </div>
                    </div>
                  )}
                  {!locked && isPlayer && (p.goals > 0 || p.assists > 0) && (
                    <p className="lu-note" style={{ width: "100%", margin: 0 }}>
                      <I.Clock width={12} height={12} style={{ verticalAlign: -2, marginRight: 4 }} />
                      Попадёт в статистику и рейтинг после подтверждения организатором.
                    </p>
                  )}
                </div>
              );
            })}
            {!rows.length && <div className="lu-team__empty">Нет данных по матчу.</div>}
          </div>
        </Card>
        {isPlayer && <p className="lu-note lu-center">Видны только твои данные. Полную статистику матча ведёт организатор.</p>}
      </div>
      <div className="lu-mainbtn">
        <Button block size="lg" loading={busy} onClick={() => void submit()}>
          {isPlayer ? "Отправить" : "Сохранить статистику"}
        </Button>
      </div>
    </div>
  );
}
