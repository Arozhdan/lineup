/* 6.3 Рассылка и анонсы. */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router";
import { BROADCAST_AUDIENCE_LABEL, type BroadcastAudience } from "@lineup/shared";
import { api, unwrap } from "@/api/client";
import { useApp, useAction } from "@/app/AppContext";
import { Button, ListItem, ListSection, NavBar, SegmentedControl } from "@/ds";
import { I } from "@/icons";
import { fmtCaps } from "@/lib/format";

const TEMPLATES = [
  "Не забудьте светлые/тёмные футболки",
  "Игра переносится — подробности в чате",
  "Остались места — зовите друзей!",
];

const AUDIENCE_OPTIONS: { value: BroadcastAudience; label: string }[] = [
  { value: "roster", label: BROADCAST_AUDIENCE_LABEL.roster },
  { value: "waitlist", label: BROADCAST_AUDIENCE_LABEL.waitlist },
  { value: "all", label: BROADCAST_AUDIENCE_LABEL.all },
];

export function Broadcast() {
  const navigate = useNavigate();
  const run = useAction();
  const { toast } = useApp();
  const [params] = useSearchParams();
  const preGame = params.get("game");

  const [audience, setAudience] = useState<BroadcastAudience>("roster");
  const [gameId, setGameId] = useState<number | null>(preGame ? Number(preGame) : null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const gamesQuery = useQuery({
    queryKey: ["games"],
    queryFn: () => unwrap(api.games.$get()),
  });
  const games = gamesQuery.data ?? [];

  const needsGame = audience !== "all";
  const disabled = !text.trim() || (needsGame && gameId == null);

  const send = async () => {
    setSending(true);
    await run(
      async () => {
        const res = await unwrap(
          api.broadcast.$post({ json: { audience, gameId: needsGame ? gameId : null, text: text.trim() } }),
        );
        toast(`Отправлено: ${res.sent} из ${res.total}`);
        navigate(-1);
      },
    );
    setSending(false);
  };

  return (
    <div className="lu-scr">
      <NavBar title="Рассылка" onBack={() => navigate(-1)} backLabel="Назад" />
      <div className="lu-scr__body">
        <div>
          <div className="lu-section-label" style={{ marginBottom: 8, paddingLeft: 2 }}>Кому</div>
          <SegmentedControl value={audience} onChange={setAudience} options={AUDIENCE_OPTIONS} />
        </div>

        {needsGame && (
          <ListSection label="Игра">
            {games.map((g) => (
              <ListItem
                key={g.id}
                title={g.title}
                subtitle={fmtCaps(g.startsAt)}
                onClick={() => setGameId(g.id)}
                trailing={
                  gameId === g.id ? <I.Check width={18} height={18} style={{ color: "var(--accent)" }} /> : undefined
                }
              />
            ))}
            {!gamesQuery.isPending && !games.length && (
              <ListItem title="Нет ближайших игр" subtitle="создай игру, чтобы выбрать аудиторию" />
            )}
          </ListSection>
        )}

        <div className="lu-field">
          <label className="lu-field__label">Сообщение</label>
          <div className="lu-field__wrap" style={{ alignItems: "stretch", padding: 12 }}>
            <textarea
              className="lu-field__input"
              rows={5}
              style={{ resize: "none", padding: 0 }}
              placeholder="Парни, не забудьте светлые футболки на сегодня!"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
          <span className="lu-field__help">Придёт как push и сообщение в чат игры.</span>
        </div>

        <ListSection label="Быстрые шаблоны">
          {TEMPLATES.map((t) => (
            <ListItem key={t} title={t} chevron onClick={() => setText(t)} />
          ))}
        </ListSection>
      </div>
      <div className="lu-mainbtn">
        <Button
          block
          size="lg"
          loading={sending}
          disabled={disabled}
          leadingIcon={<I.Megaphone width={18} height={18} />}
          onClick={send}
        >
          Отправить · {BROADCAST_AUDIENCE_LABEL[audience]}
        </Button>
      </div>
    </div>
  );
}
