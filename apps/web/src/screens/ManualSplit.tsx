/* 4.5 Ручное / авто деление команд. */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { api, unwrap } from "@/api/client";
import { useAction } from "@/app/AppContext";
import { Avatar, Button, Card, NavBar, PositionBadge } from "@/ds";
import { I } from "@/icons";
import { TEAM_NAME, type TeamSide } from "@lineup/shared";

type Detail = Awaited<ReturnType<typeof unwrap<ReturnType<(typeof api.games)[":id"]["$get"]>>>>;
type RosterRow = Detail["roster"][number];

export function ManualSplit() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const auto = params.get("auto") === "1";
  const run = useAction();
  const [busy, setBusy] = useState(false);

  const gameQuery = useQuery({
    queryKey: ["game", id],
    queryFn: () => unwrap(api.games[":id"].$get({ param: { id: String(id) } })),
    enabled: !!id,
  });
  const g = gameQuery.data;
  const roster = g?.roster ?? [];
  const teamA = roster.filter((p) => p.team === "a");
  const teamB = roster.filter((p) => p.team === "b");
  const pool = roster.filter((p) => !p.team);

  const invalidate = [["game", id]];

  const assign = (userId: number, team: TeamSide | null) =>
    void run(() => unwrap(api.games[":id"].teams.assign.$post({ param: { id: String(id) }, json: { userId, team } })), { invalidate });

  const reshuffle = async () => {
    setBusy(true);
    await run(() => unwrap(api.games[":id"].teams.auto.$post({ param: { id: String(id) } })), { invalidate });
    setBusy(false);
  };

  const rating = (arr: RosterRow[]) => arr.reduce((s, p) => s + (p.level ?? 3), 0);

  const headBg: Record<TeamSide, string> = {
    a: "var(--grad-pitch)",
    b: "linear-gradient(135deg,#3B82F6,#2563EB)",
  };
  const headName: Record<TeamSide, string> = {
    a: `Команда А · ${TEAM_NAME.a.toLowerCase()}`,
    b: `Команда Б · ${TEAM_NAME.b.toLowerCase()}`,
  };

  const teams: Record<TeamSide, RosterRow[]> = { a: teamA, b: teamB };

  return (
    <div className="lu-scr">
      <NavBar
        title={auto ? "Автобаланс" : "Ручное деление"}
        onBack={() => navigate(-1)}
        backLabel="Назад"
        trailing={
          auto ? (
            <button className="lu-navbar__btn" onClick={() => void reshuffle()} disabled={busy}>
              <I.Refresh width={16} height={16} />
              Ещё раз
            </button>
          ) : null
        }
      />
      <div className="lu-scr__body">
        {(["a", "b"] as const).map((side) => (
          <div className="lu-team" key={side}>
            <div className="lu-team__head" style={{ background: headBg[side] }}>
              <span>{headName[side]}</span>
              <span className="lu-team__rating">
                <I.Star width={13} height={13} />
                {rating(teams[side])} · {teams[side].length}
              </span>
            </div>
            <div className="lu-team__body">
              {teams[side].length ? (
                teams[side].map((p) => (
                  <div className="lu-team__slot" key={p.signupId}>
                    <Avatar name={p.name} src={p.photoUrl || undefined} size={30} />
                    <span className="lu-grow" style={{ fontSize: 14 }}>
                      {p.name}
                    </span>
                    {p.position && <PositionBadge code={p.position} />}
                    {auto ? (
                      <button className="lu-iconbtn" style={{ width: 28, height: 28 }} onClick={() => assign(p.id, side === "a" ? "b" : "a")}>
                        <I.Repeat width={15} height={15} />
                      </button>
                    ) : (
                      <button className="lu-iconbtn" style={{ width: 28, height: 28 }} onClick={() => assign(p.id, null)}>
                        <I.X width={15} height={15} />
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <div className="lu-team__empty">Пусто — добавь игроков снизу</div>
              )}
            </div>
          </div>
        ))}

        {!auto && pool.length > 0 && (
          <div>
            <div className="lu-section-label" style={{ margin: "4px 2px 8px" }}>
              Не распределены · {pool.length}
            </div>
            <Card>
              <div className="lu-pool">
                {pool.map((p) => (
                  <div key={p.signupId} className="lu-pool-card" style={{ cursor: "default" }}>
                    <Avatar name={p.name} src={p.photoUrl || undefined} size={34} />
                    <span className="lu-grow" style={{ fontSize: 15, color: "var(--text)" }}>
                      {p.name}
                    </span>
                    {p.position && <PositionBadge code={p.position} />}
                    <Button size="sm" variant="secondary" onClick={() => assign(p.id, "a")}>
                      → А
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => assign(p.id, "b")}>
                      → Б
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {auto && (
          <p className="lu-note lu-center">
            <I.Info width={13} height={13} style={{ verticalAlign: -2, marginRight: 4 }} />
            Команды сбалансированы по уровню. Жми ⇄, чтобы поменять игрока, или «Ещё раз» для нового варианта.
          </p>
        )}
      </div>
      <div className="lu-mainbtn">
        <Button block size="lg" disabled={!teamA.length || !teamB.length} onClick={() => navigate(`/game/${id}/publish`)}>
          Опубликовать составы
        </Button>
      </div>
    </div>
  );
}
