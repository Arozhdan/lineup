/* 4.1 Создание игры (Игра / Митап). */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { api, unwrap } from "@/api/client";
import { useApp } from "@/app/AppContext";
import { Button, Input, ListItem, ListSection, NavBar, SegmentedControl, Switch } from "@/ds";
import { Stepper } from "@/ds/extras";
import { AddVenueSheet } from "@/screens/shared/AddVenueSheet";
import { I } from "@/icons";
import { ASIDE_OPTIONS, PAY_WHEN, PAY_WHEN_LABEL, SPLIT_MODES, type PayWhen, type SplitMode } from "@lineup/shared";

const PAY_LABEL_SHORT: Record<PayWhen, string> = {
  signup: "При записи",
  approved: "После заявки",
  after: "После игры",
};

const SPLIT_LABEL: Record<SplitMode, string> = {
  auto: "Авто",
  manual: "Вручную",
  draft: "Драфт",
};

/** YYYY-MM-DD for a Date in local time. */
const toDateInput = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function CreateGame() {
  const navigate = useNavigate();
  const { toast } = useApp();
  const qc = useQueryClient();

  const tomorrow = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d;
  }, []);

  const [type, setType] = useState<"game" | "meetup">("game");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(() => toDateInput(tomorrow));
  const [time, setTime] = useState("18:00");
  const [aside, setAside] = useState<number>(5);
  const [subs, setSubs] = useState(2);
  const [venueId, setVenueId] = useState<number | null>(null);
  const [split, setSplit] = useState<SplitMode>("draft");
  const [price, setPrice] = useState("350");
  const [payWhen, setPayWhen] = useState<PayWhen>("signup");
  const [approval, setApproval] = useState(false);
  const [visibleTo, setVisibleTo] = useState<number[]>([]); // empty = всем
  const [capOn, setCapOn] = useState(false);
  const [capacity, setCapacity] = useState("20");
  const [notes, setNotes] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const venuesQuery = useQuery({
    queryKey: ["venues"],
    queryFn: () => unwrap(api.venues.$get()),
  });
  const venues = venuesQuery.data ?? [];
  const effectiveVenue = venueId ?? venues[0]?.id ?? null;

  const groupsQuery = useQuery({
    queryKey: ["groups"],
    queryFn: () => unwrap(api.groups.$get()),
  });
  const groupList = groupsQuery.data ?? [];
  const toggleGroup = (id: number) =>
    setVisibleTo((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]));

  const isGame = type === "game";
  const main = aside * 2;

  const create = useMutation({
    mutationFn: async () => {
      const startsAt = Math.floor(new Date(`${date}T${time}`).getTime() / 1000);
      if (!title.trim()) throw new Error("Укажи название игры");
      if (!effectiveVenue) throw new Error("Выбери площадку");
      if (!Number.isFinite(startsAt) || startsAt * 1000 <= Date.now()) throw new Error("Дата должна быть в будущем");
      const deadlineAt = startsAt - 2 * 3600;
      const res = isGame
        ? await unwrap(
            api.games.$post({
              json: {
                kind: "game",
                title: title.trim(),
                startsAt,
                deadlineAt,
                venueId: effectiveVenue,
                notes: notes.trim(),
                aside,
                subSlots: subs,
                price: +price || 0,
                payWhen,
                splitMode: split,
                approval,
                visibleTo: visibleTo.length ? visibleTo : null,
              },
            }),
          )
        : await unwrap(
            api.games.$post({
              json: {
                kind: "meetup",
                title: title.trim(),
                startsAt,
                deadlineAt,
                venueId: effectiveVenue,
                notes: notes.trim(),
                capacity: capOn ? +capacity || 0 : null,
                price: +price || 0,
                visibleTo: visibleTo.length ? visibleTo : null,
              },
            }),
          );
      return res.id;
    },
    onSuccess: (newId) => {
      toast(isGame ? "Игра создана" : "Митап создан");
      void qc.invalidateQueries({ queryKey: ["games"] });
      navigate(`/game/${newId}/manage`, { replace: true });
    },
    onError: (e) => toast(e instanceof Error ? e.message : "Не удалось создать", "error"),
  });

  return (
    <div className="lu-scr">
      <NavBar title="Новая игра" onBack={() => navigate(-1)} backLabel="Отмена" />
      <div className="lu-scr__body">
        <div>
          <div className="lu-section-label" style={{ marginBottom: 8, paddingLeft: 2 }}>
            Тип
          </div>
          <SegmentedControl
            value={type}
            onChange={setType}
            options={[
              { value: "game", label: "Игра" },
              { value: "meetup", label: "Митап" },
            ]}
          />
          <p className="lu-note" style={{ paddingTop: 6 }}>
            {isGame ? "Игра — формат, составы, деление на команды." : "Митап — свободная встреча: место, время и (опц.) оплата."}
          </p>
        </div>

        <Input
          label="Название"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={isGame ? "напр. Вечерние пятёрки" : "напр. Воскресный митап"}
        />

        {isGame && (
          <div>
            <div className="lu-section-label" style={{ marginBottom: 8, paddingLeft: 2 }}>
              Формат · {main} основных на поле
            </div>
            <div className="lu-chips">
              {ASIDE_OPTIONS.map((n) => (
                <button key={n} className="lu-chip" data-on={aside === n} onClick={() => setAside(n)}>
                  {n}×{n}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="lu-form-grid">
          <Input label="Дата" type="date" value={date} onChange={(e) => setDate(e.target.value)} leadingIcon={<I.Calendar width={16} height={16} />} />
          <Input label="Время" type="time" value={time} onChange={(e) => setTime(e.target.value)} leadingIcon={<I.Clock width={16} height={16} />} />
        </div>

        <div>
          <div className="lu-row lu-row--between" style={{ marginBottom: 6, padding: "0 2px" }}>
            <span className="lu-section-label">Площадка</span>
            <button className="lu-navbar__btn" style={{ padding: 0 }} onClick={() => setAddOpen(true)}>
              <I.Plus width={15} height={15} />
              Добавить
            </button>
          </div>
          <ListSection>
            {venues.map((v) => (
              <div
                key={v.id}
                className="lu-radio"
                data-on={effectiveVenue === v.id}
                onClick={() => setVenueId(v.id)}
                style={{ borderBottom: "1px solid var(--separator)" }}
              >
                <span className="lu-grow">
                  <span style={{ display: "block", fontSize: 15, color: "var(--text)" }}>{v.name}</span>
                  <span style={{ fontSize: 12, color: "var(--text-hint)" }}>
                    {v.addr} · аренда {v.rent}
                  </span>
                </span>
                <span className="lu-radio__dot" />
              </div>
            ))}
            {!venues.length && !venuesQuery.isPending && (
              <ListItem title="Нет площадок" subtitle="Добавь первую площадку выше" />
            )}
          </ListSection>
        </div>

        {isGame ? (
          <>
            <div className="lu-row lu-row--between" style={{ padding: "4px 2px 0" }}>
              <div>
                <div style={{ fontSize: 15, color: "var(--text)" }}>Основных мест</div>
                <div className="lu-muted">
                  = формат {aside}×{aside}, обе команды
                </div>
              </div>
              <span className="lu-display" style={{ fontSize: 22, color: "var(--text)" }}>
                {main}
              </span>
            </div>
            <div className="lu-row lu-row--between" style={{ padding: "0 2px" }}>
              <div>
                <div style={{ fontSize: 15, color: "var(--text)" }}>Дополнительные (запасные)</div>
                <div className="lu-muted">вместимость {main + subs}</div>
              </div>
              <Stepper value={subs} onDec={() => setSubs(Math.max(0, subs - 1))} onInc={() => setSubs(subs + 1)} />
            </div>

            <div>
              <div className="lu-section-label" style={{ marginBottom: 8, paddingLeft: 2 }}>
                Деление на команды
              </div>
              <SegmentedControl value={split} onChange={setSplit} options={SPLIT_MODES.map((m) => ({ value: m, label: SPLIT_LABEL[m] }))} />
            </div>

            <Input
              label="Взнос с человека"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              leadingIcon={<I.Coins width={16} height={16} />}
              inputMode="numeric"
              help="QR на оплату формируется по реквизитам платформы."
            />
            <div>
              <div className="lu-section-label" style={{ marginBottom: 8, paddingLeft: 2 }}>
                Момент оплаты
              </div>
              <SegmentedControl value={payWhen} onChange={setPayWhen} options={PAY_WHEN.map((p) => ({ value: p, label: PAY_LABEL_SHORT[p] }))} />
            </div>
            <ListSection label="Запись">
              <ListItem
                icon={<I.Lock width={16} height={16} />}
                iconColor="var(--info)"
                title="Подтверждать заявки"
                subtitle="ручное одобрение игроков"
                trailing={<Switch checked={approval} onChange={setApproval} />}
              />
            </ListSection>
          </>
        ) : (
          <>
            <ListSection label="Параметры митапа">
              <ListItem
                icon={<I.Users width={16} height={16} />}
                iconColor="var(--accent)"
                title="Ограничить вместимость"
                trailing={<Switch checked={capOn} onChange={setCapOn} />}
              />
            </ListSection>
            {capOn && (
              <Input
                label="Максимум участников"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                leadingIcon={<I.Users width={16} height={16} />}
                inputMode="numeric"
              />
            )}
            <Input
              label="Взнос с человека (опц.)"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0 — бесплатно"
              leadingIcon={<I.Coins width={16} height={16} />}
              inputMode="numeric"
            />
            <div className="lu-field">
              <label className="lu-field__label">Заметки</label>
              <div className="lu-field__wrap" style={{ alignItems: "stretch", padding: 12 }}>
                <textarea
                  className="lu-field__input"
                  rows={3}
                  style={{ resize: "none", padding: 0 }}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Свободная игра, делимся на месте. Приходи как удобно."
                />
              </div>
            </div>
          </>
        )}

        {groupList.length > 0 && (
          <div>
            <div className="lu-section-label" style={{ marginBottom: 8, paddingLeft: 2 }}>Кому видна игра</div>
            <div className="lu-chips">
              <button className="lu-chip" data-on={visibleTo.length === 0} onClick={() => setVisibleTo([])}>
                Всем игрокам
              </button>
              {groupList.map((g) => (
                <button key={g.id} className="lu-chip" data-on={visibleTo.includes(g.id)} onClick={() => toggleGroup(g.id)}>
                  {g.name} · {g.members.length}
                </button>
              ))}
            </div>
            {visibleTo.length > 0 && (
              <p className="lu-note" style={{ paddingTop: 6 }}>
                Приватная игра: её увидят только участники выбранных групп. Игроки не узнают об ограничении.
              </p>
            )}
          </div>
        )}
      </div>
      <div className="lu-mainbtn">
        <Button block size="lg" loading={create.isPending} onClick={() => create.mutate()}>
          {isGame ? "Создать и собрать состав" : "Создать митап"}
        </Button>
      </div>

      <AddVenueSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdded={(v) => setVenueId(v.id)}
      />
    </div>
  );
}
