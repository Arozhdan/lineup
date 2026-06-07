/* Группы (аудитории) — внутренние списки для приватных игр. Игроки их не видят. */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { api, unwrap } from "@/api/client";
import { useAction } from "@/app/AppContext";
import { Avatar, Button, Card, EmptyState, Input, ListItem, ListSection, NavBar, Sheet } from "@/ds";
import { I } from "@/icons";
import { plural } from "@/lib/format";

type Group = { id: number; name: string; members: { id: number; name: string; photoUrl: string; handle: string }[] };

export function Groups() {
  const navigate = useNavigate();
  const run = useAction();

  const groupsQuery = useQuery({
    queryKey: ["groups"],
    queryFn: () => unwrap(api.groups.$get()),
  });
  const list: Group[] = groupsQuery.data ?? [];

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = list.find((g) => g.id === selectedId) ?? null;

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);

  const playersQuery = useQuery({
    queryKey: ["players", "search", search],
    queryFn: () => unwrap(api.players.$get({ query: { q: search } })),
    enabled: addOpen,
  });
  const candidates = (playersQuery.data ?? []).filter((p) => !selected?.members.some((m) => m.id === p.id));

  const create = async () => {
    setSaving(true);
    const ok = await run(
      async () => {
        const g = await unwrap(api.groups.$post({ json: { name: name.trim() } }));
        setSelectedId(g.id);
      },
      { ok: "Группа создана", invalidate: [["groups"]] },
    );
    setSaving(false);
    if (ok) {
      setName("");
      setCreateOpen(false);
    }
  };

  const rename = async () => {
    if (!selected) return;
    setSaving(true);
    await run(() => unwrap(api.groups[":id"].$patch({ param: { id: String(selected.id) }, json: { name: name.trim() } })), {
      ok: "Переименовано",
      invalidate: [["groups"]],
    });
    setSaving(false);
    setRenaming(false);
  };

  const remove = async () => {
    if (!selected) return;
    setSaving(true);
    const ok = await run(() => unwrap(api.groups[":id"].$delete({ param: { id: String(selected.id) } })), {
      ok: "Группа удалена",
      invalidate: [["groups"]],
    });
    setSaving(false);
    if (ok) {
      setDeleteOpen(false);
      setSelectedId(null);
    }
  };

  const addMember = (userId: number) =>
    void run(
      () => unwrap(api.groups[":id"].members.$post({ param: { id: String(selectedId) }, json: { userId } })),
      { ok: "Добавлен в группу", invalidate: [["groups"]] },
    );

  const removeMember = (userId: number) =>
    void run(
      () =>
        unwrap(api.groups[":id"].members[":userId"].$delete({ param: { id: String(selectedId), userId: String(userId) } })),
      { ok: "Убран из группы", invalidate: [["groups"]] },
    );

  /* ------------------------------------------------- group detail view */
  if (selected) {
    return (
      <div className="lu-scr">
        <NavBar
          title={selected.name}
          subtitle={`${selected.members.length} ${plural(selected.members.length, "участник", "участника", "участников")}`}
          onBack={() => setSelectedId(null)}
          backLabel="Группы"
          trailing={
            <button
              className="lu-iconbtn"
              onClick={() => {
                setName(selected.name);
                setRenaming(true);
              }}
            >
              <I.Edit width={19} height={19} />
            </button>
          }
        />
        <div className="lu-scr__body">
          <p className="lu-note" style={{ padding: "0 2px" }}>
            <I.Lock width={13} height={13} style={{ verticalAlign: -2, marginRight: 4 }} />
            Группа внутренняя: игроки не видят ни её, ни своё членство.
          </p>
          {selected.members.length ? (
            <Card>
              <div className="lu-pool">
                {selected.members.map((m) => (
                  <div key={m.id} className="lu-pool-card" style={{ cursor: "default" }}>
                    <Avatar name={m.name} src={m.photoUrl || undefined} size={36} />
                    <span className="lu-grow" style={{ fontSize: 15, color: "var(--text)" }}>
                      {m.name}
                    </span>
                    <button
                      className="lu-iconbtn"
                      style={{ width: 28, height: 28, color: "var(--text-hint)" }}
                      onClick={() => removeMember(m.id)}
                    >
                      <I.X width={15} height={15} />
                    </button>
                  </div>
                ))}
              </div>
            </Card>
          ) : (
            <EmptyState icon={<I.Users />} title="Пока пусто" description="Добавь игроков — они не узнают об этом." />
          )}
          <Button block variant="secondary" leadingIcon={<I.UserPlus width={18} height={18} />} onClick={() => { setSearch(""); setAddOpen(true); }}>
            Добавить игрока
          </Button>
          <Button block variant="ghost" style={{ color: "var(--danger)" }} leadingIcon={<I.Trash width={16} height={16} />} onClick={() => setDeleteOpen(true)}>
            Удалить группу
          </Button>
        </div>

        <Sheet open={addOpen} onClose={() => setAddOpen(false)} title="Добавить игрока">
          <div className="lu-stack" style={{ gap: 12 }}>
            <Input placeholder="Поиск по имени" value={search} onChange={(e) => setSearch(e.target.value)} leadingIcon={<I.User width={16} height={16} />} />
            <div className="lu-pool" style={{ maxHeight: 320, overflowY: "auto" }}>
              {candidates.map((p) => (
                <button key={p.id} className="lu-pool-card" onClick={() => addMember(p.id)}>
                  <Avatar name={p.name} src={p.photoUrl || undefined} size={36} />
                  <span className="lu-grow" style={{ fontSize: 15, color: "var(--text)" }}>
                    {p.name}
                  </span>
                  <I.Plus width={18} height={18} style={{ color: "var(--accent)" }} />
                </button>
              ))}
              {!candidates.length && <p className="lu-note lu-center">Никого не нашлось.</p>}
            </div>
          </div>
        </Sheet>

        <Sheet open={renaming} onClose={() => setRenaming(false)} title="Переименовать группу">
          <div className="lu-stack" style={{ gap: 12 }}>
            <Input label="Название" value={name} onChange={(e) => setName(e.target.value)} />
            <Button block size="lg" loading={saving} disabled={!name.trim()} onClick={() => void rename()}>
              Сохранить
            </Button>
          </div>
        </Sheet>

        <Sheet open={deleteOpen} onClose={() => setDeleteOpen(false)} title={`Удалить «${selected.name}»?`}>
          <p className="lu-sheet-lede">
            Игры, ограниченные этой группой, останутся видны только участникам и организаторам.
          </p>
          <div className="lu-stack">
            <Button block size="lg" variant="destructive" loading={saving} onClick={() => void remove()}>
              Удалить
            </Button>
            <Button block variant="ghost" onClick={() => setDeleteOpen(false)}>
              Отмена
            </Button>
          </div>
        </Sheet>
      </div>
    );
  }

  /* ------------------------------------------------------- groups list */
  return (
    <div className="lu-scr">
      <NavBar
        title="Группы и аудитории"
        onBack={() => navigate(-1)}
        backLabel="Назад"
        trailing={
          <button className="lu-iconbtn" style={{ color: "var(--accent)" }} onClick={() => { setName(""); setCreateOpen(true); }}>
            <I.Plus width={22} height={22} />
          </button>
        }
      />
      <div className="lu-scr__body">
        <p className="lu-lede" style={{ padding: "0 2px" }}>
          Внутренние списки игроков для приватных игр: при создании игры выбери, каким группам она видна. Игроки о группах
          не знают.
        </p>
        {groupsQuery.isPending && <div className="lu-skel" style={{ height: 90, borderRadius: "var(--radius-lg)" }} />}
        {list.length > 0 && (
          <ListSection>
            {list.map((g) => (
              <ListItem
                key={g.id}
                icon={<I.Users width={16} height={16} />}
                iconColor="var(--accent)"
                title={g.name}
                subtitle={`${g.members.length} ${plural(g.members.length, "участник", "участника", "участников")}`}
                chevron
                onClick={() => setSelectedId(g.id)}
              />
            ))}
          </ListSection>
        )}
        {!groupsQuery.isPending && !list.length && (
          <EmptyState
            icon={<I.Users />}
            title="Групп пока нет"
            description="Создай первую — например «Постоянный состав» или «Ветераны»."
            action={<Button onClick={() => setCreateOpen(true)}>Создать группу</Button>}
          />
        )}
      </div>

      <Sheet open={createOpen} onClose={() => setCreateOpen(false)} title="Новая группа">
        <div className="lu-stack" style={{ gap: 12 }}>
          <Input label="Название" value={name} onChange={(e) => setName(e.target.value)} placeholder="напр. Постоянный состав" />
          <Button block size="lg" loading={saving} disabled={!name.trim()} onClick={() => void create()}>
            Создать
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
