/* 3.8 Настройки. */
import { useState } from "react";
import { useNavigate } from "react-router";
import { useApp } from "@/app/AppContext";
import { ListItem, ListSection, NavBar, SegmentedControl, Switch } from "@/ds";
import { I } from "@/icons";
import { setTheme } from "@/lib/telegram";

export function SettingsScreen() {
  const navigate = useNavigate();
  const { toast, logout } = useApp();

  const [dark, setDark] = useState(() => document.documentElement.getAttribute("data-theme") === "dark");

  return (
    <div className="lu-scr">
      <NavBar title="Настройки" onBack={() => navigate(-1)} backLabel="Профиль" />
      <div className="lu-scr__body">
        <ListSection label="Уведомления">
          <ListItem
            icon={<I.Bell width={16} height={16} />}
            iconColor="var(--accent)"
            title="Уведомления приходят от бота в Telegram"
            subtitle="напоминания об играх и оплате"
          />
        </ListSection>

        <ListSection label="Приватность" footer="Профиль и статистика видны участникам сообщества.">
          <ListItem
            icon={<I.Globe width={16} height={16} />}
            iconColor="var(--gray-500)"
            title="Публичный профиль"
            subtitle="виден другим игрокам"
            onClick={() => toast("Скрыть профиль пока нельзя", "error")}
            trailing={<Switch checked disabled />}
          />
          <ListItem
            icon={<I.BarChart width={16} height={16} />}
            iconColor="var(--gray-500)"
            title="Показывать статистику"
            onClick={() => toast("Скрыть статистику пока нельзя", "error")}
            trailing={<Switch checked disabled />}
          />
        </ListSection>

        <ListSection label="Язык и оформление">
          <ListItem
            icon={<I.Globe width={16} height={16} />}
            iconColor="var(--info)"
            title="Язык"
            trailing={
              <div style={{ width: 130 }}>
                <SegmentedControl value="RU" onChange={() => toast("Пока только русский")} options={["RU", "EN"]} />
              </div>
            }
          />
          <ListItem
            icon={<I.Star width={16} height={16} />}
            iconColor="var(--gray-700)"
            title="Ночная тема"
            trailing={
              <Switch
                checked={dark}
                onChange={(v) => {
                  setDark(v);
                  setTheme(v ? "dark" : "light");
                }}
              />
            }
          />
        </ListSection>

        <ListSection label="Аккаунт">
          <ListItem
            icon={<I.User width={16} height={16} />}
            iconColor="var(--accent)"
            title="Редактировать профиль"
            chevron
            onClick={() => navigate("/onboarding")}
          />
          <ListItem icon={<I.LogOut width={16} height={16} />} iconColor="var(--danger)" title="Выйти" destructive onClick={logout} />
        </ListSection>
        <p className="lu-note lu-center">Роль организатора назначает владелец сообщества · Lineup 1.0</p>
      </div>
    </div>
  );
}
