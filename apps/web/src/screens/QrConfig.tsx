/* 7.2·QR Реквизиты для QR (владелец). */
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { api, unwrap, uploadFile } from "@/api/client";
import { useApp, useAction } from "@/app/AppContext";
import { Button, Input, ListItem, ListSection, NavBar, Switch } from "@/ds";
import { QrBox } from "@/ds/extras";
import { I } from "@/icons";

export function QrConfig() {
  const navigate = useNavigate();
  const run = useAction();
  const qc = useQueryClient();
  const { toast } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);

  const settingsQuery = useQuery({ queryKey: ["settings"], queryFn: () => unwrap(api.settings.$get()) });
  const s = settingsQuery.data;

  const [form, setForm] = useState({ qrRecipient: "", qrAccount: "", qrBank: "", qrNote: "", qrAutoConfirm: false, autoRefund: true });
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (s && !loaded) {
      setForm({
        qrRecipient: s.qrRecipient,
        qrAccount: s.qrAccount,
        qrBank: s.qrBank,
        qrNote: s.qrNote,
        qrAutoConfirm: s.qrAutoConfirm,
        autoRefund: s.autoRefund,
      });
      setLoaded(true);
    }
  }, [s, loaded]);

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const onUpload = async (file: File) => {
    await run(
      async () => {
        await uploadFile("/settings/qr/upload", file);
        await qc.invalidateQueries({ queryKey: ["settings"] });
      },
      { ok: "QR загружен" },
    );
  };

  const generate = () =>
    void run(() => unwrap(api.settings.qr.generate.$post()), {
      ok: "QR сгенерирован по реквизитам",
      invalidate: [["settings"]],
    });

  const save = async () => {
    setSaving(true);
    const ok = await run(
      () =>
        unwrap(
          api.settings.$patch({
            json: {
              qrRecipient: form.qrRecipient.trim(),
              qrAccount: form.qrAccount.trim(),
              qrBank: form.qrBank.trim(),
              qrNote: form.qrNote.trim(),
              qrAutoConfirm: form.qrAutoConfirm,
              autoRefund: form.autoRefund,
            },
          }),
        ),
      { ok: "Реквизиты сохранены", invalidate: [["settings"]] },
    );
    setSaving(false);
    if (ok) navigate(-1);
  };

  return (
    <div className="lu-scr">
      <NavBar title="Реквизиты для QR" onBack={() => navigate(-1)} backLabel="Платформа" />
      <div className="lu-scr__body">
        <p className="lu-lede" style={{ padding: "0 2px" }}>
          Этот QR показывается игрокам на экране оплаты. Все взносы идут на счёт сообщества.
        </p>

        <div className="lu-qrbox">
          <QrBox src={s?.qrImage} />
          <div className="lu-row" style={{ gap: 8 }}>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onUpload(file);
                e.target.value = "";
              }}
            />
            <Button size="sm" variant="secondary" leadingIcon={<I.Camera width={15} height={15} />} onClick={() => fileRef.current?.click()}>
              Загрузить QR
            </Button>
            <Button size="sm" variant="secondary" leadingIcon={<I.Refresh width={15} height={15} />} onClick={generate}>
              Сгенерировать
            </Button>
          </div>
          <p className="lu-note lu-center" style={{ padding: 0 }}>Загрузи QR из банка или сгенерируй по реквизитам ниже.</p>
        </div>

        <ListSection label="Куда приходят деньги">
          <Input label="Получатель" value={form.qrRecipient} onChange={(e) => set({ qrRecipient: e.target.value })} leadingIcon={<I.User width={16} height={16} />} />
          <Input label="Счёт" value={form.qrAccount} onChange={(e) => set({ qrAccount: e.target.value })} leadingIcon={<I.Wallet width={16} height={16} />} />
          <Input label="Банк" value={form.qrBank} onChange={(e) => set({ qrBank: e.target.value })} leadingIcon={<I.Shield width={16} height={16} />} />
        </ListSection>

        <Input
          label="Назначение платежа"
          value={form.qrNote}
          onChange={(e) => set({ qrNote: e.target.value })}
          help={`${s?.name ?? "название"} подставится автоматически.`}
        />

        <ListSection label="Автоматика">
          <ListItem
            icon={<I.CheckCircle width={16} height={16} />}
            iconColor="var(--accent)"
            title="Подтверждать оплату автоматически"
            subtitle="по входящему платежу"
            trailing={<Switch checked={form.qrAutoConfirm} onChange={(v) => set({ qrAutoConfirm: v })} />}
          />
          <ListItem
            icon={<I.Repeat width={16} height={16} />}
            iconColor="var(--success)"
            title="Автовозврат при отмене"
            subtitle="до дедлайна"
            trailing={<Switch checked={form.autoRefund} onChange={(v) => set({ autoRefund: v })} />}
          />
        </ListSection>

        <p className="lu-note lu-center">
          <I.Lock width={13} height={13} style={{ verticalAlign: -2, marginRight: 4 }} />
          Карты и СБП игрокам не показываются — только QR.
        </p>
      </div>
      <div className="lu-mainbtn">
        <Button block size="lg" loading={saving} onClick={save}>Сохранить</Button>
      </div>
    </div>
  );
}
