/* 4.2 Панель управления игрой (ростер + хаб). */
import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router";
import { api, unwrap } from "@/api/client";
import { useAction, useApp } from "@/app/AppContext";
import { Avatar, Button, Card, EmptyState, Input, NavBar, PositionBadge, Sheet } from "@/ds";
import { relColor } from "@/ds/extras";
import { I } from "@/icons";
import { fmtDay, fmtTime, plural } from "@/lib/format";
import { LEVEL_LABEL, PAY_STATUS_LABEL, type PayStatus } from "@lineup/shared";

type Detail = Awaited<ReturnType<typeof unwrap<ReturnType<(typeof api.games)[":id"]["$get"]>>>>;
type RosterRow = Detail["roster"][number];

const UNPAID = new Set<PayStatus>(["unpaid", "marked", "partial"]);

/** YYYY-MM-DD for a Date in local time. */
const toDateInput = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const toTimeInput = (d: Date): string =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

export function Manage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { toast } = useApp();
  const run = useAction();

  const [tab, setTab] = useState<"confirmed" | "waitlist" | "pending">("confirmed");
  const [sheet, setSheet] = useState<null | "more" | "cancel" | "reschedule" | "visibility">(null);
  const [visDraft, setVisDraft] = useState<number[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [busy, setBusy] = useState(false);

  const gameQuery = useQuery({
    queryKey: ["game", id],
    queryFn: () => unwrap(api.games[":id"].$get({ param: { id: String(id) } })),
    enabled: !!id,
  });
  const g = gameQuery.data;

  const invalidate: string[][] = [["game", id], ["games"]];

  const groupsQuery = useQuery({
    queryKey: ["groups"],
    queryFn: () => unwrap(api.groups.$get()),
  });
  const groupList = groupsQuery.data ?? [];

  const openReschedule = () => {
    if (g) {
      const d = new Date(g.startsAt * 1000);
      setDate(toDateInput(d));
      setTime(toTimeInput(d));
    }
    setSheet("reschedule");
  };

  const kick = (userId: number) =>
    void run(() => unwrap(api.games[":id"].kick.$post({ param: { id: String(id) }, json: { userId } })), {
      ok: "Игрок убран из состава",
      invalidate,
    });

  const promote = (userId: number) =>
    void run(() => unwrap(api.games[":id"].promote.$post({ param: { id: String(id) }, json: { userId } })), {
      ok: "Игрок в составе",
      invalidate,
    });

  const approve = (userId: number, accept: boolean) =>
    void run(() => unwrap(api.games[":id"].approve.$post({ param: { id: String(id) }, json: { userId, accept } })), {
      ok: accept ? "Заявка одобрена" : "Заявка отклонена",
      invalidate,
    });

  const reschedule = async () => {
    const startsAt = Math.floor(new Date(`${date}T${time}`).getTime() / 1000);
    if (!Number.isFinite(startsAt) || startsAt * 1000 <= Date.now()) {
      toast("Дата должна быть в будущем", "error");
      return;
    }
    setBusy(true);
    const ok = await run(
      () => unwrap(api.games[":id"].$patch({ param: { id: String(id) }, json: { startsAt, deadlineAt: startsAt - 2 * 3600 } })),
      { ok: "Игра перенесена — игроки получат уведомление", invalidate },
    );
    setBusy(false);
    if (ok) setSheet(null);
  };

  const cancel = async () => {
    setBusy(true);
    const ok = await run(() => unwrap(api.games[":id"].cancel.$post({ param: { id: String(id) }, json: { reason: reason.trim() } })), {
      ok: "Игра отменена",
      invalidate,
    });
    setBusy(false);
    if (ok) navigate("/", { replace: true });
  };

  const share = () => {
    void navigator.clipboard?.writeText(`${location.origin}/#/game/${id}`);
    toast("Ссылка скопирована");
  };

  const paid = g ? g.roster.filter((p) => p.payStatus === "paid" || p.payStatus === "waived").length : 0;
  const unpaidCount = g ? g.roster.filter((p) => UNPAID.has(p.payStatus as PayStatus)).length : 0;

  const actions: { l: string; ic: ReactNode; c: string; badge?: number; go: () => void }[] = [
    { l: "Команды", ic: <I.Shuffle width={18} height={18} />, c: "var(--accent)", go: () => navigate(`/game/${id}/split`) },
    { l: "Чек-ин", ic: <I.CheckCircle width={18} height={18} />, c: "var(--info)", go: () => navigate(`/game/${id}/checkin`) },
    { l: "Табло", ic: <I.Whistle width={18} height={18} />, c: "var(--danger)", go: () => navigate(`/game/${id}/live`) },
    { l: "Статистика", ic: <I.BarChart width={18} height={18} />, c: "var(--gray-600)", go: () => navigate(`/game/${id}/stats`) },
    { l: "Сверка оплат", ic: <I.Wallet width={18} height={18} />, c: "var(--success)", badge: unpaidCount, go: () => navigate(`/game/${id}/reconcile`) },
    { l: "Рассылка", ic: <I.Megaphone width={18} height={18} />, c: "#8B5CF6", go: () => navigate(`/broadcast?game=${id}`) },
  ];

  return (
    <div className="lu-scr">
      <NavBar
        title="Управление игрой"
        subtitle={g ? `${g.title} · ${fmtDay(g.startsAt)}` : undefined}
        onBack={() => navigate("/")}
        backLabel="Игры"
        trailing={
          <button className="lu-iconbtn" onClick={() => setSheet("more")}>
            <I.Settings width={20} height={20} />
          </button>
        }
      />
      <div className="lu-scr__body" style={{ paddingTop: 12 }}>
        {g?.finishedAt && (
          <button className="lu-toast-inline" style={{ justifyContent: "center", width: "100%" }} onClick={() => navigate(`/game/${id}/result`)}>
            <I.Trophy width={18} height={18} />
            Игра завершена — открыть итог
          </button>
        )}

        <div className="lu-actions">
          {actions.map((a) => (
            <button key={a.l} className="lu-action" onClick={a.go}>
              {a.badge ? <span className="lu-action__badge">{a.badge}</span> : null}
              <span className="lu-action__ic" style={{ background: a.c }}>
                {a.ic}
              </span>
              <span className="lu-action__l">{a.l}</span>
            </button>
          ))}
        </div>

        {g?.restricted && (
          <p className="lu-note" style={{ padding: "0 2px" }}>
            <I.Lock width={13} height={13} style={{ verticalAlign: -2, marginRight: 4 }} />
            Приватная игра · видна группам: {g.audienceGroups.map((x) => x.name).join(", ")}
          </p>
        )}

        <div className="lu-tablist" style={{ marginTop: 4 }}>
          {(
            [
              ["confirmed", "Состав", g?.roster.length ?? 0],
              ["waitlist", "Ожидание", g?.waitlist.length ?? 0],
              ["pending", "Заявки", g?.pending.length ?? 0],
            ] as const
          ).map(([k, l, n]) => (
            <button key={k} className="lu-tablist__t" data-on={tab === k} onClick={() => setTab(k)}>
              {l}
              <span className="lu-tablist__n">{n}</span>
            </button>
          ))}
        </div>

        {g && tab === "confirmed" && (
          <>
            <div className="lu-row lu-row--between" style={{ padding: "0 2px" }}>
              <span className="lu-section-label">
                Основных {g.roster.length} из {g.mainSlots} · +{g.subSlots} запасных
              </span>
              <span className="lu-bar__lbl">
                оплатили <b>{paid}</b>/{g.roster.length}
              </span>
            </div>
            <Card>
              <div className="lu-pool">
                {g.roster.map((p, i) => (
                  <div key={p.signupId} className="lu-pool-card" style={{ cursor: "default" }}>
                    <Avatar name={p.name} src={p.photoUrl || undefined} size={36} />
                    <span className="lu-grow">
                      <span style={{ display: "block", fontSize: 15, color: "var(--text)" }}>
                        {p.name}
                        {i >= g.mainSlots && <span style={{ fontSize: 11, color: "var(--text-hint)" }}> · запасной</span>}
                      </span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text-hint)" }}>
                        <span className="lu-pay-state" data-s={p.payStatus} />
                        {PAY_STATUS_LABEL[p.payStatus as PayStatus]}
                      </span>
                    </span>
                    {p.position && <PositionBadge code={p.position} />}
                    <button
                      className="lu-iconbtn"
                      style={{ width: 28, height: 28, color: "var(--text-hint)" }}
                      onClick={() => kick(p.id)}
                    >
                      <I.X width={15} height={15} />
                    </button>
                  </div>
                ))}
                {!g.roster.length && (
                  <div className="lu-team__empty">Пока никого. Добавь игроков вручную.</div>
                )}
              </div>
            </Card>
            <Button block variant="secondary" leadingIcon={<I.UserPlus width={18} height={18} />} onClick={() => setAddOpen(true)}>
              Добавить игрока вручную
            </Button>
          </>
        )}

        {g && tab === "waitlist" && (
          <Card>
            <div className="lu-pool">
              {g.waitlist.map((p, i) => (
                <div key={p.signupId} className="lu-pool-card" style={{ cursor: "default" }}>
                  <span className="lu-rank">{i + 1}</span>
                  <Avatar name={p.name} src={p.photoUrl || undefined} size={36} />
                  <span className="lu-grow" style={{ fontSize: 15, color: "var(--text)" }}>
                    {p.name}
                  </span>
                  <Button size="sm" variant="secondary" onClick={() => promote(p.id)}>
                    В состав
                  </Button>
                </div>
              ))}
              {!g.waitlist.length && <div className="lu-team__empty">Лист ожидания пуст.</div>}
            </div>
          </Card>
        )}

        {g && tab === "pending" && (
          g.pending.length ? (
            <>
              <Card>
                <div className="lu-pool">
                  {g.pending.map((p) => (
                    <div key={p.signupId} className="lu-pool-card" style={{ cursor: "default" }}>
                      <Avatar name={p.name} src={p.photoUrl || undefined} size={36} />
                      <span className="lu-grow">
                        <span style={{ display: "block", fontSize: 15, color: "var(--text)" }}>{p.name}</span>
                        <span style={{ fontSize: 12, color: "var(--text-hint)" }}>
                          <span style={{ color: relColor(p.reliability), fontWeight: 600 }}>надёжность {p.reliability}%</span>
                          {" · "}{p.points} {plural(p.points, "очко", "очка", "очков")} · ур. {p.level} ({LEVEL_LABEL[p.level] ?? "Средний"})
                        </span>
                      </span>
                      <button className="lu-iconbtn lu-iconbtn--fill" style={{ color: "var(--danger)" }} onClick={() => approve(p.id, false)}>
                        <I.X width={18} height={18} />
                      </button>
                      <button className="lu-iconbtn" style={{ background: "var(--accent)", color: "#fff" }} onClick={() => approve(p.id, true)}>
                        <I.Check width={18} height={18} />
                      </button>
                    </div>
                  ))}
                </div>
              </Card>
              <Button block variant="secondary" leadingIcon={<I.Shield width={18} height={18} />} onClick={() => navigate(`/game/${id}/approve`)}>
                Разобрать заявки подробно
              </Button>
            </>
          ) : (
            <EmptyState icon={<I.Inbox />} title="Заявок нет" description="Новые заявки появятся здесь." />
          )
        )}
      </div>

      {/* more-sheet */}
      <Sheet open={sheet === "more"} onClose={() => setSheet(null)} title="Игра">
        {sheet === "more" && (
          <ListSectionLike>
            <ListItemRow
              icon={<I.Repeat width={16} height={16} />}
              iconColor="var(--warning)"
              title="Перенести игру"
              subtitle={g ? `${fmtDay(g.startsAt)} · ${fmtTime(g.startsAt)}` : undefined}
              onClick={openReschedule}
            />
            <ListItemRow
              icon={<I.Lock width={16} height={16} />}
              iconColor="var(--accent)"
              title="Видимость"
              subtitle={g?.restricted ? `группы: ${g.audienceGroups.map((x) => x.name).join(", ")}` : "видна всем игрокам"}
              onClick={() => {
                setVisDraft(g?.visibleTo ?? []);
                setSheet("visibility");
              }}
            />
            <ListItemRow icon={<I.Share width={16} height={16} />} iconColor="var(--gray-500)" title="Скопировать ссылку" onClick={() => { share(); setSheet(null); }} />
            <ListItemRow icon={<I.X width={16} height={16} />} iconColor="var(--danger)" title="Отменить игру" destructive onClick={() => setSheet("cancel")} />
          </ListSectionLike>
        )}
      </Sheet>

      {/* reschedule sheet */}
      <Sheet open={sheet === "visibility"} onClose={() => setSheet(null)} title="Кому видна игра">
        {sheet === "visibility" && (
          <>
            <p className="lu-sheet-lede">Игроки не узнают об ограничении — приватная игра просто не видна посторонним.</p>
            <div className="lu-chips" style={{ marginBottom: 16 }}>
              <button className="lu-chip" data-on={visDraft.length === 0} onClick={() => setVisDraft([])}>
                Всем игрокам
              </button>
              {groupList.map((gr) => (
                <button
                  key={gr.id}
                  className="lu-chip"
                  data-on={visDraft.includes(gr.id)}
                  onClick={() => setVisDraft((v) => (v.includes(gr.id) ? v.filter((x) => x !== gr.id) : [...v, gr.id]))}
                >
                  {gr.name} · {gr.members.length}
                </button>
              ))}
            </div>
            <Button
              block
              size="lg"
              onClick={() =>
                void run(
                  () =>
                    unwrap(
                      api.games[":id"].$patch({
                        param: { id: String(id) },
                        json: { visibleTo: visDraft.length ? visDraft : null },
                      }),
                    ),
                  { ok: "Видимость обновлена", invalidate },
                ).then(() => setSheet(null))
              }
            >
              Сохранить
            </Button>
          </>
        )}
      </Sheet>

      <Sheet open={sheet === "reschedule"} onClose={() => setSheet(null)} title="Перенести игру">
        {sheet === "reschedule" && (
          <div className="lu-stack" style={{ gap: 12 }}>
            <div className="lu-form-grid">
              <Input label="Дата" type="date" value={date} onChange={(e) => setDate(e.target.value)} leadingIcon={<I.Calendar width={16} height={16} />} />
              <Input label="Время" type="time" value={time} onChange={(e) => setTime(e.target.value)} leadingIcon={<I.Clock width={16} height={16} />} />
            </div>
            <Button block size="lg" loading={busy} onClick={() => void reschedule()}>
              Перенести игру
            </Button>
          </div>
        )}
      </Sheet>

      {/* cancel confirm sheet */}
      <Sheet open={sheet === "cancel"} onClose={() => setSheet(null)} title="Отменить игру">
        {sheet === "cancel" && (
          <div className="lu-stack" style={{ gap: 12 }}>
            <p className="lu-note">Игроки получат уведомление, взносы вернутся автоматически.</p>
            <Input label="Причина (опц.)" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="напр. отменили аренду поля" />
            <Button block size="lg" variant="destructive" loading={busy} onClick={() => void cancel()}>
              Отменить игру
            </Button>
          </div>
        )}
      </Sheet>

      <AddPlayerSheet open={addOpen} onClose={() => setAddOpen(false)} gameId={id} roster={g?.roster ?? []} invalidate={invalidate} />
    </div>
  );
}

