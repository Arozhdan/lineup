/* 6.8 Регулярная серия. */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { ASIDE_OPTIONS } from "@lineup/shared";
import { api, unwrap } from "@/api/client";
import { useAction } from "@/app/AppContext";
import { Button, Card, Input, ListItem, ListSection, NavBar, Switch } from "@/ds";
import { Stepper } from "@/ds/extras";
import { I } from "@/icons";

const DAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const DAY_FULL = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];

type Series = {
  id: number;
  title: string;
  days: number[];
  time: string;
  venueId: number;
  aside: number;
  subSlots: number;
  price: number;
  openDaysBefore: number;
  inviteRegulars: boolean;
  active: boolean;
};
type Venue = { id: number; name: string };

/** JS getDay(): 0=Sun..6=Sat → our index 0=Mon..6=Sun. */
const jsToIdx = (d: number) => (d + 6) % 7;

function nextOccurrence(days: number[], time: string): { idx: number; date: Date } | null {
  if (!days.length) return null;
  const [hh, mm] = time.split(":").map(Number);
  const now = new Date();
  for (let add = 0; add < 14; add++) {
    const cand = new Date(now);
    cand.setDate(now.getDate() + add);
    cand.setHours(hh ?? 18, mm ?? 0, 0, 0);
    const idx = jsToIdx(cand.getDay());
    if (days.includes(idx) && cand.getTime() > now.getTime()) return { idx, date: cand };
  }
  return null;
}

export function Schedule() {
  const navigate = useNavigate();
  const run = useAction();
  const [saving, setSaving] = useState(false);

  const seriesQuery = useQuery({
    queryKey: ["series"],
    queryFn: () => unwrap(api.series.$get()),
  });
  const venuesQuery = useQuery({
    queryKey: ["venues"],
    queryFn: () => unwrap(api.venues.$get()),
  });
  const venues = (venuesQuery.data ?? []) as Venue[];
  const existing = (seriesQuery.data ?? [])[0] as Series | undefined;

  const [state, setState] = useState<Series | null>(null);
  // Initialize form state once data loads.
  const form = state ?? {
    id: existing?.id ?? 0,
    title: existing?.title ?? "Регулярная игра",
    days: existing?.days ?? [6],
    time: existing?.time ?? "18:00",
    venueId: existing?.venueId ?? venues[0]?.id ?? 0,
    aside: existing?.aside ?? 5,
    subSlots: existing?.subSlots ?? 2,
    price: existing?.price ?? 0,
    openDaysBefore: existing?.openDaysBefore ?? 5,
    inviteRegulars: existing?.inviteRegulars ?? true,
    active: existing?.active ?? true,
  };
  const set = (patch: Partial<Series>) => setState({ ...form, ...patch });

  const next = useMemo(() => nextOccurrence(form.days, form.time), [form.days, form.time]);
  const venueName = venues.find((v) => v.id === form.venueId)?.name ?? "—";

  const save = async () => {
    setSaving(true);
    const json = {
      title: form.title.trim() || "Регулярная игра",
      days: form.days,
      time: form.time,
      venueId: form.venueId,
      aside: form.aside,
      subSlots: form.subSlots,
      price: +form.price || 0,
      openDaysBefore: form.openDaysBefore,
      inviteRegulars: form.inviteRegulars,
      active: form.active,
    };
    const ok = await run(
      () =>
        existing
          ? unwrap(api.series[":id"].$patch({ param: { id: String(existing.id) }, json }))
          : unwrap(api.series.$post({ json })),
      { ok: "Расписание сохранено", invalidate: [["series"]] },
    );
    setSaving(false);
    if (ok) navigate(-1);
  };

  return (
    <div className="lu-scr">
      <NavBar title="Регулярная серия" onBack={() => navigate(-1)} backLabel="Назад" />
      <div className="lu-scr__body">
        <ListSection>
          <ListItem
            icon={<I.Repeat width={16} height={16} />}
            iconColor="var(--accent)"
            title="Повторять игру"
            subtitle="автосоздание по расписанию"
            trailing={<Switch checked={form.active} onChange={(v) => set({ active: v })} />}
          />
        </ListSection>

        {form.active && (
          <>
            <Input label="Название игры" value={form.title} onChange={(e) => set({ title: e.target.value })} leadingIcon={<I.Calendar width={16} height={16} />} />

            <div>
              <div className="lu-section-label" style={{ marginBottom: 8, paddingLeft: 2 }}>Дни недели</div>
              <div className="lu-chips">
                {DAY_LABELS.map((d, i) => (
                  <button
                    key={d}
                    className="lu-chip"
                    data-on={form.days.includes(i)}
                    onClick={() => set({ days: form.days.includes(i) ? form.days.filter((x) => x !== i) : [...form.days, i].sort((a, b) => a - b) })}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <Input label="Время" type="time" value={form.time} onChange={(e) => set({ time: e.target.value })} leadingIcon={<I.Clock width={16} height={16} />} />

            <ListSection label="Площадка">
              {venues.map((v) => (
                <ListItem
                  key={v.id}
                  icon={<I.Pin width={16} height={16} />}
                  iconColor="var(--success)"
                  title={v.name}
                  onClick={() => set({ venueId: v.id })}
                  trailing={form.venueId === v.id ? <I.Check width={18} height={18} style={{ color: "var(--accent)" }} /> : undefined}
                />
              ))}
            </ListSection>

            <div>
              <div className="lu-section-label" style={{ marginBottom: 8, paddingLeft: 2 }}>Формат</div>
              <div className="lu-chips">
                {ASIDE_OPTIONS.map((n) => (
                  <button key={n} className="lu-chip lu-chip--sm" data-on={form.aside === n} onClick={() => set({ aside: n })}>
                    {n}×{n}
                  </button>
                ))}
              </div>
            </div>

            <Input label="Взнос" value={String(form.price)} onChange={(e) => set({ price: Number(e.target.value.replace(/\D/g, "")) })} inputMode="numeric" leadingIcon={<I.Coins width={16} height={16} />} />

            <ListSection label="Автоматика">
              <ListItem
                icon={<I.Megaphone width={16} height={16} />}
                iconColor="var(--info)"
                title="Открывать запись"
                value={`за ${form.openDaysBefore} дней`}
                trailing={
                  <Stepper
                    value={form.openDaysBefore}
                    onDec={() => set({ openDaysBefore: Math.max(1, form.openDaysBefore - 1) })}
                    onInc={() => set({ openDaysBefore: Math.min(30, form.openDaysBefore + 1) })}
                  />
                }
              />
              <ListItem
                icon={<I.Bell width={16} height={16} />}
                iconColor="var(--accent)"
                title="Звать постоянный состав"
                trailing={<Switch checked={form.inviteRegulars} onChange={(v) => set({ inviteRegulars: v })} />}
              />
            </ListSection>

            <Card pad>
              <p className="lu-note" style={{ padding: 0 }}>
                <I.Info width={13} height={13} style={{ verticalAlign: -2, marginRight: 4 }} />
                {next ? (
                  <>
                    Следующая игра создастся автоматически:{" "}
                    <b style={{ color: "var(--text)" }}>
                      {DAY_FULL[next.idx]} {next.date.getDate()}, {form.time}, {venueName}
                    </b>
                    .
                  </>
                ) : (
                  "Выбери хотя бы один день недели."
                )}
              </p>
            </Card>
          </>
        )}
      </div>
      <div className="lu-mainbtn">
        <Button block size="lg" loading={saving} disabled={form.active && (!form.days.length || !form.venueId)} onClick={save}>
          Сохранить
        </Button>
      </div>
    </div>
  );
}
