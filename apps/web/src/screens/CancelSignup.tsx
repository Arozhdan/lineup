/* 2.6 Моя запись · отмена. */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router";
import { api, unwrap } from "@/api/client";
import { useApp, useAction } from "@/app/AppContext";
import { Button, ListItem, ListSection, NavBar, Sheet } from "@/ds";
import { I } from "@/icons";
import { fmtDeadline, fmtMoney, fmtWhen } from "@/lib/format";
import { PAY_STATUS_LABEL, type PayStatus } from "@lineup/shared";
import { fetchGameDetail } from "./GameDetail";

export function CancelSignup() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { toast } = useApp();
  const run = useAction();
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);

  const gameQuery = useQuery({
    queryKey: ["game", id],
    queryFn: () => fetchGameDetail(id),
    enabled: !!id,
  });
  const g = gameQuery.data;

  if (!g) {
    return (
      <div className="lu-scr">
        <NavBar title="Моя запись" onBack={() => navigate(-1)} backLabel="Игра" />
        <div className="lu-scr__body">
          <div className="lu-skel" style={{ height: 60, borderRadius: "var(--radius-lg)" }} />
          <div className="lu-skel" style={{ height: 180, borderRadius: "var(--radius-lg)" }} />
        </div>
      </div>
    );
  }

  const my = g.my;
  const deadlineAt = g.deadlineAt ?? g.startsAt - g.cancelDeadlineHours * 3600;
  const paidLabel =
    my?.payStatus && my.payStatus !== "none" ? PAY_STATUS_LABEL[my.payStatus as PayStatus] : null;

  const shareLink = () => {
    void navigator.clipboard?.writeText(location.href);
    toast("Ссылка скопирована");
  };

  const cancel = async () => {
    setBusy(true);
    let refunded = false;
    const ok = await run(
      async () => {
        const res = await unwrap(api.games[":id"].signup.cancel.$post({ param: { id: String(id) } }));
        refunded = res.refunded;
      },
      { invalidate: [["games"], ["game", id]] },
    );
    setBusy(false);
    setSheet(false);
    if (!ok) return;
    toast(refunded ? "Запись отменена · взнос вернётся" : "Запись отменена");
    navigate("/", { replace: true });
  };

  return (
    <div className="lu-scr">
      <NavBar title="Моя запись" onBack={() => navigate(-1)} backLabel="Игра" />
      <div className="lu-scr__body">
        <div className="lu-youin-banner">
          <I.CheckCircle width={18} height={18} />
          Ты в составе · позиция {my?.position}
        </div>
        <ListSection label="Детали">
          <ListItem icon={<I.Calendar width={16} height={16} />} title="Когда" value={fmtWhen(g.startsAt)} />
          <ListItem icon={<I.Pin width={16} height={16} />} iconColor="var(--danger)" title="Где" value={g.venueShort} />
          <ListItem
            icon={<I.Coins width={16} height={16} />}
            iconColor="var(--accent)"
            title={paidLabel ? "Оплачено" : "Взнос"}
            value={`${g.price ? fmtMoney(g.price) : "—"}${paidLabel ? ` · ${paidLabel}` : ""}`}
          />
        </ListSection>
        <ListSection label="Действия">
          {g.price > 0 && (my?.payStatus === "unpaid" || my?.payStatus === "partial") && (
            <ListItem
              icon={<I.QrCode width={16} height={16} />}
              iconColor="var(--accent)"
              title="Оплатить взнос по QR"
              subtitle={my?.payStatus === "partial" ? "осталась половина" : undefined}
              chevron
              onClick={() => navigate(`/game/${id}/pay`)}
            />
          )}
          <ListItem
            icon={<I.Repeat width={16} height={16} />}
            iconColor="var(--info)"
            title="Сменить позицию"
            subtitle={`Сейчас: ${my?.position ?? "—"}`}
            chevron
            onClick={() => navigate(`/game/${id}/signup`)}
          />
          <ListItem
            icon={<I.Share width={16} height={16} />}
            iconColor="var(--gray-500)"
            title="Позвать друга"
            chevron
            onClick={shareLink}
          />
        </ListSection>
        <div className="lu-countdown" style={{ alignSelf: "center" }}>
          <I.Clock width={14} height={14} />
          Бесплатная отмена до {fmtDeadline(deadlineAt)}
        </div>
      </div>
      <div className="lu-mainbtn">
        <Button block size="lg" variant="destructive" onClick={() => setSheet(true)}>
          Отменить запись
        </Button>
      </div>
      <Sheet open={sheet} onClose={() => setSheet(false)} title="Отменить запись?">
        <p className="lu-sheet-lede">
          {g.price
            ? `Взнос ${fmtMoney(g.price)} вернётся на карту в течение 1–2 дней, так как отмена до дедлайна. `
            : ""}
          Твоё место займёт первый из листа ожидания.
        </p>
        <div className="lu-stack">
          <Button block size="lg" variant="destructive" loading={busy} onClick={() => void cancel()}>
            Да, отменить
          </Button>
          <Button block variant="ghost" onClick={() => setSheet(false)}>
            Остаться в составе
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
