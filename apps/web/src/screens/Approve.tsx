/* 4.3 Заявки на одобрение. */
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router";
import { api, unwrap } from "@/api/client";
import { useAction } from "@/app/AppContext";
import { Avatar, Button, Card, EmptyState, NavBar } from "@/ds";
import { roleColorOf } from "@/ds";
import { relColor } from "@/ds/extras";
import { I } from "@/icons";
import { plural } from "@/lib/format";
import { LEVEL_LABEL } from "@lineup/shared";

export function Approve() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const run = useAction();

  const gameQuery = useQuery({
    queryKey: ["game", id],
    queryFn: () => unwrap(api.games[":id"].$get({ param: { id: String(id) } })),
    enabled: !!id,
  });
  const g = gameQuery.data;
  // Pending requests are approved/rejected; waitlisted players are promoted.
  const list = g
    ? [
        ...g.pending.map((p) => ({ ...p, waitlisted: false })),
        ...g.waitlist.map((p) => ({ ...p, waitlisted: true })),
      ]
    : [];

  const decide = (userId: number, accept: boolean, waitlisted: boolean) =>
    void run(
      () =>
        waitlisted
          ? accept
            ? unwrap(api.games[":id"].promote.$post({ param: { id: String(id) }, json: { userId } }))
            : unwrap(api.games[":id"].kick.$post({ param: { id: String(id) }, json: { userId } }))
          : unwrap(api.games[":id"].approve.$post({ param: { id: String(id) }, json: { userId, accept } })),
      {
        ok: accept ? "Игрок в составе" : "Заявка отклонена",
        invalidate: [["game", id], ["games"]],
      },
    );

  return (
    <div className="lu-scr">
      <NavBar title="Заявки" onBack={() => navigate(-1)} backLabel="Состав" />
      <div className="lu-scr__body">
        <p className="lu-lede" style={{ padding: "0 2px" }}>
          Игра с ручным одобрением. Просмотри заявки — надёжность, рейтинг и уровень помогут принять решение.
        </p>
        {g && !list.length && <EmptyState icon={<I.Inbox />} title="Заявок нет" description="Новые заявки появятся здесь." />}
        {list.map((p) => (
          <Card pad key={p.signupId}>
            <div className="lu-row" style={{ gap: 12 }}>
              <Avatar
                name={p.name}
                src={p.photoUrl || undefined}
                size={44}
                positionBadge={p.position ?? undefined}
                positionColor={p.position ? roleColorOf(p.position) : undefined}
              />
              <div className="lu-grow">
                <div style={{ fontSize: 16, fontWeight: 600 }}>{p.name}</div>
                <div className="lu-muted">
                  {p.waitlisted ? "лист ожидания · " : ""}
                  <span style={{ color: relColor(p.reliability), fontWeight: 600 }}>надёжность {p.reliability}%</span>
                  {" · "}{p.points} {plural(p.points, "очко", "очка", "очков")}
                  {p.position ? ` · ${p.position}` : ""}
                </div>
                <div className="lu-muted" style={{ fontSize: 12 }}>
                  уровень {p.level} — {LEVEL_LABEL[p.level] ?? "Средний"} (самооценка)
                </div>
              </div>
            </div>
            <div className="lu-row" style={{ marginTop: 12, gap: 8 }}>
              <Button size="sm" variant="secondary" className="lu-grow" onClick={() => decide(p.id, false, p.waitlisted)}>
                {p.waitlisted ? "Убрать" : "Отклонить"}
              </Button>
              <Button size="sm" className="lu-grow" onClick={() => decide(p.id, true, p.waitlisted)}>
                {p.waitlisted ? "В состав" : "Принять"}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
