/* 6.6 Отчёты и сводки. */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { api, unwrap } from "@/api/client";
import { useApp } from "@/app/AppContext";
import { Card, ListItem, ListSection, NavBar, SegmentedControl } from "@/ds";
import { I } from "@/icons";
import { fmtMoney } from "@/lib/format";

type Range = "week" | "month" | "season";

export function Reports() {
  const navigate = useNavigate();
  const { toast } = useApp();
  const [range, setRange] = useState<Range>("month");

  const reportsQuery = useQuery({
    queryKey: ["reports", range],
    queryFn: () => unwrap(api.reports.$get({ query: { range } })),
  });

  const data = reportsQuery.data;
  const weeks = data?.weeks ?? [];
  const maxCount = Math.max(1, ...weeks.map((w) => w.count));

  const downloadCsv = () => {
    if (!data) return;
    const rows: string[] = [
      "метрика;значение",
      `игр проведено;${data.games}`,
      `участий;${data.participations}`,
      `оборот;${data.turnover}`,
      `явка %;${data.attendance}`,
      "",
      "площадка;игр",
      ...data.venues.map((v) => `${v.name};${v.games}`),
    ];
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lineup-report-${range}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast("CSV выгружен");
  };

  return (
    <div className="lu-scr">
      <NavBar
        title="Отчёты"
        onBack={() => navigate(-1)}
        backLabel="Назад"
        trailing={
          <button className="lu-iconbtn" onClick={downloadCsv}>
            <I.Download width={20} height={20} />
          </button>
        }
      />
      <div className="lu-scr__body">
        <SegmentedControl
          value={range}
          onChange={setRange}
          options={[
            { value: "week", label: "Неделя" },
            { value: "month", label: "Месяц" },
            { value: "season", label: "Сезон" },
          ]}
        />

        <div className="lu-tiles">
          <div className="lu-tile">
            <span className="lu-tile__v">{data?.games ?? 0}</span>
            <span className="lu-tile__l">игр проведено</span>
          </div>
          <div className="lu-tile">
            <span className="lu-tile__v">{data?.participations ?? 0}</span>
            <span className="lu-tile__l">участий</span>
          </div>
          <div className="lu-tile">
            <span className="lu-tile__v" style={{ color: "var(--success)" }}>{fmtMoney(data?.turnover ?? 0)}</span>
            <span className="lu-tile__l">оборот</span>
          </div>
          <div className="lu-tile">
            <span className="lu-tile__v">{data?.attendance ?? 0}%</span>
            <span className="lu-tile__l">явка</span>
          </div>
        </div>

        <Card pad>
          <div className="lu-section-label" style={{ marginBottom: 12 }}>Участия по неделям</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 120 }}>
            {weeks.map((w, i) => (
              <div key={w.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <div
                  style={{
                    width: "100%",
                    height: `${(w.count / maxCount) * 100}%`,
                    background: i === weeks.length - 1 ? "var(--accent)" : "var(--fill-tertiary)",
                    borderRadius: "6px 6px 0 0",
                  }}
                />
                <span style={{ fontSize: 10, color: "var(--text-hint)" }}>{w.label}</span>
              </div>
            ))}
          </div>
        </Card>

        <ListSection label="Площадки по популярности">
          {(data?.venues ?? []).map((v) => (
            <ListItem key={v.name} icon={<I.Pin width={16} height={16} />} iconColor="var(--accent)" title={v.name} value={`${v.games} игр`} />
          ))}
          {data && !data.venues.length && <ListItem title="Пока нет данных" subtitle="за этот период игр не было" />}
        </ListSection>
      </div>
    </div>
  );
}
