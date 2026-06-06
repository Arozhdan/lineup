/* 2.7 Мои игры (tab root). */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { api, unwrap } from "@/api/client";
import { Badge, Button, Card, EmptyState, NavBar, SegmentedControl } from "@/ds";
import { MatchCardRU } from "@/ds/extras";
import { I } from "@/icons";
import { fmtCaps, fmtDay } from "@/lib/format";

const MY_STATUS_NOTE: Record<string, string> = {
  pending: "заявка на рассмотрении",
  waitlist: "в листе ожидания",
};

export function MyGames() {
  const navigate = useNavigate();
  const [seg, setSeg] = useState<"upcoming" | "past">("upcoming");

  const gamesQuery = useQuery({
    queryKey: ["games"],
    queryFn: () => unwrap(api.games.$get()),
  });
  const pastQuery = useQuery({
    queryKey: ["games", "past"],
    queryFn: () => unwrap(api.games.past.$get()),
    enabled: seg === "past",
  });

  const mine = (gamesQuery.data ?? []).filter((g) => g.myStatus);

  return (
    <div className="lu-scr">
      <NavBar plain title="Мои игры" />
      <div className="lu-scr__body lu-scr__body--tab">
        <SegmentedControl
          value={seg}
          onChange={setSeg}
          options={[
            { value: "upcoming", label: "Предстоящие" },
            { value: "past", label: "Прошедшие" },
          ]}
        />

        {seg === "upcoming" ? (
          mine.length ? (
            <div className="lu-stack">
              {mine.map((g) => {
                const note = g.myStatus ? MY_STATUS_NOTE[g.myStatus] : undefined;
                return (
                  <div key={g.id}>
                    <MatchCardRU
                      title={g.title}
                      caps={fmtCaps(g.startsAt)}
                      venue={g.venueShort}
                      format={g.format}
                      filled={g.filled}
                      total={g.capacity}
                      price={g.price}
                      status={g.status}
                      youIn={g.myStatus === "confirmed"}
                      onClick={() => navigate(`/game/${g.id}`)}
                    />
                    {note && (
                      <p className="lu-note" style={{ paddingLeft: 2, marginTop: 4 }}>
                        {note}
                      </p>
                    )}
                  </div>
                );
              })}
              <p className="lu-note lu-center">Напомним за 2 часа до начала · чек-ин откроется на поле.</p>
            </div>
          ) : (
            <EmptyState
              icon={<I.Calendar />}
              title="Пока нет записей"
              description="Найди игру в ленте и запишись — она появится здесь."
              action={<Button onClick={() => navigate("/")}>В ленту игр</Button>}
            />
          )
        ) : (
          <div className="lu-stack">
            {pastQuery.isPending &&
              [0, 1].map((i) => (
                <div key={i} className="lu-skel" style={{ height: 90, borderRadius: "var(--radius-lg)" }} />
              ))}
            {(pastQuery.data ?? []).map((g) => (
              <Card key={g.id} pad onClick={() => navigate(`/game/${g.id}/result`)}>
                <div className="lu-row lu-row--between">
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>{g.title}</div>
                    <div className="lu-muted">
                      {fmtDay(g.startsAt)} · {g.venue}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="lu-display" style={{ fontSize: 20, color: "var(--text)" }}>
                      {g.score}
                    </div>
                    <span className="lu-form-pill" data-r={g.result} style={{ display: "inline-grid", marginTop: 2 }}>
                      {g.result}
                    </span>
                  </div>
                </div>
                {(g.mvp || g.myGoals > 0 || g.myAssists > 0) && (
                  <div className="lu-row" style={{ marginTop: 10, gap: 8 }}>
                    {g.mvp && (
                      <Badge variant="warning">
                        <I.Star width={12} height={12} />
                        MVP
                      </Badge>
                    )}
                    {g.myGoals > 0 && <Badge variant="success">⚽ {g.myGoals}</Badge>}
                    {g.myAssists > 0 && <Badge variant="info">пас {g.myAssists}</Badge>}
                  </div>
                )}
              </Card>
            ))}
            {!pastQuery.isPending && !(pastQuery.data ?? []).length && (
              <EmptyState icon={<I.History />} title="Нет завершённых игр" description="Сыграй матч — он появится в истории." />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
