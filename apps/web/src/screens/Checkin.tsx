/* 5.1 Чек-ин на поле. */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router";
import { api, unwrap } from "@/api/client";
import { useAction } from "@/app/AppContext";
import { Avatar, Button, Card, NavBar, PositionBadge } from "@/ds";
import { I } from "@/icons";
import { fmtTime, plural } from "@/lib/format";

export function Checkin() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const run = useAction();
  const [busy, setBusy] = useState(false);

  const gameQuery = useQuery({
    queryKey: ["game", id],
    queryFn: () => unwrap(api.games[":id"].$get({ param: { id: String(id) } })),
    enabled: !!id,
  });
  const g = gameQuery.data;
  const roster = g?.roster ?? [];
  const here = roster.filter((p) => p.checkedIn).length;

  const toggle = (userId: number, present: boolean) =>
    void run(() => unwrap(api.games[":id"].checkin.$post({ param: { id: String(id) }, json: { userId, present } })), {
      invalidate: [["game", id]],
    });

  const start = async () => {
    setBusy(true);
    const ok = await run(() => unwrap(api.games[":id"].start.$post({ param: { id: String(id) } })), {
      invalidate: [["game", id], ["live", id]],
    });
    setBusy(false);
    if (ok) navigate(`/game/${id}/live`);
  };

  return (
    <div className="lu-scr">
      <NavBar
        title="Чек-ин"
        subtitle={g ? `${g.title} · начало в ${fmtTime(g.startsAt)}` : undefined}
        onBack={() => navigate(-1)}
        backLabel="Назад"
      />
      <div className="lu-scr__body">
        <Card pad>
          <div className="lu-row lu-row--between">
            <div>
              <div className="lu-muted">На месте</div>
              <div className="lu-display" style={{ fontSize: 30, color: "var(--text)" }}>
                {here}
                <span style={{ fontSize: 18, color: "var(--text-hint)" }}>/{roster.length}</span>
              </div>
            </div>
            {g && (
              <div className="lu-countdown">
                <I.Clock width={14} height={14} />
                старт в {fmtTime(g.startsAt)}
              </div>
            )}
          </div>
        </Card>
        <div className="lu-section-label" style={{ paddingLeft: 2 }}>
          Отметь, кто пришёл
        </div>
        <Card>
          <div className="lu-pool">
            {roster.map((p) => {
              const on = p.checkedIn;
              return (
                <button key={p.signupId} className="lu-pool-card" onClick={() => toggle(p.id, !on)}>
                  <Avatar name={p.name} src={p.photoUrl || undefined} size={38} online={on} />
                  <span className="lu-grow">
                    <span style={{ display: "block", fontSize: 15, color: "var(--text)" }}>{p.name}</span>
                    <span style={{ fontSize: 12, color: on ? "var(--success)" : "var(--text-hint)" }}>{on ? "на поле" : "ещё не пришёл"}</span>
                  </span>
                  {p.position && <PositionBadge code={p.position} />}
                  <span
                    className="lu-radio__dot"
                    data-on={on}
                    style={on ? { borderColor: "var(--accent)", background: "var(--accent)", display: "grid", placeItems: "center" } : undefined}
                  >
                    {on && <I.Check width={13} height={13} style={{ color: "#fff" }} />}
                  </span>
                </button>
              );
            })}
            {!roster.length && <div className="lu-team__empty">В составе пока никого.</div>}
          </div>
        </Card>
        <p className="lu-note lu-center">Неявка без отмены снижает надёжность игрока.</p>
      </div>
      <div className="lu-mainbtn">
        {g?.startedAt ? (
          <Button block size="lg" leadingIcon={<I.Whistle width={18} height={18} />} onClick={() => navigate(`/game/${id}/live`)}>
            К табло
          </Button>
        ) : (
          <Button block size="lg" leadingIcon={<I.Whistle width={18} height={18} />} loading={busy} onClick={() => void start()}>
            Начать матч · {here} {plural(here, "игрок", "игрока", "игроков")}
          </Button>
        )}
      </div>
    </div>
  );
}
