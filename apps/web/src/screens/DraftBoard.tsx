/* 4.7 Драфт-доска (signature). */
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router";
import { api, unwrap } from "@/api/client";
import { useAction, useApp } from "@/app/AppContext";
import { Avatar, Button, Card, NavBar, PositionBadge } from "@/ds";
import { I } from "@/icons";
import type { TeamSide } from "@lineup/shared";

type Detail = Awaited<ReturnType<typeof unwrap<ReturnType<(typeof api.games)[":id"]["$get"]>>>>;
type RosterRow = Detail["roster"][number];

export function DraftBoard() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { isOrganizer } = useApp();
  const run = useAction();
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const autoPickedFor = useRef<number | null>(null);

  const gameQuery = useQuery({
    queryKey: ["game", id],
    queryFn: () => unwrap(api.games[":id"].$get({ param: { id: String(id) } })),
    enabled: !!id,
    refetchInterval: 2000,
  });
  const g = gameQuery.data;
  const draft = g?.draft ?? null;
  const roster = g?.roster ?? [];

  const teamA = roster.filter((p) => p.team === "a");
  const teamB = roster.filter((p) => p.team === "b");
  const pool = roster.filter((p) => !p.team);
  const teams: Record<TeamSide, RosterRow[]> = { a: teamA, b: teamB };

  const capA = draft ? roster.find((p) => p.id === draft.captainA) : undefined;
  const capB = draft ? roster.find((p) => p.id === draft.captainB) : undefined;

  // Local ticking clock for the per-turn timer.
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  const remaining = draft?.turnEndsAt != null ? Math.max(0, draft.turnEndsAt - now) : null;

  const pick = (userId: number) =>
    void run(() => unwrap(api.games[":id"].draft.pick.$post({ param: { id: String(id) }, json: { userId } })), {
      invalidate: [["game", id]],
    });

  // Organizer auto-picks once when the current turn's timer expires.
  useEffect(() => {
    if (!draft || !isOrganizer || draft.turnEndsAt == null || remaining == null) return;
    if (remaining <= 0 && autoPickedFor.current !== draft.turnEndsAt && pool.length) {
      autoPickedFor.current = draft.turnEndsAt;
      pick(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, draft?.turnEndsAt, isOrganizer, pool.length]);

  const done = !draft && teamA.length > 0 && teamB.length > 0;
  const turn = draft?.turn ?? null;
  const turnCap = turn === "a" ? capA : capB;

  return (
    <div className="lu-scr">
      <NavBar title="Драфт команд" onBack={() => navigate(-1)} backLabel="Назад" />
      <div className="lu-scr__body" style={{ gap: 12 }}>
        {draft ? (
          <div className="lu-draft-turn" style={turn === "b" ? { background: "rgba(59,130,246,.14)", color: "#2563EB" } : undefined}>
            <I.Crown width={20} height={20} />
            <span>
              Выбирает <b>{turnCap ? turnCap.first || turnCap.name.split(" ")[0] : "капитан"}</b> · команда {turn === "a" ? "А" : "Б"}
            </span>
            {remaining != null && <span className="lu-draft-turn__timer">0:{String(Math.min(99, remaining)).padStart(2, "0")}</span>}
          </div>
        ) : done ? (
          <div className="lu-toast-inline" style={{ justifyContent: "center" }}>
            <I.CheckCircle width={18} height={18} />
            Драфт завершён — составы готовы
          </div>
        ) : null}

        <div className="lu-form-grid" style={{ gap: 10 }}>
          {(["a", "b"] as const).map((side) => (
            <div
              className="lu-team"
              key={side}
              style={turn === side && draft ? { outline: "2px solid var(--accent)", outlineOffset: 0 } : undefined}
            >
              <div className="lu-team__head" style={{ background: side === "a" ? "var(--grad-pitch)" : "linear-gradient(135deg,#3B82F6,#2563EB)", padding: "9px 11px" }}>
                <span style={{ fontSize: 14 }}>Команда {side === "a" ? "А" : "Б"}</span>
                <span className="lu-team__rating">{teams[side].length}</span>
              </div>
              <div className="lu-team__body" style={{ padding: "4px 0" }}>
                {teams[side].map((p, i) => (
                  <div className="lu-team__slot" key={p.signupId} style={{ padding: "6px 10px", gap: 7 }}>
                    {i === 0 && <I.Crown width={13} height={13} style={{ color: "#E8B923", flex: "none" }} />}
                    <span className="lu-grow" style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {p.first || p.name.split(" ")[0]}
                    </span>
                    {p.position && <PositionBadge code={p.position} />}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {draft ? (
          <div>
            <div className="lu-section-label" style={{ margin: "4px 2px 8px" }}>
              Свободные игроки · {pool.length}
            </div>
            <Card>
              <div className="lu-pool">
                {pool.map((p) => (
                  <button key={p.signupId} className="lu-pool-card" onClick={() => pick(p.id)}>
                    <Avatar name={p.name} src={p.photoUrl || undefined} size={36} />
                    <span className="lu-grow">
                      <span style={{ display: "block", fontSize: 15, color: "var(--text)" }}>{p.name}</span>
                      <span style={{ fontSize: 12, color: "var(--text-hint)" }}>уровень {p.level}</span>
                    </span>
                    {p.position && <PositionBadge code={p.position} />}
                    <span className="lu-pool-card__rt">
                      <I.Plus width={16} height={16} />
                    </span>
                  </button>
                ))}
              </div>
            </Card>
          </div>
        ) : done ? (
          <Button block size="lg" onClick={() => navigate(`/game/${id}/publish`)}>
            Опубликовать составы
          </Button>
        ) : null}
      </div>
    </div>
  );
}
