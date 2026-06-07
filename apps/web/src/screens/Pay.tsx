/* 2.4 Оплата (QR — по реквизитам сообщества). */
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router";
import { api, unwrap } from "@/api/client";
import { useApp, useAction } from "@/app/AppContext";
import { Button, NavBar } from "@/ds";
import { QrBox } from "@/ds/extras";
import { I } from "@/icons";
import { fmtClock, fmtDeadline, fmtMoney } from "@/lib/format";
import { fetchGameDetail } from "./GameDetail";

export function Pay() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { toast } = useApp();
  const run = useAction();

  const gameQuery = useQuery({
    queryKey: ["game", id],
    queryFn: () => fetchGameDetail(id),
    enabled: !!id,
  });
  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: () => unwrap(api.settings.$get()),
  });
  // Personal QR Platba (SPD) with the exact amount, when the owner set an IBAN.
  const payqrQuery = useQuery({
    queryKey: ["payqr", id],
    queryFn: () => unwrap(api.games[":id"].payqr.$get({ param: { id: String(id) } })),
    enabled: !!id,
  });
  const g = gameQuery.data;
  const cfg = settingsQuery.data;

  const [secs, setSecs] = useState(15 * 60);
  const [marked, setMarked] = useState(false);

  useEffect(() => {
    if (secs <= 0) return;
    const t = setTimeout(() => setSecs((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secs]);

  if (!g || !cfg) {
    return (
      <div className="lu-scr">
        <NavBar title="Оплата" onBack={() => navigate(-1)} backLabel="Назад" />
        <div className="lu-scr__body">
          <div className="lu-skel" style={{ height: 40, width: 220, alignSelf: "center", borderRadius: 999 }} />
          <div className="lu-skel" style={{ height: 220, borderRadius: "var(--radius-lg)" }} />
        </div>
      </div>
    );
  }

  const guests = g.my?.guests ?? 0;
  const total = g.price * (1 + guests);
  const recipient = cfg.qrRecipient || cfg.name;
  const note = (cfg.qrNote || "").replace("{название}", g.title);

  const copyDetails = () => {
    const lines = [
      `Получатель: ${recipient}`,
      cfg.qrAccount ? `Счёт: ${cfg.qrAccount}` : "",
      cfg.qrBank ? `Банк: ${cfg.qrBank}` : "",
      note ? `Назначение: ${note}` : "",
    ].filter(Boolean);
    void navigator.clipboard?.writeText(lines.join("\n"));
    toast("Реквизиты скопированы");
  };

  const markPaid = async () => {
    let payStatus = "";
    const ok = await run(
      async () => {
        const res = await unwrap(api.games[":id"]["mark-paid"].$post({ param: { id: String(id) } }));
        payStatus = res.payStatus;
      },
      { invalidate: [["games"], ["game", id]] },
    );
    if (!ok) return;
    setMarked(true);
    toast(payStatus === "paid" ? "Оплата подтверждена" : "Отмечено · ждёт подтверждения организатора");
    navigate(`/game/${id}`, { replace: true });
  };

  return (
    <div className="lu-scr">
      <NavBar title="Оплата" onBack={() => navigate(-1)} backLabel="Назад" />
      <div className="lu-scr__body">
        {g.payWhen === "signup" ? (
          <div className="lu-countdown" style={{ alignSelf: "center" }}>
            <I.Clock width={14} height={14} />
            {secs > 0 ? `Место забронировано · ${fmtClock(secs)}` : "Бронь истекла — но место за тобой"}
          </div>
        ) : (
          <div className="lu-youin-banner" style={{ alignSelf: "stretch" }}>
            <I.CheckCircle width={16} height={16} />
            Место за тобой — оплати взнос до игры
          </div>
        )}

        <div className="lu-center">
          <div className="lu-display" style={{ fontSize: 38, color: "var(--text)" }}>
            {fmtMoney(total)}
          </div>
          <div className="lu-muted">
            {g.title}
            {guests > 0 ? " · вы + гость" : ""}
          </div>
        </div>

        <QrBox src={payqrQuery.data?.dataUrl ?? (cfg.qrImage || null)} />
        <p className="lu-note lu-center" style={{ marginTop: -2 }}>
          {payqrQuery.data?.dataUrl
            ? "QR Platba с точной суммой — отсканируй в приложении банка."
            : "Отсканируй QR в приложении банка. Реквизиты задаёт владелец сообщества."}
        </p>

        <div className="lu-summ" style={{ marginBottom: 0 }}>
          <div className="lu-summ__row">
            <span>Получатель</span>
            <b>{recipient}</b>
          </div>
          {cfg.qrAccount && (
            <div className="lu-summ__row">
              <span>Счёт</span>
              <b>{cfg.qrAccount}</b>
            </div>
          )}
          {cfg.qrBank && (
            <div className="lu-summ__row">
              <span>Банк</span>
              <b>{cfg.qrBank}</b>
            </div>
          )}
          {note && (
            <div className="lu-summ__row">
              <span>Назначение</span>
              <b>{note}</b>
            </div>
          )}
        </div>
        <Button block variant="secondary" leadingIcon={<I.Copy width={18} height={18} />} onClick={copyDetails}>
          Скопировать реквизиты
        </Button>
        <p className="lu-note lu-center">
          Если отменишь до дедлайна — организатор вернёт взнос ({fmtDeadline(g.deadlineAt)}).
        </p>
      </div>
      <div className="lu-mainbtn">
        <Button block size="lg" disabled={marked} leadingIcon={<I.Check width={18} height={18} />} onClick={() => void markPaid()}>
          Я оплатил{guests > 0 ? " за двоих" : ""}
        </Button>
      </div>
    </div>
  );
}
