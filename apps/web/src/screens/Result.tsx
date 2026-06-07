/* 5.4 Итог матча. */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router";
import { api, unwrap } from "@/api/client";
import { useAction, useApp } from "@/app/AppContext";
import { Avatar, Badge, Button, Card, ListItem, ListSection, NavBar, PositionBadge, Sheet, roleColorOf } from "@/ds";
import { I } from "@/icons";
import { fmtDay } from "@/lib/format";
import { TEAM_NAME } from "@lineup/shared";

type Participant = { id: number; name: string; photoUrl: string; position: string | null };

export function Result() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { isOrganizer } = useApp();
  const run = useAction();

  const resultQuery = useQuery({
    queryKey: ["result", id],
    queryFn: () => unwrap(api.games[":id"].result.$get({ param: { id: String(id) } })),
    enabled: !!id,
  });
  const r = resultQuery.data;

  // Participants minus me — the same list MVP voting uses.
  const participantsQuery = useQuery({
    queryKey: ["mvp", id],
    queryFn: () => unwrap(api.games[":id"].mvp.$get({ param: { id: String(id) } })),
    enabled: !!id,
  });
  const participants: Participant[] = participantsQuery.data?.nominees ?? [];

  const [complainOpen, setComplainOpen] = useState(false);
  const [target, setTarget] = useState<Participant | null>(null);
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);

  const closeComplain = () => {
    setComplainOpen(false);
    setTarget(null);
    setReason("");
  };

  const complain = async () => {
    if (!target) return;
    setSending(true);
    const ok = await run(
      () => unwrap(api.complaints.$post({ json: { userId: target.id, gameId: Number(id), reason: reason.trim() } })),
      { ok: "Жалоба отправлена — модераторы её рассмотрят" },
    );
    setSending(false);
    if (ok) closeComplain();
  };

  const win = r ? (r.scoreA > r.scoreB ? "a" : r.scoreB > r.scoreA ? "b" : null) : null;
  const winLabel = win ? `${TEAM_NAME[win]} победили` : "Ничья";

  const statSub = (goals: number, assists: number) => `${goals} гол · ${assists} пас`;

  return (
    <div className="lu-scr">
      <NavBar title="Итог матча" onBack={() => navigate("/")} backLabel="Готово" />
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
                    onClick={() => navigate(`/player/${p.id}`)}
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
              {participants.length > 0 && (
                <Button
                  block
                  variant="ghost"
                  style={{ color: "var(--danger)" }}
                  leadingIcon={<I.AlertTriangle width={16} height={16} />}
                  onClick={() => setComplainOpen(true)}
                >
                  Пожаловаться на игрока
                </Button>
              )}
              <p className="lu-note lu-center">Очки начислены автоматически · окно правок 24 ч.</p>
            </div>
          </>
        )}
      </div>

      <Sheet
        open={complainOpen}
        onClose={closeComplain}
        title={target ? `Жалоба на ${target.name}` : "На кого жалоба?"}
      >
        {!target ? (
          <div className="lu-pool">
            {participants.map((p) => (
              <button key={p.id} className="lu-pool-card" onClick={() => setTarget(p)}>
                <Avatar name={p.name} src={p.photoUrl || undefined} size={36} />
                <span className="lu-grow" style={{ fontSize: 15, color: "var(--text)" }}>
                  {p.name}
                </span>
                {p.position && <PositionBadge code={p.position} />}
              </button>
            ))}
          </div>
        ) : (
          <>
            <p className="lu-sheet-lede">
              Жалоба привяжется к матчу «{r?.title}». Её увидят только модераторы — игроку она не показывается.
            </p>
            <div className="lu-stack" style={{ gap: 12 }}>
              <div className="lu-field">
                <label className="lu-field__label">Причина</label>
                <div className="lu-field__wrap" style={{ alignItems: "stretch", padding: 12 }}>
                  <textarea
                    className="lu-field__input"
                    rows={3}
                    style={{ resize: "none", padding: 0 }}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="напр. грубая игра, оскорбления"
                  />
                </div>
              </div>
              <Button block size="lg" variant="destructive" loading={sending} disabled={reason.trim().length < 5} onClick={() => void complain()}>
                Отправить жалобу
              </Button>
              <Button block variant="ghost" onClick={() => setTarget(null)}>
                Выбрать другого игрока
              </Button>
            </div>
          </>
        )}
      </Sheet>
    </div>
  );
}
