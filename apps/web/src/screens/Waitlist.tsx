/* 2.5 Лист ожидания. */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router";
import { api, unwrap } from "@/api/client";
import { useApp, useAction } from "@/app/AppContext";
import { Badge, Button, Card, ListItem, ListSection, NavBar, PositionBadge } from "@/ds";
import { fmtWhen } from "@/lib/format";
import { fetchGameDetail } from "./GameDetail";

export function Waitlist() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { me } = useApp();
  const run = useAction();
  const [busy, setBusy] = useState(false);

  const gameQuery = useQuery({
    queryKey: ["game", id],
    queryFn: () => fetchGameDetail(id),
    enabled: !!id,
  });
  const g = gameQuery.data;

  if (!g) {
    return (
      <div className="lu-scr">
        <NavBar title="Лист ожидания" onBack={() => navigate(-1)} backLabel="Назад" />
        <div className="lu-scr__body">
          <div className="lu-skel" style={{ height: 80, borderRadius: "var(--radius-lg)" }} />
          <div className="lu-skel" style={{ height: 200, borderRadius: "var(--radius-lg)" }} />
        </div>
      </div>
    );
  }

  const inQueue = g.my?.status === "waitlist";
  // The queue list excludes me — append my own row separately when I'm queued.
  const queue = g.waitlist.filter((p) => p.id !== me?.id);

  const join = async () => {
    setBusy(true);
    const ok = await run(
      () => unwrap(api.games[":id"].waitlist.$post({ param: { id: String(id) }, json: { position: me?.primaryPos ?? null, guests: 0 } })),
      { ok: "Ты в листе ожидания", invalidate: [["games"], ["game", id]] },
    );
    setBusy(false);
    if (ok) navigate(-1);
  };

  const leave = async () => {
    setBusy(true);
    const ok = await run(() => unwrap(api.games[":id"].signup.cancel.$post({ param: { id: String(id) } })), {
      invalidate: [["games"], ["game", id]],
    });
    setBusy(false);
    if (ok) navigate(-1);
  };

  return (
    <div className="lu-scr">
      <NavBar title="Лист ожидания" onBack={() => navigate(-1)} backLabel="Назад" />
      <div className="lu-scr__body">
        <div style={{ padding: "0 2px" }}>
          <h2 className="lu-h1">Состав заполнен</h2>
          <p className="lu-lede">
            Встань в очередь — если кто-то отменит запись, тебя автоматически поставят в состав и пришлют уведомление.
          </p>
        </div>
        <Card pad>
          <div className="lu-row lu-row--between">
            <div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{g.title}</div>
              <div className="lu-muted">
                {fmtWhen(g.startsAt)} · {g.venueShort}
              </div>
            </div>
            <Badge variant="warning" solid>
              Полный
            </Badge>
          </div>
        </Card>
        <div className="lu-section-label" style={{ paddingLeft: 2 }}>
          В очереди · {queue.length}
          {inQueue ? " + ты" : ""}
        </div>
        <ListSection>
          {queue.map((p, i) => (
            <ListItem
              key={p.signupId}
              leading={<span className="lu-rank">{i + 1}</span>}
              title={p.name}
              trailing={p.position ? <PositionBadge code={p.position} /> : null}
            />
          ))}
          {inQueue && (
            <ListItem
              leading={
                <span className="lu-rank" data-top="3">
                  {queue.length + 1}
                </span>
              }
              title={`${me?.name ?? "Вы"} (вы)`}
              trailing={<Badge variant="accent">ожидание</Badge>}
            />
          )}
        </ListSection>
      </div>
      <div className="lu-mainbtn">
        {inQueue ? (
          <Button block size="lg" variant="secondary" loading={busy} onClick={() => void leave()}>
            Выйти из очереди
          </Button>
        ) : (
          <Button block size="lg" loading={busy} onClick={() => void join()}>
            Встать в очередь
          </Button>
        )}
      </div>
    </div>
  );
}
