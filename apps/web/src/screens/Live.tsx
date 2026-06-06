/* 5.2 Живое табло (signature). */
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router";
import { api, unwrap } from "@/api/client";
import { useAction, useApp } from "@/app/AppContext";
import { Avatar, Button, Card, NavBar, PositionBadge, Sheet } from "@/ds";
import { I } from "@/icons";
import { fmtClock } from "@/lib/format";
import { TEAM_NAME, type TeamSide } from "@lineup/shared";

type TeamsData = Awaited<ReturnType<typeof unwrap<ReturnType<(typeof api.games)[":id"]["teams"]["$get"]>>>>;
type TeamPlayer = TeamsData["a"][number];

type GoalStep = { side: TeamSide; scorer?: TeamPlayer };

export function Live() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { isOrganizer } = useApp();
  const run = useAction();

  const [tick, setTick] = useState(0);
  const [sheet, setSheet] = useState<GoalStep | null>(null);

  const liveQuery = useQuery({
    queryKey: ["live", id],
    queryFn: () => unwrap(api.games[":id"].live.$get({ param: { id: String(id) } })),
    enabled: !!id,
    refetchInterval: 3000,
  });
  const data = liveQuery.data;

  const teamsQuery = useQuery({
    queryKey: ["teams", id],
    queryFn: () => unwrap(api.games[":id"].teams.$get({ param: { id: String(id) } })),
    enabled: !!id && isOrganizer,
  });

  // Local seconds tick between polls.
  useEffect(() => {
    if (!data?.startedAt || data.finishedAt || data.paused) return;
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [data?.startedAt, data?.finishedAt, data?.paused]);

  useEffect(() => {
    setTick(0);
  }, [liveQuery.dataUpdatedAt]);

  const displaySec = data ? data.clock + (data.paused || data.finishedAt || !data.startedAt ? 0 : tick) : 0;

  const invalidate = [["live", id], ["game", id]];

  const togglePause = () =>
    void run(
      () =>
        data?.paused
          ? unwrap(api.games[":id"].resume.$post({ param: { id: String(id) } }))
          : unwrap(api.games[":id"].pause.$post({ param: { id: String(id) } })),
      { invalidate },
    );

  const addGoal = (side: TeamSide, scorerId: number | null, assistId: number | null, ownGoal: boolean) => {
    void run(
      () => unwrap(api.games[":id"].events.$post({ param: { id: String(id) }, json: { team: side, scorerId, assistId, ownGoal } })),
      { invalidate },
    );
    setSheet(null);
  };

  const delGoal = (eventId: number) =>
    void run(() => unwrap(api.games[":id"].events[":eventId"].$delete({ param: { id: String(id), eventId: String(eventId) } })), { invalidate });

  const finish = async () => {
    const ok = await run(() => unwrap(api.games[":id"].finish.$post({ param: { id: String(id) } })), { invalidate });
    if (ok) navigate(`/game/${id}/result`, { replace: true });
  };

  const teamPlayers = (side: TeamSide): TeamPlayer[] => {
    const t = teamsQuery.data;
    if (!t) return [];
    const list = side === "a" ? t.a : t.b;
    return list.length ? list : t.unassigned;
  };

  const scoreA = data?.scoreA ?? 0;
  const scoreB = data?.scoreB ?? 0;
  const events = data?.events ?? [];
  const cleanSheet = events.length > 0 && (scoreA === 0 || scoreB === 0);

  return (
    <div className="lu-scr">
      <NavBar
        title="Матч идёт"
        onBack={() => navigate(-1)}
        backLabel="Назад"
        trailing={
          isOrganizer && data?.startedAt && !data.finishedAt ? (
            <button className="lu-navbar__btn" onClick={togglePause}>
              {data.paused ? "Продолжить" : "Пауза"}
            </button>
          ) : null
        }
      />
      <div className="lu-scr__body">
        <div className="lu-scoreboard">
          <div className="lu-center">
            <span className="lu-scoreboard__live">
              <span className="lu-scoreboard__dot" />
              {data?.finishedAt ? "Матч завершён" : data?.paused ? "Пауза" : "В прямом эфире"}
            </span>
          </div>
          <div className="lu-scoreboard__main">
            <div className="lu-scoreboard__team">
              <div className="lu-scoreboard__crest" style={{ background: "var(--grad-pitch)" }}>
                А
              </div>
              <div className="lu-scoreboard__tname">{TEAM_NAME.a}</div>
            </div>
            <div>
              <div className="lu-row" style={{ gap: 10 }}>
                <span className="lu-scoreboard__score">{scoreA}</span>
                <span className="lu-scoreboard__sep">:</span>
                <span className="lu-scoreboard__score">{scoreB}</span>
              </div>
            </div>
            <div className="lu-scoreboard__team">
              <div className="lu-scoreboard__crest" style={{ background: "linear-gradient(135deg,#3B82F6,#2563EB)" }}>
                Б
              </div>
              <div className="lu-scoreboard__tname">{TEAM_NAME.b}</div>
            </div>
          </div>
          <div className="lu-scoreboard__clock">
            {fmtClock(displaySec)} · идёт матч{cleanSheet ? " · 🧤 сухой матч" : ""}
          </div>
        </div>

        {isOrganizer && !data?.finishedAt && (
          <div className="lu-form-grid">
            {(["a", "b"] as const).map((side) => (
              <button key={side} className="lu-tally-btn" onClick={() => setSheet({ side })}>
                <span className="lu-tally-btn__plus">+ ⚽</span>
                <span className="lu-tally-btn__l">Гол · {TEAM_NAME[side]}</span>
              </button>
            ))}
          </div>
        )}

        <div>
          <div className="lu-section-label" style={{ paddingLeft: 2, marginBottom: 4 }}>
            Хронология
          </div>
          {events.length ? (
            <Card pad style={{ padding: "6px 16px" }}>
              {events.map((e) => (
                <div className="lu-event-row" key={e.id}>
                  <span className="lu-event-row__min">{e.minute}'</span>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: e.team === "a" ? "var(--accent)" : "#3B82F6", flex: "none" }} />
                  <span className="lu-grow">
                    {e.ownGoal ? (
                      <>
                        🔄 <b style={{ color: "var(--text)" }}>Автогол</b> <span className="lu-muted">· {TEAM_NAME[e.team as TeamSide]}</span>
                      </>
                    ) : (
                      <>
                        ⚽ <b style={{ color: "var(--text)" }}>{e.scorer}</b>
                        {e.assist && <span className="lu-muted"> · пас {e.assist}</span>}
                        <span className="lu-muted"> · {TEAM_NAME[e.team as TeamSide]}</span>
                      </>
                    )}
                  </span>
                  {isOrganizer && !data?.finishedAt && (
                    <button className="lu-iconbtn" style={{ width: 26, height: 26, color: "var(--text-hint)" }} onClick={() => delGoal(e.id)}>
                      <I.X width={14} height={14} />
                    </button>
                  )}
                </div>
              ))}
            </Card>
          ) : (
            <p className="lu-note lu-center">Голов пока нет.</p>
          )}
        </div>
      </div>

      {isOrganizer && (
        <div className="lu-mainbtn">
          {data?.finishedAt ? (
            <Button block size="lg" leadingIcon={<I.Trophy width={18} height={18} />} onClick={() => navigate(`/game/${id}/result`)}>
              Матч завершён · к итогу
            </Button>
          ) : (
            <Button block size="lg" variant="destructive" onClick={() => void finish()}>
              Завершить матч
            </Button>
          )}
        </div>
      )}

      <Sheet
        open={!!sheet}
        onClose={() => setSheet(null)}
        title={sheet ? (sheet.scorer ? "Кто отдал пас?" : `Гол · ${TEAM_NAME[sheet.side]}`) : ""}
      >
        {sheet && !sheet.scorer && (
          <>
            <div className="lu-pool">
              {teamPlayers(sheet.side).map((p) => (
                <button key={p.id} className="lu-pool-card" onClick={() => setSheet({ ...sheet, scorer: p })}>
                  <Avatar name={p.name} src={p.photoUrl || undefined} size={36} />
                  <span className="lu-grow" style={{ fontSize: 15, color: "var(--text)" }}>
                    {p.name}
                  </span>
                  {p.position && <PositionBadge code={p.position} />}
                </button>
              ))}
            </div>
            <Button
              block
              variant="ghost"
              style={{ marginTop: 8 }}
              leadingIcon={<I.Repeat width={16} height={16} />}
              onClick={() => addGoal(sheet.side, null, null, true)}
            >
              Автогол соперника
            </Button>
          </>
        )}
        {sheet && sheet.scorer && (
          <>
            <div className="lu-pool">
              {teamPlayers(sheet.side)
                .filter((p) => p.id !== sheet.scorer!.id)
                .map((p) => (
                  <button key={p.id} className="lu-pool-card" onClick={() => addGoal(sheet.side, sheet.scorer!.id, p.id, false)}>
                    <Avatar name={p.name} src={p.photoUrl || undefined} size={36} />
                    <span className="lu-grow" style={{ fontSize: 15, color: "var(--text)" }}>
                      {p.name}
                    </span>
                    {p.position && <PositionBadge code={p.position} />}
                  </button>
                ))}
            </div>
            <Button block variant="ghost" style={{ marginTop: 8 }} onClick={() => addGoal(sheet.side, sheet.scorer!.id, null, false)}>
              Без паса
            </Button>
          </>
        )}
      </Sheet>
    </div>
  );
}
