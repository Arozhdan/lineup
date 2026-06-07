/* Архив сезона: те же два лидерборда, посчитанные по играм выбранного сезона. */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router";
import { Badge, NavBar } from "@/ds";
import { I } from "@/icons";
import { fmtDay } from "@/lib/format";
import { BoardsView, fetchLeaderboard, type Board } from "./Leaderboard";

export function SeasonArchive() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [board, setBoard] = useState<Board>("points");

  const lbQuery = useQuery({
    queryKey: ["leaderboard", id],
    queryFn: () => fetchLeaderboard(Number(id)),
    enabled: !!id,
  });
  const data = lbQuery.data;
  const range = data?.seasonRange;

  return (
    <div className="lu-scr">
      <NavBar
        title={data?.season ?? "Сезон"}
        subtitle={range ? `${fmtDay(range.startsAt)} – ${fmtDay(range.endsAt)}` : undefined}
        onBack={() => navigate(-1)}
        backLabel="Сезоны"
      />
      <div className="lu-scr__body">
        {range && !range.active && (
          <div className="lu-row" style={{ justifyContent: "center" }}>
            <Badge variant="neutral">
              <I.Lock width={11} height={11} />
              архив · только просмотр
            </Badge>
          </div>
        )}
        <BoardsView data={data} loading={lbQuery.isPending} board={board} setBoard={setBoard} />
      </div>
    </div>
  );
}
