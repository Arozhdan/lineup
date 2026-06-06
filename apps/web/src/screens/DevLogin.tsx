/* Browser-only dev login (DEV_AUTH=1 on the server). Inside Telegram the app
   authenticates automatically via initData and this screen never shows. */
import { useQuery } from "@tanstack/react-query";
import { api, unwrap } from "@/api/client";
import { useApp } from "@/app/AppContext";
import { Avatar, Badge, Card } from "@/ds";
import { ROLE_LABEL, type UserRole } from "@lineup/shared";

export function DevLogin() {
  const { login, toast } = useApp();
  const usersQuery = useQuery({
    queryKey: ["dev-users"],
    queryFn: () => unwrap(api.auth["dev-users"].$get()),
  });

  const enter = async (tgId: number) => {
    try {
      const res = await unwrap(api.auth.dev.$post({ json: { tgId } }));
      login(res.token);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Ошибка входа", "error");
    }
  };

  return (
    <div className="lu-scr">
      <div className="lu-scr__body" style={{ justifyContent: "center" }}>
        <div className="lu-center" style={{ marginBottom: 8 }}>
          <div className="lu-wordmark" style={{ fontSize: 30 }}>Lineup · dev</div>
          <p className="lu-lede">Открой в Telegram для реального входа, либо выбери тестового пользователя.</p>
        </div>
        {usersQuery.isError && (
          <p className="lu-note lu-center">
            Дев-вход недоступен: задай DEV_AUTH=1 на сервере и запусти сид (pnpm db:seed).
          </p>
        )}
        <Card>
          {(usersQuery.data ?? []).map((u) => (
            <button key={u.tgId} className="lu-pool-card" onClick={() => void enter(u.tgId)}>
              <Avatar name={u.name} size={36} />
              <span className="lu-grow" style={{ fontSize: 15, color: "var(--text)" }}>{u.name}</span>
              <Badge variant={u.role === "owner" ? "accent" : u.role === "organizer" ? "info" : "neutral"}>
                {ROLE_LABEL[u.role as UserRole]}
              </Badge>
            </button>
          ))}
        </Card>
      </div>
    </div>
  );
}
