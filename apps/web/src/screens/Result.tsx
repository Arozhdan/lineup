/* 5.4 Итог матча. */
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router";
import { api, unwrap } from "@/api/client";
import { useApp } from "@/app/AppContext";
import { Avatar, Badge, Button, Card, ListItem, ListSection, NavBar, roleColorOf } from "@/ds";
import { I } from "@/icons";
import { fmtDay } from "@/lib/format";
import { TEAM_NAME } from "@lineup/shared";

export function Result() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { isOrganizer } = useApp();

  const resultQuery = useQuery({
    queryKey: ["result", id],
    queryFn: () => unwrap(api.games[":id"].result.$get({ param: { id: String(id) } })),
    enabled: !!id,
  });
  const r = resultQuery.data;

  const win = r ? (r.scoreA > r.scoreB ? "a" : r.scoreB > r.scoreA ? "b" : null) : null;
  const winLabel = win ? `${TEAM_NAME[win]} победили` : "Ничья";

  const statSub = (goals: number, assists: number) => `${goals} гол · ${assists} пас`;

  return (
    <div className="lu-scr">
      <NavBar title="Итог матча" onBack={() => navigate(-1)} backLabel="Назад" />
      <div className="lu-scr__body">
        {r && (
          <>
            <div className="lu-result-hero">
              <Badge variant={win ? "success" : "neutral"} solid={!!win}>
                {winLabel}
              </Badge>
              <div className="lu-result-score">
                {r.scoreA} : {r.scoreB}
              </div>
              <div className="lu-muted">
                {r.title} · {fmtDay(r.startsAt)}
              </div>
            </div>

            {r.mvp && (
              <Card pad>
                <div className="lu-row" style={{ gap: 14 }}>
                  <Avatar
                    name={r.mvp.name}
                    src={r.mvp.photoUrl || undefined}
                    size={52}
                    positionBadge={r.mvp.primaryPos ?? undefined}
                    positionColor={r.mvp.primaryPos ? roleColorOf(r.mvp.primaryPos) : undefined}
                  />
                  <div className="lu-grow">
                    <div className="lu-section-label">MVP матча</div>
                    <div style={{ fontSize: 17, fontWeight: 600 }}>{r.mvp.name}</div>
                    <div className="lu-muted">{statSub(r.mvp.goals, r.mvp.assists)}</div>
                  </div>
                  <I.Trophy width={28} height={28} style={{ color: "#E8B923" }} />
                </div>
              </Card>
            )}

            {r.top.length > 0 && (
              <ListSection label="Лучшие в матче">
                {r.top.map((p) => (
                  <ListItem
                    key={p.id}
                    leading={<Avatar name={p.name} src={p.photoUrl || undefined} size={34} />}
                    title={p.name}
                    subtitle={statSub(p.goals, p.assists)}
                    trailing={<Badge variant="success">⚽ {p.goals}</Badge>}
                  />
                ))}
              </ListSection>
            )}

            <div className="lu-stack lu-stack--sm">
              <Button
                block
                leadingIcon={<I.Star width={18} height={18} />}
                disabled={!r.voteWindowOpen}
                onClick={() => navigate(`/game/${id}/mvp`)}
              >
                {r.voteWindowOpen ? "Голосовать за MVP" : "Голосование закрыто"}
              </Button>
              <div className="lu-form-grid">
                <Button variant="secondary" leadingIcon={<I.BarChart width={16} height={16} />} onClick={() => navigate(`/game/${id}/stats`)}>
                  Статистика
                </Button>
                <Button variant="secondary" leadingIcon={<I.Camera width={16} height={16} />} onClick={() => navigate(`/game/${id}/gallery`)}>
                  Фото
                </Button>
              </div>
              {isOrganizer && (
                <Button block variant="secondary" leadingIcon={<I.Wallet width={16} height={16} />} onClick={() => navigate(`/game/${id}/reconcile`)}>
                  Сверка оплат
                </Button>
              )}
              <p className="lu-note lu-center">Очки начислены автоматически · окно правок 24 ч.</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
