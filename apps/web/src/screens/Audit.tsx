/* 6.5 Журнал действий. */
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import type { AuditAction } from "@lineup/shared";
import { api, unwrap } from "@/api/client";
import { Card, EmptyState, NavBar } from "@/ds";
import { I } from "@/icons";
import { fmtWhen } from "@/lib/format";

const COLOR: Record<AuditAction, string> = {
  ban: "var(--danger)",
  warn: "var(--danger)",
  penalty: "var(--info)",
  refund: "var(--info)",
  edit: "var(--gray-500)",
  cancel: "var(--gray-500)",
  season: "var(--accent)",
  settings: "var(--accent)",
  role: "var(--accent)",
  venue: "var(--accent)",
};

const icon = (action: AuditAction): ReactNode => {
  const props = { width: 15, height: 15 };
  switch (action) {
    case "ban":
      return <I.Ban {...props} />;
    case "penalty":
    case "warn":
      return <I.AlertTriangle {...props} />;
    case "refund":
      return <I.Repeat {...props} />;
    case "edit":
    case "cancel":
      return <I.Edit {...props} />;
    case "season":
      return <I.Trophy {...props} />;
    case "settings":
      return <I.Settings {...props} />;
    case "role":
      return <I.Users {...props} />;
    case "venue":
      return <I.Field {...props} />;
  }
};

const verb = (action: AuditAction, target: string): string => {
  switch (action) {
    case "ban":
      return `забанил ${target}`;
    case "warn":
      return `предупредил ${target}`;
    case "penalty":
      return `снизил надёжность ${target}`;
    case "refund":
      return `вернул ${target}`;
    case "edit":
      return "изменил игру";
    case "cancel":
      return "отменил игру";
    case "season":
      return `открыл сезон ${target}`;
    case "settings":
      return "изменил настройки";
    case "role":
      return `изменил роль ${target}`;
    case "venue":
      return `добавил площадку ${target}`;
  }
};

export function Audit() {
  const navigate = useNavigate();

  const auditQuery = useQuery({
    queryKey: ["audit"],
    queryFn: () => unwrap(api.audit.$get()),
  });

  const list = (auditQuery.data ?? []) as Array<{
    id: number;
    action: AuditAction;
    target: string;
    reason: string;
    createdAt: number;
    who: string;
  }>;

  return (
    <div className="lu-scr">
      <NavBar title="Журнал действий" onBack={() => navigate(-1)} backLabel="Назад" />
      <div className="lu-scr__body">
        <p className="lu-lede" style={{ padding: "0 2px" }}>
          Кто и что менял. Прозрачно для всех модераторов сообщества.
        </p>

        {auditQuery.isPending && <div className="lu-skel" style={{ height: 200, borderRadius: "var(--radius-lg)" }} />}

        {list.length > 0 ? (
          <Card pad style={{ padding: "4px 16px" }}>
            {list.map((a) => (
              <div className="lu-log-row" key={a.id}>
                <span className="lu-log-row__dot" style={{ background: COLOR[a.action] }}>{icon(a.action)}</span>
                <div className="lu-grow">
                  <div style={{ fontSize: 14, color: "var(--text)" }}>
                    <b>{a.who}</b> {verb(a.action, a.target)}
                  </div>
                  <div className="lu-log-row__when">{a.reason ? `${a.reason} · ` : ""}{fmtWhen(a.createdAt)}</div>
                </div>
              </div>
            ))}
          </Card>
        ) : (
          !auditQuery.isPending && (
            <EmptyState icon={<I.Note />} title="Журнал пуст" description="Действия модераторов появятся здесь." />
          )
        )}
      </div>
    </div>
  );
}
