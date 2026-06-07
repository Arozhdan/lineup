/* 6.7 Площадки и инвентарь. */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { api, unwrap } from "@/api/client";
import { useAction } from "@/app/AppContext";
import { Badge, Button, Card, Input, NavBar, Sheet } from "@/ds";
import { I } from "@/icons";
import { fmtMoney } from "@/lib/format";
import { AddVenueSheet } from "@/screens/shared/AddVenueSheet";

type Venue = { id: number; name: string; addr: string; mapsUrl: string; rent: number; balls: number; bibs: number };

export function Venues() {
  const navigate = useNavigate();
  const run = useAction();
  const [addOpen, setAddOpen] = useState(false);
  const [edit, setEdit] = useState<Venue | null>(null);
  const [form, setForm] = useState({ name: "", addr: "", mapsUrl: "", rent: "", balls: "", bibs: "" });
  const [saving, setSaving] = useState(false);

  const venuesQuery = useQuery({
    queryKey: ["venues"],
    queryFn: () => unwrap(api.venues.$get()),
  });
  const list = (venuesQuery.data ?? []) as Venue[];

  const openEdit = (v: Venue) => {
    setForm({ name: v.name, addr: v.addr, mapsUrl: v.mapsUrl ?? "", rent: String(v.rent), balls: String(v.balls), bibs: String(v.bibs) });
    setEdit(v);
  };

  const save = async () => {
    if (!edit) return;
    setSaving(true);
    const ok = await run(
      () =>
        unwrap(
          api.venues[":id"].$patch({
            param: { id: String(edit.id) },
            json: { name: form.name.trim(), addr: form.addr.trim(), mapsUrl: form.mapsUrl.trim(), rent: +form.rent || 0, balls: +form.balls || 0, bibs: +form.bibs || 0 },
          }),
        ),
      { ok: "Площадка сохранена", invalidate: [["venues"]] },
    );
    setSaving(false);
    if (ok) setEdit(null);
  };

  const archive = async () => {
    if (!edit) return;
    const ok = await run(() => unwrap(api.venues[":id"].$delete({ param: { id: String(edit.id) } })), {
      ok: "Площадка архивирована",
      invalidate: [["venues"]],
    });
    if (ok) setEdit(null);
  };

  return (
    <div className="lu-scr">
      <NavBar
        title="Площадки и инвентарь"
        onBack={() => navigate(-1)}
        backLabel="Назад"
        trailing={
          <button className="lu-iconbtn" style={{ color: "var(--accent)" }} onClick={() => setAddOpen(true)}>
            <I.Plus width={22} height={22} />
          </button>
        }
      />
      <div className="lu-scr__body">
        <p className="lu-lede" style={{ padding: "0 2px" }}>
          Сохранённые поля для создания игр. Адрес, аренда и инвентарь.
        </p>

        {venuesQuery.isPending && <div className="lu-skel" style={{ height: 120, borderRadius: "var(--radius-lg)" }} />}

        {list.map((v) => (
          <Card pad key={v.id} onClick={() => openEdit(v)}>
            <div className="lu-row" style={{ gap: 12 }}>
              <span className="lu-mode-card__ic" style={{ background: "var(--grad-pitch)" }}>
                <I.Field width={20} height={20} />
              </span>
              <div className="lu-grow">
                <div style={{ fontSize: 16, fontWeight: 600 }}>{v.name}</div>
                <div className="lu-muted">{v.addr}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, color: "var(--text)" }}>{fmtMoney(v.rent)}</div>
                <div className="lu-muted" style={{ fontSize: 11 }}>аренда</div>
              </div>
            </div>
            <div className="lu-row" style={{ marginTop: 10, gap: 8 }}>
              <Badge variant="neutral">⚽ мячи: {v.balls}</Badge>
              <Badge variant="neutral">🦺 манишки: {v.bibs}</Badge>
            </div>
          </Card>
        ))}

        <Button block variant="secondary" leadingIcon={<I.Plus width={18} height={18} />} onClick={() => setAddOpen(true)}>
          Добавить площадку
        </Button>
      </div>

      <AddVenueSheet open={addOpen} onClose={() => setAddOpen(false)} />

      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.name ?? ""}>
        <div className="lu-stack" style={{ gap: 12 }}>
          <Input label="Название поля" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} leadingIcon={<I.Field width={16} height={16} />} />
          <Input label="Адрес" value={form.addr} onChange={(e) => setForm((f) => ({ ...f, addr: e.target.value }))} leadingIcon={<I.Pin width={16} height={16} />} />
          <Input
            label="Ссылка на Google Maps"
            value={form.mapsUrl}
            onChange={(e) => setForm((f) => ({ ...f, mapsUrl: e.target.value }))}
            placeholder="https://maps.app.goo.gl/…"
            leadingIcon={<I.Map width={16} height={16} />}
            help="Из неё возьмём координаты для карты на странице игры."
          />
          <Input label="Аренда за слот" value={form.rent} onChange={(e) => setForm((f) => ({ ...f, rent: e.target.value }))} inputMode="numeric" leadingIcon={<I.Coins width={16} height={16} />} />
          <div className="lu-form-grid">
            <Input label="Мячи" value={form.balls} onChange={(e) => setForm((f) => ({ ...f, balls: e.target.value }))} inputMode="numeric" />
            <Input label="Манишки" value={form.bibs} onChange={(e) => setForm((f) => ({ ...f, bibs: e.target.value }))} inputMode="numeric" />
          </div>
          <Button block size="lg" loading={saving} disabled={!form.name.trim()} onClick={save}>
            Сохранить
          </Button>
          <Button block variant="destructive" leadingIcon={<I.Trash width={16} height={16} />} onClick={archive}>
            Архивировать
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
