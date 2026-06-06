/* 3.4 Статистика (season-scoped). */
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { api, unwrap } from "@/api/client";
import { Card, NavBar, PositionBadge, Stat, roleColorOf } from "@/ds";
import { relColor } from "@/ds/extras";

export function StatsScreen() {
  const navigate = useNavigate();
  const statsQuery = useQuery({
    queryKey: ["me", "stats"],
    queryFn: () => unwrap(api.me.stats.$get()),
  });

  const d = statsQuery.data;
  const games = d?.games ?? 0;
  const winRate = games ? Math.round((d!.wins / games) * 100) : 0;
  const drawRate = games ? Math.round((d!.draws / games) * 100) : 0;
  const perGame = (n: number) => (games ? (n / games).toFixed(2) : "0.00");
  const rel = d?.reliability;

  return (
    <div className="lu-scr">
      <NavBar
        title="Статистика"
        subtitle={d?.season ? `Сезон · ${d.season}` : undefined}
        onBack={() => navigate(-1)}
        backLabel="Профиль"
      />
      <div className="lu-scr__body">
        {statsQuery.isPending && (
          <>
            <div className="lu-card lu-card--pad lu-skel" style={{ height: 96 }} />
            <div className="lu-skel" style={{ height: 120, borderRadius: "var(--radius-lg)" }} />
          </>
        )}
        {d && (
          <>
            <Card pad>
              <div className="lu-row lu-row--between" style={{ alignItems: "flex-end" }}>
                <Stat value={winRate + "%"} label="процент побед" size="lg" color="var(--accent)" />
                <div style={{ textAlign: "right" }}>
                  <div className="lu-row" style={{ gap: 14 }}>
                    <Stat value={d.wins} label="В" size="sm" color="var(--success)" />
                    <Stat value={d.draws} label="Н" size="sm" />
                    <Stat value={d.losses} label="П" size="sm" color="var(--danger)" />
                  </div>
                </div>
              </div>
              <div className="lu-bar" style={{ marginTop: 14 }}>
                <div className="lu-bar__track" style={{ display: "flex", background: "var(--danger)" }}>
                  <div style={{ width: winRate + "%", background: "var(--success)" }} />
                  <div style={{ width: drawRate + "%", background: "var(--gray-400)" }} />
                </div>
              </div>
            </Card>

            <div className="lu-tiles">
              <div className="lu-tile">
                <span className="lu-tile__v">{d.goals}</span>
                <span className="lu-tile__l">голов</span>
                <span className="lu-tile__hint">⌀ {perGame(d.goals)} за игру</span>
              </div>
              <div className="lu-tile">
                <span className="lu-tile__v">{d.assists}</span>
                <span className="lu-tile__l">передач</span>
                <span className="lu-tile__hint">⌀ {perGame(d.assists)} за игру</span>
              </div>
              <div className="lu-tile">
                <span className="lu-tile__v">{d.streak}</span>
                <span className="lu-tile__l">серия без поражений</span>
              </div>
              <div className="lu-tile">
                <span className="lu-tile__v">{d.mvp}</span>
                <span className="lu-tile__l">раз признан MVP</span>
              </div>
            </div>

            {d.posSplit.length > 0 && (
              <Card pad>
                <div className="lu-section-label" style={{ marginBottom: 12 }}>
                  На каких позициях играл
                </div>
                <div className="lu-hbars">
                  {d.posSplit.map((p) => (
                    <div className="lu-hbar" key={p.code}>
                      <span className="lu-hbar__lbl">
                        <PositionBadge code={p.code} />
                      </span>
                      <div className="lu-hbar__track">
                        <div className="lu-hbar__fill" style={{ width: p.pct + "%", background: roleColorOf(p.code) }} />
                      </div>
                      <span className="lu-hbar__val">{p.games}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {rel && (
              <Card pad>
                <div className="lu-row lu-row--between" style={{ marginBottom: 6 }}>
                  <span className="lu-section-label">Надёжность</span>
                  <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, color: relColor(rel.reliability) }}>
                    {rel.reliability}%
                  </span>
                </div>
                <p className="lu-note" style={{ padding: 0 }}>
                  {rel.signups} записей · {rel.attended} явок · {rel.lateCancels} поздн. отмен · {rel.noShows} неявок. Высокая
                  надёжность даёт приоритет в листе ожидания.
                </p>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
