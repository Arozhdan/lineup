/* Инструменты — hub for organizer/owner (tab root). */
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { api, unwrap } from "@/api/client";
import { useApp } from "@/app/AppContext";
import { ListItem, ListSection, NavBar } from "@/ds";
import { I } from "@/icons";

export function Tools() {
  const navigate = useNavigate();
  const { isOwner } = useApp();

  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: () => unwrap(api.settings.$get()),
  });
  const name = settingsQuery.data?.name ?? "Lineup";

  return (
    <div className="lu-scr">
      <NavBar plain title="Инструменты" subtitle={`${isOwner ? "Владелец" : "Организатор"} · ${name}`} />
      <div className="lu-scr__body lu-scr__body--tab">
        <p className="lu-note" style={{ padding: "0 2px" }}>
          Финансы и составы конкретной игры — внутри карточки игры → «Управлять игрой».
        </p>
        <ListSection label="Сообщество и игроки">
          <ListItem
            icon={<I.Trophy width={16} height={16} />}
            iconColor="#E8B923"
            title="Сезоны"
            subtitle="лидерборды и архив статистики"
            chevron
            onClick={() => navigate("/seasons")}
          />
          <ListItem
            icon={<I.BarChart width={16} height={16} />}
            iconColor="var(--accent)"
            title="Отчёты и сводки"
            subtitle="финансы и явка за сезон"
            chevron
            onClick={() => navigate("/reports")}
          />
          <ListItem
            icon={<I.Megaphone width={16} height={16} />}
            iconColor="#8B5CF6"
            title="Рассылка и анонсы"
            chevron
            onClick={() => navigate("/broadcast")}
          />
          <ListItem
            icon={<I.Ban width={16} height={16} />}
            iconColor="var(--danger)"
            title="Модерация"
            subtitle="неявки, баны, жалобы"
            chevron
            onClick={() => navigate("/moderation")}
          />
          <ListItem
            icon={<I.Note width={16} height={16} />}
            iconColor="var(--gray-600)"
            title="Журнал действий"
            chevron
            onClick={() => navigate("/audit")}
          />
          <ListItem
            icon={<I.Repeat width={16} height={16} />}
            iconColor="var(--warning)"
            title="Возвраты"
            subtitle="возвраты по отменам"
            chevron
            onClick={() => navigate("/refunds")}
          />
        </ListSection>
        <ListSection label="Справочники">
          <ListItem
            icon={<I.Field width={16} height={16} />}
            iconColor="var(--success)"
            title="Площадки и инвентарь"
            chevron
            onClick={() => navigate("/venues")}
          />
          <ListItem
            icon={<I.Repeat width={16} height={16} />}
            iconColor="var(--info)"
            title="Регулярные игры"
            subtitle="расписание серий"
            chevron
            onClick={() => navigate("/schedule")}
          />
        </ListSection>
        {isOwner ? (
          <ListSection label="Платформа · только владелец">
            <ListItem
              icon={<I.Users width={16} height={16} />}
              iconColor="var(--accent)"
              title="Роли и доступы"
              chevron
              onClick={() => navigate("/roles")}
            />
            <ListItem
              icon={<I.Settings width={16} height={16} />}
              iconColor="var(--gray-600)"
              title="Настройки платформы"
              subtitle="валюта, политики, очки"
              chevron
              onClick={() => navigate("/community")}
            />
            <ListItem
              icon={<I.QrCode width={16} height={16} />}
              iconColor="var(--success)"
              title="Реквизиты для QR"
              chevron
              onClick={() => navigate("/qrconfig")}
            />
          </ListSection>
        ) : (
          <p className="lu-note lu-center">
            Роли, реквизиты и настройки платформы доступны владельцу сообщества.
          </p>
        )}
      </div>
    </div>
  );
}
