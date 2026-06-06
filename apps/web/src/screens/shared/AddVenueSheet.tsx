/* Add-venue bottom sheet (6.7) — used from CreateGame and the Venues screen. */
import { useState } from "react";
import { api, unwrap } from "@/api/client";
import { useAction } from "@/app/AppContext";
import { Button, Input, Sheet } from "@/ds";
import { I } from "@/icons";

export function AddVenueSheet({
  open,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  onAdded?: (venue: { id: number; name: string }) => void;
}) {
  const run = useAction();
  const [name, setName] = useState("");
  const [addr, setAddr] = useState("");
  const [rent, setRent] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const ok = await run(
      async () => {
        const venue = await unwrap(
          api.venues.$post({
            json: { name: name.trim(), addr: addr.trim(), rent: +rent || 0, balls: 2, bibs: 12 },
          }),
        );
        onAdded?.(venue);
      },
      { ok: "Площадка добавлена", invalidate: [["venues"]] },
    );
    setSaving(false);
    if (ok) {
      setName("");
      setAddr("");
      setRent("");
      onClose();
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Новая площадка">
      <div className="lu-stack" style={{ gap: 12 }}>
        <Input label="Название поля" value={name} onChange={(e) => setName(e.target.value)} placeholder="напр. Лужники, поле 5" leadingIcon={<I.Field width={16} height={16} />} />
        <Input label="Адрес" value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="улица, дом" leadingIcon={<I.Pin width={16} height={16} />} />
        <Input label="Аренда за слот" value={rent} onChange={(e) => setRent(e.target.value)} placeholder="0" inputMode="numeric" leadingIcon={<I.Coins width={16} height={16} />} />
        <div className="lu-map" style={{ height: 96 }}>
          <div className="lu-map__pin"><I.Pin width={26} height={26} /></div>
          <div className="lu-map__chip">Адрес появится на карте</div>
        </div>
        <Button block size="lg" loading={saving} disabled={!name.trim()} onClick={() => void save()}>
          Сохранить площадку
        </Button>
      </div>
    </Sheet>
  );
}
