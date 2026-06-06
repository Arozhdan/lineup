/* 7.1 Роли и доступы (владелец). */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { ROLE_LABEL, USER_ROLES, type UserRole } from "@lineup/shared";
import { api, unwrap } from "@/api/client";
import { useApp, useAction } from "@/app/AppContext";
import { Avatar, Badge, Card, ListItem, ListSection, NavBar, Sheet } from "@/ds";
import { I } from "@/icons";

type RoleUser = { id: number; name: string; photoUrl: string; role: UserRole; tgId: number };

const roleVariant: Record<UserRole, "accent" | "info" | "neutral"> = {
  owner: "accent",
  organizer: "info",
  player: "neutral",
};

export function Roles() {
  const navigate = useNavigate();
  const run = useAction();
  const { me, toast } = useApp();
  const [sheet, setSheet] = useState<RoleUser | null>(null);

  const settingsQuery = useQuery({ queryKey: ["settings"], queryFn: () => unwrap(api.settings.$get()) });
  const rolesQuery = useQuery({ queryKey: ["roles"], queryFn: () => unwrap(api.roles.$get()) });

  const team = (rolesQuery.data ?? []) as RoleUser[];
  const name = settingsQuery.data?.name ?? "сообщества";

  const setRole = async (userId: number, role: UserRole) => {
    const ok = await run(() => unwrap(api.roles.$post({ json: { userId, role } })), {
      ok: "Роль обновлена",
      invalidate: [["roles"]],
    });
    if (ok) setSheet(null);
  };

  return (
    <div className="lu-scr">
      <NavBar
        title="Роли и доступы"
        onBack={() => navigate(-1)}
        backLabel="Назад"
        trailing={
          <button
            className="lu-iconbtn"
            style={{ color: "var(--accent)" }}
            onClick={() => toast("Попроси игрока открыть бота — он появится в списке")}
          >
            <I.UserPlus width={21} height={21} />
          </button>
        }
      />
      <div className="lu-scr__body">
        <p className="lu-lede" style={{ padding: "0 2px" }}>
          Команда сообщества «{name}». Распредели, кто за что отвечает.
        </p>

        {rolesQuery.isPending && <div className="lu-skel" style={{ height: 200, borderRadius: "var(--radius-lg)" }} />}

        {team.length > 0 && (
          <Card>
            <div className="lu-pool">
              {team.map((p) => {
                const self = p.id === me?.id;
                return (
                  <button
                    key={p.id}
                    className="lu-pool-card"
                    style={self ? { cursor: "default" } : undefined}
                    onClick={() => !self && setSheet(p)}
                  >
                    <Avatar name={p.name} src={p.photoUrl || undefined} size={38} />
                    <span className="lu-grow" style={{ fontSize: 15, color: "var(--text)" }}>{self ? `${p.name} (вы)` : p.name}</span>
                    <Badge variant={roleVariant[p.role]}>{ROLE_LABEL[p.role]}</Badge>
                    {!self && <I.ChevronRight width={16} height={16} style={{ color: "var(--text-hint)" }} />}
                  </button>
                );
              })}
            </div>
          </Card>
        )}

        <div className="lu-section-label" style={{ paddingLeft: 2 }}>Что могут роли</div>
        <ListSection>
          <ListItem icon={<I.Shield width={16} height={16} />} iconColor="var(--info)" title="Организатор" subtitle="создаёт игры, собирает составы" />
          <ListItem icon={<I.Crown width={16} height={16} />} iconColor="var(--accent)" title="Владелец" subtitle="настройки платформы, роли, реквизиты" />
        </ListSection>
      </div>

      <Sheet open={!!sheet} onClose={() => setSheet(null)} title={sheet?.name ?? ""}>
        {sheet && (
          <ListSection>
            {USER_ROLES.map((r) => (
              <ListItem
                key={r}
                title={ROLE_LABEL[r]}
                onClick={() => void setRole(sheet.id, r)}
                trailing={sheet.role === r ? <I.Check width={18} height={18} style={{ color: "var(--accent)" }} /> : undefined}
              />
            ))}
          </ListSection>
        )}
      </Sheet>
    </div>
  );
}
