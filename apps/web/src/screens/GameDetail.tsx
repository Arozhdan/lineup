/* 2.2 Карточка игры. */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router";
import { api, unwrap } from "@/api/client";
import { useApp } from "@/app/AppContext";
import { Avatar, Button, ListItem, ListSection, NavBar, PositionBadge } from "@/ds";
import { KeyFact } from "@/ds/extras";
import { I } from "@/icons";
import { fmtCaps, fmtMoney, fmtWhen } from "@/lib/format";
import { PAY_WHEN_LABEL, type PayWhen } from "@lineup/shared";

export const fetchGameDetail = (id: string) => unwrap(api.games[":id"].$get({ param: { id: String(id) } }));
export type GameDetailData = Awaited<ReturnType<typeof fetchGameDetail>>;

export function GameDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { isOrganizer, toast } = useApp();
  const [expanded, setExpanded] = useState(false);

  const gameQuery = useQuery({
    queryKey: ["game", id],
    queryFn: () => fetchGameDetail(id),
    enabled: !!id,
  });
  const g = gameQuery.data;

  const share = () => {
    void navigator.clipboard?.writeText(location.href);
    toast("Ссылка скопирована");
  };

  return (
    <div className="lu-scr">
      <NavBar
        title="Игра"
        onBack={() => navigate(-1)}
        backLabel="Игры"
        trailing={
          <button className="lu-iconbtn" onClick={share}>
            <I.Share width={20} height={20} />
          </button>
        }
      />
      <div className="lu-scr__body">
        {gameQuery.isPending && (
          <>
            <div className="lu-card lu-card--pad" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div className="lu-skel" style={{ height: 12, width: "40%" }} />
              <div className="lu-skel" style={{ height: 24, width: "75%" }} />
              <div className="lu-skel" style={{ height: 14, width: "60%" }} />
            </div>
            <div className="lu-skel" style={{ height: 150, borderRadius: "var(--radius-lg)" }} />
            <div className="lu-skel" style={{ height: 90, borderRadius: "var(--radius-lg)" }} />
          </>
        )}

        {g && <GameBody g={g} expanded={expanded} setExpanded={setExpanded} />}
      </div>

      {g && (
        <div className="lu-mainbtn">
          {isOrganizer ? (
            <Button block size="lg" leadingIcon={<I.Settings width={18} height={18} />} onClick={() => navigate(`/game/${id}/manage`)}>
              Управлять игрой
            </Button>
          ) : g.my?.status === "confirmed" ? (
            <Button block size="lg" variant="secondary" onClick={() => navigate(`/game/${id}/cancel`)}>
              Я записан · управлять
            </Button>
          ) : g.my?.status === "pending" ? (
            <Button block size="lg" disabled>
              Заявка на рассмотрении
            </Button>
          ) : g.my?.status === "waitlist" ? (
            <Button block size="lg" variant="secondary" onClick={() => navigate(`/game/${id}/waitlist`)}>
              Ты в листе ожидания
            </Button>
          ) : g.status === "cancelled" ? (
            <Button block size="lg" disabled>
              Игра отменена
            </Button>
          ) : g.status === "done" ? (
            <Button block size="lg" disabled>
              Игра завершена
            </Button>
          ) : g.status === "full" ? (
            <Button block size="lg" variant="secondary" onClick={() => navigate(`/game/${id}/waitlist`)}>
              Состав заполнен · в лист ожидания
            </Button>
          ) : (
            <Button block size="lg" onClick={() => navigate(`/game/${id}/signup`)}>
              Записаться{g.price ? ` · ${fmtMoney(g.price)}` : ""}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function GameBody({
  g,
  expanded,
  setExpanded,
}: {
  g: GameDetailData;
  expanded: boolean;
  setExpanded: (v: boolean) => void;
}) {
  const pct = g.capacity ? Math.min(100, Math.round((g.filled / g.capacity) * 100)) : 0;
  const left = Math.max(0, g.capacity - g.filled);
  const roster = expanded ? g.roster : g.roster.slice(0, 6);
  const extra = g.roster.length - 6;

  return (
    <>
      <div>
        <div className="lu-match__when" style={{ marginBottom: 4 }}>
          {fmtCaps(g.startsAt)}
        </div>
        <h2 className="lu-h1" style={{ marginBottom: 10 }}>
          {g.title}
        </h2>
        <div className="lu-detail-meta">
          <span>
            <I.Clock width={15} height={15} />
            {fmtWhen(g.startsAt)}
          </span>
          <span>
            <I.Field width={15} height={15} />
            {g.format}
          </span>
          <span>
            <I.Coins width={15} height={15} />
            {g.price ? fmtMoney(g.price) : "бесплатно"}
          </span>
        </div>
      </div>

      <div className="lu-map">
        <div className="lu-map__road" style={{ left: 0, right: 0, top: "62%", height: 8 }} />
        <div className="lu-map__road" style={{ top: 0, bottom: 0, left: "30%", width: 7 }} />
        <div className="lu-map__pin">
          <I.Pin width={30} height={30} />
        </div>
        <div className="lu-map__chip">
          <I.Pin width={12} height={12} style={{ verticalAlign: -1, marginRight: 4 }} />
          {g.venueInfo?.name ?? g.venue}
        </div>
      </div>

      {g.my?.status === "confirmed" && (
        <div className="lu-youin-banner">
          <I.CheckCircle width={18} height={18} />
          Ты в составе · позиция {g.my.position}
        </div>
      )}

      {g.kind === "meetup" ? (
        <div className="lu-keyfacts">
          <KeyFact icon={<I.Users width={13} height={13} />} k="Тип" v="Митап" />
          <KeyFact icon={<I.Coins width={13} height={13} />} k="Участие" v={g.price ? fmtMoney(g.price) : "бесплатно"} />
          <KeyFact icon={<I.Clock width={13} height={13} />} k="Когда" v={fmtWhen(g.startsAt)} />
          <KeyFact icon={<I.Pin width={13} height={13} />} k="Где" v={g.venueShort} />
        </div>
      ) : (
        <div className="lu-keyfacts">
          <KeyFact icon={<I.Field width={13} height={13} />} k="Формат" v={`${g.format} · ${g.mainSlots} осн.`} />
          <KeyFact icon={<I.Users width={13} height={13} />} k="Запасные" v={`+${g.subSlots}`} />
          <KeyFact icon={<I.Coins width={13} height={13} />} k="Взнос" v={g.price ? fmtMoney(g.price) : "—"} />
          <KeyFact icon={<I.Wallet width={13} height={13} />} k="Оплата" v={PAY_WHEN_LABEL[g.payWhen as PayWhen]} />
        </div>
      )}

      <div>
        <div className="lu-row lu-row--between" style={{ marginBottom: 10 }}>
          <span className="lu-section-label">Состав</span>
          <span className="lu-bar__lbl">
            <b>{g.filled}</b>/{g.capacity} · {left === 0 ? "заполнен" : `${left} свободно`}
          </span>
        </div>
        <div className="lu-bar" style={{ marginBottom: 14 }}>
          <div className="lu-bar__track">
            <div className="lu-bar__fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <ListSection>
          {roster.map((p) => (
            <ListItem
              key={p.signupId}
              leading={<Avatar name={p.name} src={p.photoUrl || undefined} size={34} />}
              title={p.name}
              trailing={p.position ? <PositionBadge code={p.position} /> : null}
            />
          ))}
          {!expanded && extra > 0 && (
            <ListItem
              title={`+ ещё ${extra} в составе`}
              subtitle="Нажми, чтобы раскрыть"
              chevron
              onClick={() => setExpanded(true)}
            />
          )}
        </ListSection>
      </div>

      {g.approval && (
        <p className="lu-note">
          <I.Lock width={13} height={13} style={{ verticalAlign: -2, marginRight: 4 }} />
          Организатор подтверждает заявки вручную.
        </p>
      )}
    </>
  );
}