/* Lightweight list wrappers (Sheet rows). */
function ListSectionLike({ children }: { children: ReactNode }) {
  return (
    <div className="lu-list">
      <div className="lu-list__sec">{children}</div>
    </div>
  );
}
function ListItemRow({
  icon,
  iconColor,
  title,
  subtitle,
  destructive,
  onClick,
}: {
  icon: ReactNode;
  iconColor: string;
  title: string;
  subtitle?: string;
  destructive?: boolean;
  onClick: () => void;
}) {
  return (
    <button className={`lu-cell lu-cell--tappable${destructive ? " lu-cell--destructive" : ""}`} onClick={onClick}>
      <span className="lu-cell__lead">
        <span className="lu-cell__icon" style={{ background: iconColor }}>
          {icon}
        </span>
      </span>
      <span className="lu-cell__body">
        <span className="lu-cell__title">{title}</span>
        {subtitle && <span className="lu-cell__sub">{subtitle}</span>}
      </span>
    </button>
  );
}

function AddPlayerSheet({
  open,
  onClose,
  gameId,
  roster,
  invalidate,
}: {
  open: boolean;
  onClose: () => void;
  gameId: string;
  roster: RosterRow[];
  invalidate: string[][];
}) {
  const run = useAction();
  const [q, setQ] = useState("");
  const playersQuery = useQuery({
    queryKey: ["players", q],
    queryFn: () => unwrap(api.players.$get({ query: { q } })),
    enabled: open,
  });
  const rosterIds = new Set(roster.map((p) => p.id));
  const list = (playersQuery.data ?? []).filter((p) => !rosterIds.has(p.id));

  const add = (userId: number) =>
    void run(() => unwrap(api.games[":id"]["add-player"].$post({ param: { id: gameId }, json: { userId } })), {
      ok: "Игрок добавлен в состав",
      invalidate,
    });

  return (
    <Sheet open={open} onClose={onClose} title="Добавить игрока">
      <div className="lu-stack" style={{ gap: 12 }}>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по имени или @нику" leadingIcon={<I.User width={16} height={16} />} />
        <Card>
          <div className="lu-pool">
            {list.map((p) => (
              <button key={p.id} className="lu-pool-card" onClick={() => add(p.id)}>
                <Avatar name={p.name} src={p.photoUrl || undefined} size={34} />
                <span className="lu-grow" style={{ fontSize: 15, color: "var(--text)" }}>
                  {p.name}
                </span>
                {p.primaryPos && <PositionBadge code={p.primaryPos} />}
                <span className="lu-pool-card__rt">
                  <I.Plus width={16} height={16} />
                </span>
              </button>
            ))}
            {!list.length && <div className="lu-team__empty">Никого не нашлось.</div>}
          </div>
        </Card>
      </div>
    </Sheet>
  );
}
