/* 3.6 Лидерборды (tab root) — два таба. BoardsView переиспользуется архивом сезона. */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { api, unwrap } from "@/api/client";
import { Avatar, EmptyState, ListSection, NavBar, PositionBadge, SegmentedControl } from "@/ds";
import { I } from "@/icons";

export type Board = "points" | "reliability";
export type LeaderboardData = Awaited<ReturnType<typeof fetchLeaderboard>>;

export const fetchLeaderboard = (seasonId?: number) =>
  unwrap(api.leaderboard.$get({ query: seasonId ? { season: String(seasonId) } : {} }));

export function BoardsView({
  data,
  loading,
  board,
  setBoard,
}: {
  data: LeaderboardData | undefined;
  loading: boolean;
  board: Board;
  setBoard: (b: Board) => void;
}) {
  const navigate = useNavigate();
  const reliability = board === "reliability";
  const rows = (reliability ? data?.reliability : data?.points) ?? [];
  type Row = (typeof rows)[number];

  const valOf = (p: Row): string | number =>
    reliability ? `${(p as { reliability: number }).reliability}%` : (p as { points: number }).points;
  const subOf = (p: Row): string =>
    reliability
      ? `${p.games} игр`
      : `${(p as { mvp: number }).mvp}× MVP · ${(p as { goals: number }).goals} гол.`;

  const podium = rows.slice(0, 3);
  const order = [podium[1], podium[0], podium[2]].filter(Boolean) as Row[];
  const placeOf = (p: Row) => (p === podium[0] ? 1 : p === podium[1] ? 2 : 3);

  return (
    <>
      <SegmentedControl
        value={board}
        onChange={setBoard}
        options={[
          { value: "points", label: "Результативность" },
          { value: "reliability", label: "Надёжность" },
        ]}
      />

      {loading && <div className="lu-skel" style={{ height: 160, borderRadius: "var(--radius-lg)" }} />}

      {!loading && rows.length === 0 && (
        <EmptyState icon={<I.Trophy />} title="Пока пусто" description="В этом сезоне ещё нет сыгранных матчей." />
      )}

      {order.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", alignItems: "end", gap: 8, marginTop: 4 }}>
          {order.map((p) => {
            const place = placeOf(p);
            const h = place === 1 ? 96 : place === 2 ? 74 : 60;
            return (
              <div key={p.id} style={{ textAlign: "center" }}>
                <Avatar name={p.name} src={p.photoUrl ?? undefined} size={place === 1 ? 56 : 46} style={{ margin: "0 auto 6px" }} />
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {p.name.split(" ")[0]}
                </div>
                <div className="lu-lb-pts" style={{ fontSize: 14 }}>
                  {valOf(p)}
                </div>
                <div
                  style={{
                    height: h,
                    borderRadius: "10px 10px 0 0",
                    marginTop: 6,
                    background: place === 1 ? "var(--grad-pitch)" : "var(--fill-tertiary)",
                    display: "grid",
                    placeItems: "start center",
                    paddingTop: 8,
                    color: place === 1 ? "#fff" : "var(--text-hint)",
                    fontFamily: "var(--font-display)",
                    fontWeight: 800,
                    fontSize: 20,
                  }}
                >
                  {place}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {rows.length > 3 && (
        <ListSection label={reliability ? "По надёжности — серии явок" : "По очкам сезона · форма"}>
          {rows.slice(3, 12).map((p, i) => (
            <div
              key={p.id}
              className="lu-pool-card lu-lb-row"
              data-me={p.you || undefined}
              style={{ cursor: "pointer" }}
              onClick={() => navigate(`/player/${p.id}`)}
            >
              <span className="lu-rank">{i + 4}</span>
              <Avatar name={p.name} src={p.photoUrl ?? undefined} size={34} />
              <span className="lu-grow">
                <span style={{ display: "block", fontSize: 15, color: "var(--text)" }}>
                  {p.you ? `${p.name} (вы)` : p.name}
                </span>
                <span style={{ fontSize: 12, color: "var(--text-hint)" }}>{subOf(p)}</span>
              </span>
              {reliability ? (
                <span
                  className="lu-pay-state"
                  data-s={
                    (p as { reliability: number }).reliability >= 90
                      ? "paid"
                      : (p as { reliability: number }).reliability >= 75
                        ? "partial"
                        : "unpaid"
                  }
                />
              ) : p.primaryPos ? (
                <PositionBadge code={p.primaryPos} />
              ) : null}
              <span className="lu-lb-pts">{valOf(p)}</span>
            </div>
          ))}
        </ListSection>
      )}

      {rows.length > 0 && (
        <p className="lu-note lu-center">
          {reliability
            ? "Надёжность = доля явок к записям. Высокая даёт приоритет в листе ожидания."
            : "Очки: за явку, победы, голы, передачи и звание MVP."}
        </p>
      )}
    </>
  );
}

export function Leaderboard() {
  const [board, setBoard] = useState<Board>("points");
  const lbQuery = useQuery({
    queryKey: ["leaderboard"],
    queryFn: () => fetchLeaderboard(),
  });
  return (
    <div className="lu-scr">
      <NavBar plain title="Лидерборды" subtitle={lbQuery.data?.season ?? undefined} />
      <div className="lu-scr__body lu-scr__body--tab">
        <BoardsView data={lbQuery.data} loading={lbQuery.isPending} board={board} setBoard={setBoard} />
      </div>
    </div>
  );
}
