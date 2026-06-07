/* 6.9 Сезоны. */
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { api, unwrap } from "@/api/client";
import { useApp } from "@/app/AppContext";
import { Badge, Button, Card, NavBar } from "@/ds";
import { I } from "@/icons";
import { fmtDay } from "@/lib/format";

export function Seasons() {
  const navigate = useNavigate();
  const { toast } = useApp();

  const seasonsQuery = useQuery({
    queryKey: ["seasons"],
    queryFn: () => unwrap(api.seasons.$get()),
  });

  const list = seasonsQuery.data ?? [];
  const active = list.find((s) => s.active);
  const archive = list.filter((s) => !s.active);

  return (
    <div className="lu-scr">
      <NavBar
        title="Сезоны"
        onBack={() => navigate(-1)}
        backLabel="Назад"
        trailing={
          <button className="lu-iconbtn" style={{ color: "var(--accent)" }} onClick={() => navigate("/seasons/new")}>
            <I.Plus width={22} height={22} />
          </button>
        }
      />
      <div className="lu-scr__body">
        <p className="lu-lede" style={{ padding: "0 2px" }}>
          Лидерборды и статистика считаются по активному сезону. Открой новый, чтобы начать отсчёт заново — прошлые сезоны
          сохранятся в архиве.
        </p>

        {seasonsQuery.isPending && <div className="lu-skel" style={{ height: 120, borderRadius: "var(--radius-lg)" }} />}

        {active && (
          <Card pad className="lu-card--accent" style={{ borderLeftColor: "var(--accent)" }} onClick={() => navigate(`/seasons/${active.id}`)}>
            <div className="lu-row lu-row--between">
              <div className="lu-row" style={{ gap: 12 }}>
                <span className="lu-mode-card__ic" style={{ background: "var(--grad-pitch)" }}>
                  <I.Trophy width={20} height={20} />
                </span>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 600 }}>{active.name}</div>
                  <div className="lu-muted">{fmtDay(active.startsAt)} – {fmtDay(active.endsAt)}</div>
                </div>
              </div>
              <div className="lu-row" style={{ gap: 6 }}>
                <Badge variant="success" dot>идёт</Badge>
                <I.ChevronRight width={18} height={18} style={{ color: "var(--text-hint)" }} />
              </div>
            </div>
            <div className="lu-row" style={{ marginTop: 12, gap: 8 }}>
              <Badge variant="neutral"><I.Calendar width={11} height={11} />{active.games} игр</Badge>
              <Badge variant="neutral"><I.Users width={11} height={11} />{active.players} игроков</Badge>
            </div>
          </Card>
        )}

        {archive.length > 0 && (
          <>
            <div className="lu-section-label" style={{ paddingLeft: 2 }}>Архив сезонов</div>
            <Card>
              <div className="lu-pool">
                {archive.map((s) => (
                  <button
                    key={s.id}
                    className="lu-pool-card"
                    onClick={() => navigate(`/seasons/${s.id}`)}
                  >
                    <span className="lu-mode-card__ic" style={{ background: "var(--fill-tertiary)", color: "var(--text-hint)" }}>
                      <I.Flag width={18} height={18} />
                    </span>
                    <span className="lu-grow">
                      <span style={{ display: "block", fontSize: 15, color: "var(--text)" }}>{s.name}</span>
                      <span style={{ fontSize: 12, color: "var(--text-hint)" }}>
                        {fmtDay(s.startsAt)} – {fmtDay(s.endsAt)} · {s.games} игр
                      </span>
                    </span>
                    <I.ChevronRight width={18} height={18} style={{ color: "var(--text-hint)" }} />
                  </button>
                ))}
              </div>
            </Card>
          </>
        )}

        <Button block variant="secondary" leadingIcon={<I.Plus width={18} height={18} />} onClick={() => navigate("/seasons/new")}>
          Открыть новый сезон
        </Button>
      </div>
    </div>
  );
}
