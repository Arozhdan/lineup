/* 2.3 Запись · выбор позиции. */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router";
import { api, unwrap } from "@/api/client";
import { useApp, useAction } from "@/app/AppContext";
import { Button, ListItem, ListSection, NavBar, PositionBadge, Switch } from "@/ds";
import { PositionPicker, pitchFormat } from "@/ds/PositionPicker";
import { I } from "@/icons";
import { fmtDeadline, fmtMoney } from "@/lib/format";
import { PAY_WHEN_LABEL, type PayWhen } from "@lineup/shared";
import { fetchGameDetail } from "./GameDetail";

export function Signup() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { me, toast } = useApp();
  const run = useAction();

  const gameQuery = useQuery({
    queryKey: ["game", id],
    queryFn: () => fetchGameDetail(id),
    enabled: !!id,
  });
  const g = gameQuery.data;

  const [pos, setPos] = useState<string | null>(me?.primaryPos ?? null);
  const [guest, setGuest] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!g) {
    return (
      <div className="lu-scr">
        <NavBar title="Запись на игру" onBack={() => navigate(-1)} backLabel="Назад" />
        <div className="lu-scr__body">
          <div className="lu-skel" style={{ height: 60, borderRadius: "var(--radius-lg)" }} />
          <div className="lu-skel" style={{ height: 280, borderRadius: "var(--radius-lg)" }} />
        </div>
      </div>
    );
  }

  const options = [me?.primaryPos, ...(me?.fallbackPos ?? [])].filter((c): c is string => !!c).slice(0, 3);
  const guests = guest ? 1 : 0;
  const payWhen = g.payWhen as PayWhen;
  const isGame = g.kind === "game";

  const cta = g.approval
    ? "Отправить заявку"
    : g.price > 0 && payWhen === "signup"
      ? `Продолжить · ${fmtMoney(g.price * (1 + guests))}`
      : `Записаться на позицию ${pos ?? ""}`;

  const submit = async () => {
    setSubmitting(true);
    let result: { status: string; payStatus: string } | null = null;
    const ok = await run(
      async () => {
        result = await unwrap(
          api.games[":id"].signup.$post({ param: { id: String(id) }, json: { position: pos, guests } }),
        );
      },
      { invalidate: [["games"], ["game", id]] },
    );
    setSubmitting(false);
    if (!ok || !result) return;
    const { status } = result;
    if (status === "pending") {
      toast("Заявка отправлена · ждёт одобрения");
      navigate("/", { replace: true });
    } else if (status === "confirmed" && g.price > 0 && payWhen === "signup") {
      navigate(`/game/${id}/pay`, { replace: true });
    } else if (status === "waitlist") {
      toast("Состав полон — ты в листе ожидания");
      navigate(-1);
    } else {
      toast(payWhen === "after" ? "Записан · оплата после игры" : payWhen === "approved" ? "Записан · оплата после подтверждения" : "Записан!");
      navigate(`/game/${id}`, { replace: true });
    }
  };

  return (
    <div className="lu-scr">
      <NavBar title="Запись на игру" onBack={() => navigate(-1)} backLabel="Назад" />
      <div className="lu-scr__body">
        <div style={{ padding: "0 2px" }}>
          <h2 className="lu-h1">Где будешь играть?</h2>
          <p className="lu-lede">
            Нажми на точку на схеме или выбери из своих позиций. Организатор учтёт это при делении на команды.
          </p>
        </div>

        {options.length > 0 && (
          <div className="lu-pos-options">
            {options.map((code, i) => (
              <button key={code} className="lu-pos-option" data-active={pos === code} onClick={() => setPos(code)}>
                {pos === code && (
                  <span className="lu-pos-option__tick">
                    <I.CheckCircle width={18} height={18} />
                  </span>
                )}
                <PositionBadge code={code} size="lg" />
                {i === 0 ? "основная" : "запасная"}
              </button>
            ))}
          </div>
        )}

        <PositionPicker legend value={pos} onChange={(v) => v && setPos(v)} format={pitchFormat(g.aside)} />

        {isGame && (
          <ListSection>
            <ListItem
              icon={<I.UserPlus width={16} height={16} />}
              iconColor="var(--info)"
              title="Привести гостя"
              subtitle={g.price ? `+1 место · ${fmtMoney(g.price)}` : "+1 место"}
              trailing={<Switch checked={guest} onChange={setGuest} />}
            />
          </ListSection>
        )}

        <div className="lu-summ" style={{ marginBottom: 0 }}>
          <div className="lu-summ__row">
            <span>Момент оплаты</span>
            <b>{g.price ? PAY_WHEN_LABEL[payWhen] : "бесплатно"}</b>
          </div>
          <div className="lu-summ__row">
            <span>Запись до</span>
            <b>{fmtDeadline(g.deadlineAt)}</b>
          </div>
          <div className="lu-summ__row">
            <span>Отмена</span>
            <b>до дедлайна — возврат</b>
          </div>
        </div>
      </div>
      <div className="lu-mainbtn">
        <Button block size="lg" disabled={!pos} loading={submitting} onClick={() => void submit()}>
          {cta}
        </Button>
      </div>
    </div>
  );
}
