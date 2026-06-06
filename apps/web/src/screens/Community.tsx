/* 7.2 Настройки платформы (владелец). */
import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { api, unwrap } from "@/api/client";
import { useApp, useAction } from "@/app/AppContext";
import { Badge, Button, Input, ListItem, ListSection, NavBar, SegmentedControl, Switch } from "@/ds";
import { Stepper } from "@/ds/extras";
import { I } from "@/icons";

type Form = {
  name: string;
  currency: string;
  cancelDeadlineHours: number;
  noShowPenalty: number;
  minReliability: number;
  ptsAttend: number;
  ptsWin: number;
  ptsGoal: number;
  ptsAssist: number;
  ptsMvp: number;
};

export function Community() {
  const navigate = useNavigate();
  const run = useAction();
  const { toast } = useApp();
  const [lang, setLang] = useState<"RU" | "EN">("RU");
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);

  const settingsQuery = useQuery({ queryKey: ["settings"], queryFn: () => unwrap(api.settings.$get()) });
  const s = settingsQuery.data;

  useEffect(() => {
    if (s && !form) {
      setForm({
        name: s.name,
        currency: s.currency,
        cancelDeadlineHours: s.cancelDeadlineHours,
        noShowPenalty: s.noShowPenalty,
        minReliability: s.minReliability,
        ptsAttend: s.ptsAttend,
        ptsWin: s.ptsWin,
        ptsGoal: s.ptsGoal,
        ptsAssist: s.ptsAssist,
        ptsMvp: s.ptsMvp,
      });
    }
  }, [s, form]);

  const set = (patch: Partial<Form>) => setForm((f) => (f ? { ...f, ...patch } : f));

  const toggleCash = (v: boolean) =>
    void run(() => unwrap(api.settings.$patch({ json: { cashEnabled: v } })), {
      ok: v ? "Отметка «наличными» включена" : "Отметка «наличными» выключена",
      invalidate: [["settings"]],
    });

  const save = async () => {
    if (!form) return;
    setSaving(true);
    await run(
      () =>
        unwrap(
          api.settings.$patch({
            json: {
              name: form.name.trim(),
              currency: form.currency.trim(),
              cancelDeadlineHours: form.cancelDeadlineHours,
              noShowPenalty: form.noShowPenalty,
              minReliability: form.minReliability,
              ptsAttend: form.ptsAttend,
              ptsWin: form.ptsWin,
              ptsGoal: form.ptsGoal,
              ptsAssist: form.ptsAssist,
              ptsMvp: form.ptsMvp,
            },
          }),
        ),
      { ok: "Настройки сохранены", invalidate: [["settings"]] },
    );
    setSaving(false);
  };

  if (!form) {
    return (
      <div className="lu-scr">
        <NavBar title="Настройки платформы" onBack={() => navigate(-1)} backLabel="Назад" />
        <div className="lu-scr__body">
          <div className="lu-skel" style={{ height: 300, borderRadius: "var(--radius-lg)" }} />
        </div>
      </div>
    );
  }

  const stepIcon = (
    title: string,
    icon: ReactNode,
    iconColor: string,
    value: number,
    suffix: string,
    onDec: () => void,
    onInc: () => void,
    subtitle?: string,
  ) => (
    <ListItem
      icon={icon}
      iconColor={iconColor}
      title={title}
      subtitle={subtitle}
      value={value + suffix}
      trailing={<Stepper value={value} onDec={onDec} onInc={onInc} />}
    />
  );

  return (
    <div className="lu-scr">
      <NavBar title="Настройки платформы" onBack={() => navigate(-1)} backLabel="Назад" />
      <div className="lu-scr__body">
        <div className="lu-profile-head" style={{ paddingBottom: 6 }}>
          <span className="lu-mode-card__ic" style={{ background: "var(--grad-pitch)", width: 72, height: 72, borderRadius: 22 }}>
            <I.Shield width={34} height={34} />
          </span>
          <div className="lu-profile-name" style={{ fontSize: 20 }}>{form.name}</div>
        </div>

        <Input label="Название сообщества" value={form.name} onChange={(e) => set({ name: e.target.value })} />

        <div className="lu-form-grid">
          <Input label="Валюта" value={form.currency} onChange={(e) => set({ currency: e.target.value })} placeholder="напр. Kč, €, zł" help="напр. Kč, €, zł" leadingIcon={<I.Coins width={16} height={16} />} />
          <div>
            <div className="lu-section-label" style={{ marginBottom: 8, paddingLeft: 2 }}>Язык</div>
            <SegmentedControl
              value={lang}
              onChange={(v) => {
                if (v === "EN") toast("Пока только русский");
                else setLang(v);
              }}
              options={["RU", "EN"]}
            />
          </div>
        </div>

        <ListSection label="Способ оплаты" footer="Все взносы собираются по QR. Карты и СБП не используются.">
          <ListItem icon={<I.QrCode width={16} height={16} />} iconColor="var(--accent)" title="Оплата по QR" subtitle="единственный способ" trailing={<Badge variant="success">вкл</Badge>} />
          <ListItem icon={<I.Wallet width={16} height={16} />} iconColor="var(--gray-500)" title="Реквизиты для QR" subtitle="настроить получателя и счёт" chevron onClick={() => navigate("/qrconfig")} />
          <ListItem icon={<I.Coins width={16} height={16} />} iconColor="var(--gray-500)" title="Отметка «наличными»" subtitle="организатор отмечает вручную" trailing={<Switch checked={s?.cashEnabled ?? false} onChange={toggleCash} />} />
        </ListSection>

        <ListSection label="Политики по умолчанию">
          {stepIcon("Дедлайн отмены", <I.Clock width={16} height={16} />, "var(--info)", form.cancelDeadlineHours, " ч", () => set({ cancelDeadlineHours: Math.max(0, form.cancelDeadlineHours - 1) }), () => set({ cancelDeadlineHours: Math.min(72, form.cancelDeadlineHours + 1) }), "возврат до этого срока")}
          {stepIcon("Штраф за неявку", <I.AlertTriangle width={16} height={16} />, "var(--warning)", form.noShowPenalty, " баллов", () => set({ noShowPenalty: Math.max(0, form.noShowPenalty - 1) }), () => set({ noShowPenalty: Math.min(50, form.noShowPenalty + 1) }))}
          {stepIcon("Мин. надёжность для записи", <I.Star width={16} height={16} />, "var(--accent)", form.minReliability, "%", () => set({ minReliability: Math.max(0, form.minReliability - 5) }), () => set({ minReliability: Math.min(100, form.minReliability + 5) }))}
        </ListSection>

        <ListSection label="Начисление очков">
          {stepIcon("За явку", <I.CheckCircle width={16} height={16} />, "var(--accent)", form.ptsAttend, "", () => set({ ptsAttend: Math.max(0, form.ptsAttend - 1) }), () => set({ ptsAttend: Math.min(20, form.ptsAttend + 1) }))}
          {stepIcon("За победу", <I.Trophy width={16} height={16} />, "#E8B923", form.ptsWin, "", () => set({ ptsWin: Math.max(0, form.ptsWin - 1) }), () => set({ ptsWin: Math.min(20, form.ptsWin + 1) }))}
          {stepIcon("Гол", <I.Target width={16} height={16} />, "var(--success)", form.ptsGoal, "", () => set({ ptsGoal: Math.max(0, form.ptsGoal - 1) }), () => set({ ptsGoal: Math.min(20, form.ptsGoal + 1) }))}
          {stepIcon("Пас", <I.Share width={16} height={16} />, "var(--info)", form.ptsAssist, "", () => set({ ptsAssist: Math.max(0, form.ptsAssist - 1) }), () => set({ ptsAssist: Math.min(20, form.ptsAssist + 1) }))}
          {stepIcon("MVP", <I.Star width={16} height={16} />, "var(--accent)", form.ptsMvp, "", () => set({ ptsMvp: Math.max(0, form.ptsMvp - 1) }), () => set({ ptsMvp: Math.min(20, form.ptsMvp + 1) }))}
        </ListSection>

        <Button block size="lg" loading={saving} onClick={save}>Сохранить</Button>
        <Button block variant="secondary" leadingIcon={<I.Users width={18} height={18} />} onClick={() => navigate("/roles")}>
          Роли и доступы
        </Button>
      </div>
    </div>
  );
}
