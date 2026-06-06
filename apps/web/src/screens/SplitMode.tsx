/* 4.4 Режим деления на команды. */
import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router";
import { api, unwrap } from "@/api/client";
import { useAction } from "@/app/AppContext";
import { Button, NavBar } from "@/ds";
import { I } from "@/icons";
import type { SplitMode as SplitModeId } from "@lineup/shared";

export function SplitMode() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const run = useAction();
  const [mode, setMode] = useState<SplitModeId>("auto");
  const [busy, setBusy] = useState(false);

  const gameQuery = useQuery({
    queryKey: ["game", id],
    queryFn: () => unwrap(api.games[":id"].$get({ param: { id: String(id) } })),
    enabled: !!id,
  });
  const count = gameQuery.data?.roster.length ?? 0;

  const modes: { id: SplitModeId; t: string; d: string; ic: ReactNode; c: string }[] = [
    { id: "auto", t: "Автобаланс", d: "Алгоритм поделит по уровню и позициям. Самый быстрый способ.", ic: <I.Shuffle width={20} height={20} />, c: "var(--accent)" },
    { id: "draft", t: "Драфт капитанами", d: "Два капитана по очереди выбирают игроков. Весело и честно.", ic: <I.Crown width={20} height={20} />, c: "#E8B923" },
    { id: "manual", t: "Вручную", d: "Сам распределишь игроков по командам.", ic: <I.GripVertical width={20} height={20} />, c: "var(--info)" },
  ];

  const go = async () => {
    if (mode === "draft") {
      navigate(`/game/${id}/draftcfg`);
      return;
    }
    if (mode === "manual") {
      navigate(`/game/${id}/manual`);
      return;
    }
    setBusy(true);
    const ok = await run(() => unwrap(api.games[":id"].teams.auto.$post({ param: { id: String(id) } })), {
      invalidate: [["game", id]],
    });
    setBusy(false);
    if (ok) navigate(`/game/${id}/manual?auto=1`);
  };

  return (
    <div className="lu-scr">
      <NavBar title="Деление на команды" onBack={() => navigate(-1)} backLabel="Состав" />
      <div className="lu-scr__body">
        <p className="lu-lede" style={{ padding: "0 2px" }}>
          {count} игроков готовы. Как поделим на две команды?
        </p>
        {modes.map((m) => (
          <button key={m.id} className="lu-mode-card" data-on={mode === m.id} onClick={() => setMode(m.id)}>
            <span className="lu-mode-card__ic" style={{ background: m.c }}>
              {m.ic}
            </span>
            <span className="lu-grow">
              <span className="lu-mode-card__t">{m.t}</span>
              <span className="lu-mode-card__d">{m.d}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="lu-mainbtn">
        <Button block size="lg" loading={busy} onClick={() => void go()}>
          Продолжить
        </Button>
      </div>
    </div>
  );
}
