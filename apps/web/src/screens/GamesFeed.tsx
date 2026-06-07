/* 2.1 Лента игр (tab root). */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { api, unwrap } from "@/api/client";
import { useApp } from "@/app/AppContext";
import { EmptyState, NavBar, SegmentedControl } from "@/ds";
import { MatchCardRU } from "@/ds/extras";
import { I } from "@/icons";
import { fmtCaps, fmtMoney } from "@/lib/format";

export function GamesFeed() {
  const navigate = useNavigate();
  const { isOrganizer, toast } = useApp();
  const [filter, setFilter] = useState<"all" | "game" | "meetup">("all");

  const gamesQuery = useQuery({
    queryKey: ["games"],
    queryFn: () => unwrap(api.games.$get()),
  });

  const list = (gamesQuery.data ?? []).filter((g) => filter === "all" || g.kind === filter);

  return (
    <div className="lu-scr">
      <NavBar
        plain
        title="Игры рядом"
        leading={
          <span style={{ paddingLeft: 10, fontSize: 13, color: "var(--text-hint)", display: "inline-flex", alignItems: "center", gap: 5 }}>
            <I.Pin width={14} height={14} />
            Хамовники
          </span>
        }
        trailing={
          <button className="lu-iconbtn" onClick={() => toast("Уведомления приходят в чат с ботом")}>
            <I.Bell width={22} height={22} />
          </button>
        }
      />
      <div className="lu-scr__body lu-scr__body--tab">
        {isOrganizer && (
          <button
            className="lu-pool-card"
            style={{ borderRadius: "var(--radius-lg)", justifyContent: "center", color: "#fff", background: "var(--accent)", fontWeight: 600 }}
            onClick={() => navigate("/create")}
          >
            <I.Plus width={18} height={18} /> Создать игру
          </button>
        )}
        <SegmentedControl
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "Все" },
            { value: "game", label: "Игры" },
            { value: "meetup", label: "Митапы" },
          ]}
        />
        <div className="lu-section-label" style={{ paddingLeft: 2 }}>
          Ближайшие · {list.length}
        </div>
        <div className="lu-stack">
          {gamesQuery.isPending &&
            [0, 1, 2].map((i) => (
              <div key={i} className="lu-card lu-card--pad" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div className="lu-skel" style={{ height: 12, width: "40%" }} />
                <div className="lu-skel" style={{ height: 22, width: "75%" }} />
                <div className="lu-skel" style={{ height: 8, width: "100%" }} />
              </div>
            ))}
          {list.map((g) => (
            <MatchCardRU
              key={g.id}
              title={g.title}
              caps={fmtCaps(g.startsAt)}
              venue={g.venueShort}
              format={g.format}
              filled={g.filled}
              total={g.capacity}
              price={g.price}
              priceLabel={fmtMoney(g.price)}
              status={g.status}
              myStatus={g.myStatus}
              onClick={() => navigate(`/game/${g.id}`)}
            />
          ))}
          {!gamesQuery.isPending && !list.length && (
            <EmptyState icon={<I.Calendar />} title="Ничего не нашлось" description="Поменяй фильтр — рядом ещё есть игры." />
          )}
        </div>
      </div>
    </div>
  );
}
