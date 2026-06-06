/* 4.8 Публикация составов. */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router";
import { api, unwrap } from "@/api/client";
import { useAction } from "@/app/AppContext";
import { Button, Card, ListItem, ListSection, NavBar } from "@/ds";
import { I } from "@/icons";
import { fmtTime, plural } from "@/lib/format";
import { TEAM_NAME } from "@lineup/shared";

export function Publish() {
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
  const a = roster.filter((p) => p.team === "a").length;
  const b = roster.filter((p) => p.team === "b").length;

  const publish = async () => {
    setBusy(true);
    const ok = await run(() => unwrap(api.games[":id"].teams.publish.$post({ param: { id: String(id) } })), {
      ok: "Составы отправлены игрокам!",
      invalidate: [["game", id], ["games"]],
    });
    setBusy(false);
    if (ok) navigate(`/game/${id}/manage`, { replace: true });
  };

  const players = (n: number) => `${n} ${plural(n, "игрок", "игрока", "игроков")}`;

  return (
    <div className="lu-scr">
      <NavBar title="Готово к публикации" onBack={() => navigate(-1)} backLabel="Назад" />
      <div className="lu-scr__body">
        <div className="lu-toast-inline" style={{ justifyContent: "center" }}>
          <I.CheckCircle width={18} height={18} />
          Составы сформированы
        </div>
        <Card pad>
          <div className="lu-section-label" style={{ marginBottom: 10 }}>
            Что отправим игрокам
          </div>
          <ListSection>
            <ListItem icon={<I.Users width={16} height={16} />} iconColor="var(--accent)" title="Состав А" value={players(a)} />
            <ListItem icon={<I.Users width={16} height={16} />} iconColor="#3B82F6" title="Состав Б" value={players(b)} />
            <ListItem
              icon={<I.Pin width={16} height={16} />}
              iconColor="var(--danger)"
              title="Место и время"
              value={g ? `${g.venueShort} · ${fmtTime(g.startsAt)}` : "—"}
            />
            <ListItem icon={<I.Shield width={16} height={16} />} iconColor="var(--info)" title="Цвет манишек" value={`А — ${TEAM_NAME.a.toLowerCase()}`} />
          </ListSection>
        </Card>
        <p className="lu-note lu-center">Каждый игрок получит сообщение от бота.</p>
      </div>
      <div className="lu-mainbtn">
        <Button block size="lg" leadingIcon={<I.Send width={18} height={18} />} loading={busy} disabled={!a || !b} onClick={() => void publish()}>
          Опубликовать и уведомить
        </Button>
      </div>
    </div>
  );
}
