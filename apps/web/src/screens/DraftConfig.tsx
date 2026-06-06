/* 4.6 Настройка драфта. */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router";
import { api, unwrap } from "@/api/client";
import { useAction } from "@/app/AppContext";
import { Avatar, Button, Card, NavBar, PositionBadge, SegmentedControl } from "@/ds";
import { I } from "@/icons";

export function DraftConfig() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const run = useAction();
  const [capA, setCapA] = useState<number | null>(null);
  const [capB, setCapB] = useState<number | null>(null);
  const [time, setTime] = useState<"15" | "30" | "0">("30");
  const [busy, setBusy] = useState(false);

  const gameQuery = useQuery({
    queryKey: ["game", id],
    queryFn: () => unwrap(api.games[":id"].$get({ param: { id: String(id) } })),
    enabled: !!id,
  });
  const candidates = (gameQuery.data?.roster ?? []).slice(0, 6);

  const start = async () => {
    if (!capA || !capB || capA === capB) return;
    setBusy(true);
    const ok = await run(
      () => unwrap(api.games[":id"].draft.start.$post({ param: { id: String(id) }, json: { captainA: capA, captainB: capB, pickSeconds: +time } })),
      { invalidate: [["game", id]] },
    );
    setBusy(false);
    if (ok) navigate(`/game/${id}/draft`, { replace: true });
  };

  const captainList = (val: number | null, setter: (v: number) => void, color: string) => (
    <Card>
      <div className="lu-pool">
        {candidates.map((p) => (
          <div key={p.signupId} className="lu-radio" data-on={val === p.id} onClick={() => setter(p.id)}>
            <Avatar name={p.name} src={p.photoUrl || undefined} size={34} />
            <span className="lu-grow" style={{ fontSize: 15, color: "var(--text)" }}>
              {p.name}
            </span>
            {p.position && <PositionBadge code={p.position} />}
            <span className="lu-radio__dot" style={val === p.id ? { borderColor: color, background: color } : undefined} />
          </div>
        ))}
      </div>
    </Card>
  );

  return (
    <div className="lu-scr">
      <NavBar title="Настройка драфта" onBack={() => navigate(-1)} backLabel="Назад" />
      <div className="lu-scr__body">
        <p className="lu-lede" style={{ padding: "0 2px" }}>
          Выбери двух капитанов. Они по очереди наберут игроков из общего пула.
        </p>
        <div>
          <div className="lu-section-label" style={{ marginBottom: 8, paddingLeft: 2 }}>
            Капитан команды А
          </div>
          {captainList(capA, setCapA, "var(--accent)")}
        </div>
        <div>
          <div className="lu-section-label" style={{ marginBottom: 8, paddingLeft: 2 }}>
            Капитан команды Б
          </div>
          {captainList(capB, setCapB, "#3B82F6")}
        </div>
        <div>
          <div className="lu-section-label" style={{ marginBottom: 8, paddingLeft: 2 }}>
            Время на выбор
          </div>
          <SegmentedControl
            value={time}
            onChange={setTime}
            options={[
              { value: "15", label: "15 сек" },
              { value: "30", label: "30 сек" },
              { value: "0", label: "Без лимита" },
            ]}
          />
        </div>
      </div>
      <div className="lu-mainbtn">
        <Button block size="lg" leadingIcon={<I.Crown width={18} height={18} />} loading={busy} disabled={!capA || !capB || capA === capB} onClick={() => void start()}>
          Начать драфт
        </Button>
      </div>
    </div>
  );
}
