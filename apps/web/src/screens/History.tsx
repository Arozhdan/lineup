/* 3.5 История игр. */
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { api, unwrap } from "@/api/client";
import { Badge, Card, EmptyState, NavBar } from "@/ds";
import { I } from "@/icons";
import { fmtDay } from "@/lib/format";

export function HistoryScreen() {
  const navigate = useNavigate();
  const pastQuery = useQuery({
    queryKey: ["games", "past"],
    queryFn: () => unwrap(api.games.past.$get()),
  });

  const list = pastQuery.data ?? [];

  return (
    <div className="lu-scr">
      <NavBar title="История игр" onBack={() => navigate(-1)} backLabel="Профиль" />
      <div className="lu-scr__body">
        {pastQuery.isPending && (
          <div className="lu-stack">
            {[0, 1, 2].map((i) => (
              <div key={i} className="lu-card lu-card--pad lu-skel" style={{ height: 64 }} />
            ))}
          </div>
        )}
        {!pastQuery.isPending && (
          <>
            <div className="lu-section-label" style={{ paddingLeft: 2 }}>
              {list.length} последних матчей
            </div>
            <div className="lu-stack">
              {list.map((g) => (
                <Card key={g.id} pad onClick={() => navigate(`/game/${g.id}/result`)}>
                  <div className="lu-row lu-row--between">
                    <div className="lu-row" style={{ gap: 10 }}>
                      <span className="lu-form-pill" data-r={g.result} style={{ width: 30, height: 30, fontSize: 13 }}>
                        {g.result}
                      </span>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 600 }}>{g.title}</div>
                        <div className="lu-muted">
                          {fmtDay(g.startsAt)} · {g.venue}
                        </div>
                      </div>
                    </div>
                    <div className="lu-display" style={{ fontSize: 19, color: "var(--text)" }}>
                      {g.score}
                    </div>
                  </div>
                  {(g.myGoals > 0 || g.myAssists > 0 || g.mvp) && (
                    <div className="lu-row" style={{ marginTop: 10, gap: 8 }}>
                      {g.mvp && (
                        <Badge variant="warning">
                          <I.Star width={11} height={11} />
                          MVP
                        </Badge>
                      )}
                      {g.myGoals > 0 && <Badge variant="success">⚽ {g.myGoals}</Badge>}
                      {g.myAssists > 0 && <Badge variant="info">пас {g.myAssists}</Badge>}
                    </div>
                  )}
                </Card>
              ))}
              {!list.length && (
                <EmptyState
                  icon={<I.History />}
                  title="Пока нет сыгранных матчей"
                  description="Запишись на игру — она появится здесь после финального свистка."
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
