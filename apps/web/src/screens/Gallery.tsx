/* 3.2 Галерея матча. */
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router";
import { api, unwrap, uploadFile } from "@/api/client";
import { useApp, useAction } from "@/app/AppContext";
import { NavBar } from "@/ds";
import { I } from "@/icons";

export function Gallery() {
  const navigate = useNavigate();
  const { id = "" } = useParams();
  const { isOrganizer, toast } = useApp();
  const run = useAction();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const photosQuery = useQuery({
    queryKey: ["photos", id],
    queryFn: () => unwrap(api.games[":id"].photos.$get({ param: { id } })),
    enabled: !!id,
  });
  const photos = photosQuery.data ?? [];

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    const ok = await run(() => uploadFile(`/games/${id}/photos`, file), { invalidate: [["photos", id]] });
    setUploading(false);
    if (ok) toast("Фото добавлено");
  };

  const del = (photoId: number) =>
    run(() => unwrap(api.photos[":id"].$delete({ param: { id: String(photoId) } })), {
      ok: "Фото удалено",
      invalidate: [["photos", id]],
    });

  return (
    <div className="lu-scr">
      <NavBar title="Галерея матча" onBack={() => navigate(-1)} backLabel="Назад" />
      <div className="lu-scr__body">
        <div className="lu-gallery">
          <button className="lu-gallery__cell lu-gallery__upload" onClick={() => fileRef.current?.click()} disabled={uploading}>
            <div style={{ textAlign: "center" }}>
              {uploading ? <span className="lu-btn__spinner" aria-hidden="true" /> : <I.Camera width={22} height={22} />}
              <div style={{ fontSize: 11, marginTop: 4 }}>{uploading ? "Загрузка…" : "Добавить"}</div>
            </div>
          </button>
          {photos.map((p) => (
            <div className="lu-gallery__cell" key={p.id}>
              <img src={p.url} alt={`Фото от ${p.by}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              {(p.mine || isOrganizer) && (
                <button className="lu-gallery__del" onClick={() => del(p.id)} aria-label="Удалить фото">
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPick} />
        <p className="lu-note lu-center">Фото видят все участники матча. Организатор может удалить неподходящие.</p>
      </div>
    </div>
  );
}
