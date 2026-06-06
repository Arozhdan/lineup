/* 3.3 Профиль (tab root). */
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { api, unwrap } from "@/api/client";
import { useApp } from "@/app/AppContext";
import { Avatar, Badge, Button, Card, ListItem, ListSection, NavBar } from "@/ds";
import { FormPills, relColor, RingProgress } from "@/ds/extras";
import { roleColorOf } from "@/ds";
import { I } from "@/icons";
import { fmtMoney } from "@/lib/format";

const joinedLabel = (unixSec: number): string => {
  const s = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(new Date(unixSec * 1000));
  return s.replace(/\sг\.?$/, "");
};

export function Profile() {
  const navigate = useNavigate();
  const { me } = useApp();

  const paymentsQuery = useQuery({
    queryKey: ["payments"],
    queryFn: () => unwrap(api.money.payments.$get()),
    enabled: !!me,
  });
  const debt = paymentsQuery.data?.debt ?? 0;

  if (!me) {
    return (
      <div className="lu-scr">
        <NavBar plain title="Профиль" />
        <div className="lu-scr__body lu-scr__body--tab">
          <div className="lu-skel" style={{ height: 84, width: 84, borderRadius: "50%", margin: "0 auto" }} />
        </div>
      </div>
    );
  }

  const s = me.stats;
  return (
    <div className="lu-scr">
      <NavBar
        plain
        title="Профиль"
        trailing={
          <button className="lu-iconbtn" onClick={() => navigate("/settings")}>
            <I.Settings width={21} height={21} />
          </button>
        }
      />
      <div className="lu-scr__body lu-scr__body--tab">
        <div className="lu-profile-head">
          <Avatar
            name={me.name}
            src={me.photoUrl ?? undefined}
            size={84}
            positionBadge={me.primaryPos}
            positionColor={roleColorOf(me.primaryPos)}
          />
          <div className="lu-profile-name">{me.name}</div>
          <div className="lu-muted">
            {me.handle} · с нами {joinedLabel(me.joinedAt)}
          </div>
          <div className="lu-profile-chips">
            <Badge variant="accent">
              <I.Star width={12} height={12} />
              {s.points} очков
            </Badge>
            {s.rank != null && <Badge variant="success">#{s.rank} в районе</Badge>}
            {me.area && (
              <Badge variant="info">
                <I.Field width={12} height={12} />
                {me.area}
              </Badge>
            )}
          </div>
        </div>

        <Card pad>
          <div className="lu-row" style={{ gap: 16 }}>
            <RingProgress value={s.reliability} size={64} color={relColor(s.reliability)}>
              {s.reliability}
            </RingProgress>
            <div className="lu-grow">
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>Надёжность {s.reliability}%</div>
              <div className="lu-muted" style={{ marginTop: 2 }}>
                Приходишь, когда записался. Организаторы это видят.
              </div>
            </div>
          </div>
        </Card>

        <div className="lu-tiles">
          <button
            className="lu-tile"
            onClick={() => navigate("/stats")}
            style={{ cursor: "pointer", border: "none", textAlign: "left" }}
          >
            <span className="lu-tile__v">{s.games}</span>
            <span className="lu-tile__l">игр сыграно</span>
          </button>
          <div className="lu-tile">
            <span className="lu-tile__v">
              {s.goals}+{s.assists}
            </span>
            <span className="lu-tile__l">голы + пасы</span>
          </div>
          <div className="lu-tile">
            <span className="lu-tile__v" style={{ color: "var(--success)" }}>
              {s.wins}
            </span>
            <span className="lu-tile__l">побед</span>
          </div>
          <div className="lu-tile">
            <span className="lu-tile__v" style={{ color: "#E8B923" }}>
              {s.mvp}×
            </span>
            <span className="lu-tile__l">MVP матча</span>
          </div>
        </div>

        <div className="lu-row lu-row--between" style={{ padding: "0 2px" }}>
          <span className="lu-section-label">Форма · последние 5</span>
          <FormPills form={s.form} />
        </div>

        <ListSection>
          <ListItem
            icon={<I.BarChart width={16} height={16} />}
            iconColor="var(--accent)"
            title="Подробная статистика"
            chevron
            onClick={() => navigate("/stats")}
          />
          <ListItem
            icon={<I.History width={16} height={16} />}
            iconColor="var(--info)"
            title="История игр"
            value={String(s.games)}
            chevron
            onClick={() => navigate("/history")}
          />
          <ListItem
            icon={<I.Wallet width={16} height={16} />}
            iconColor={debt ? "var(--danger)" : "var(--gray-500)"}
            title="Платежи и долги"
            value={fmtMoney(debt)}
            chevron
            onClick={() => navigate("/payments")}
          />
          <ListItem
            icon={<I.Globe width={16} height={16} />}
            iconColor="var(--gray-500)"
            title="Публичный профиль"
            chevron
            onClick={() => navigate(`/player/${me.id}`)}
          />
        </ListSection>
        <Button variant="secondary" block onClick={() => navigate("/settings")} leadingIcon={<I.Settings width={18} height={18} />}>
          Настройки и приватность
        </Button>
      </div>
    </div>
  );
}
