/* 6.10 Новый сезон. */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { api, unwrap } from "@/api/client";
import { useApp, useAction } from "@/app/AppContext";
import { Button, Input, ListItem, ListSection, NavBar, Switch } from "@/ds";
import { I } from "@/icons";

const QUARTERS = [
  { label: "Зима", months: [11, 0, 1] },
  { label: "Весна", months: [2, 3, 4] },
  { label: "Лето", months: [5, 6, 7] },
  { label: "Осень", months: [8, 9, 10] },
];

/** Suggest the upcoming season name from today's date. */
function suggestName(): string {
  const now = new Date();
  const m = now.getMonth();
  const idx = QUARTERS.findIndex((q) => q.months.includes(m));
  const nextIdx = (idx + 1) % 4;
  const q = QUARTERS[nextIdx]!;
  // Winter spans into next year.
  const year = nextIdx === 0 && m >= 8 ? now.getFullYear() + 1 : now.getFullYear();
  return `${q.label} ${year}`;
}

const toDateInput = (d: Date) => d.toISOString().slice(0, 10);
const toUnix = (v: string) => Math.floor(new Date(`${v}T00:00:00`).getTime() / 1000);

export function NewSeason() {
  const navigate = useNavigate();
  const run = useAction();
  const { toast } = useApp();

  const today = new Date();
  const plus3 = new Date(today);
  plus3.setMonth(plus3.getMonth() + 3);

  const [name, setName] = useState(suggestName());
  const [from, setFrom] = useState(toDateInput(today));
  const [to, setTo] = useState(toDateInput(plus3));
  const [keepRel, setKeepRel] = useState(true);
  const [archive, setArchive] = useState(true);
  const [saving, setSaving] = useState(false);

  const seasonsQuery = useQuery({
    queryKey: ["seasons"],
    queryFn: () => unwrap(api.seasons.$get()),
  });
  const activeName = seasonsQuery.data?.find((s) => s.active)?.name;

  const save = async () => {
    setSaving(true);
    const ok = await run(
      () =>
        unwrap(
          api.seasons.$post({
            json: {
              name: name.trim(),
              startsAt: toUnix(from),
              endsAt: toUnix(to),
              resetLeaderboards: true,
              keepReliability: keepRel,
              archivePrevious: archive,
            },
          }),
        ),
      { invalidate: [["seasons"], ["leaderboard"], ["me"]] },
    );
    setSaving(false);
    if (ok) {
      toast(`Сезон «${name.trim()}» открыт`);
      navigate(-1);
    }
  };

  return (
    <div className="lu-scr">
      <NavBar title="Новый сезон" onBack={() => navigate(-1)} backLabel="Сезоны" />
      <div className="lu-scr__body">
        <p className="lu-lede" style={{ padding: "0 2px" }}>
          Сезон задаёт период, за который считаются очки, голы и лидерборды.
        </p>

        <Input label="Название сезона" value={name} onChange={(e) => setName(e.target.value)} placeholder="напр. Осень 2026" leadingIcon={<I.Trophy width={16} height={16} />} />
        <div className="lu-form-grid">
          <Input label="Старт" type="date" value={from} onChange={(e) => setFrom(e.target.value)} leadingIcon={<I.Calendar width={16} height={16} />} />
          <Input label="Конец" type="date" value={to} onChange={(e) => setTo(e.target.value)} leadingIcon={<I.Flag width={16} height={16} />} />
        </div>

        <ListSection label="Что произойдёт при открытии" footer="Прошлый сезон закроется, но останется доступен в архиве.">
          <ListItem
            icon={<I.Refresh width={16} height={16} />}
            iconColor="var(--accent)"
            title="Обнулить лидерборды"
            subtitle="очки и форма считаются с нуля"
            trailing={<Switch checked onChange={() => {}} />}
          />
          <ListItem
            icon={<I.Star width={16} height={16} />}
            iconColor="var(--info)"
            title="Сохранить надёжность игроков"
            subtitle="не сбрасывать историю явок"
            trailing={<Switch checked={keepRel} onChange={setKeepRel} />}
          />
          <ListItem
            icon={<I.Lock width={16} height={16} />}
            iconColor="var(--gray-500)"
            title="Архивировать прошлый сезон"
            subtitle={activeName ? `«${activeName}» только для чтения` : "только для чтения"}
            trailing={<Switch checked={archive} onChange={setArchive} />}
          />
        </ListSection>

        <p className="lu-note lu-center">
          <I.Info width={13} height={13} style={{ verticalAlign: -2, marginRight: 4 }} />
          Текущий активный сезон — <b style={{ color: "var(--text)" }}>{activeName ?? "—"}</b>. Игры из него не удаляются.
        </p>
      </div>
      <div className="lu-mainbtn">
        <Button block size="lg" loading={saving} disabled={!name.trim()} leadingIcon={<I.Trophy width={18} height={18} />} onClick={save}>
          Открыть сезон
        </Button>
      </div>
    </div>
  );
}
