/* 3.8 Настройки. */
import { useState } from "react";
import { useNavigate } from "react-router";
import { useApp } from "@/app/AppContext";
import { ListItem, ListSection, NavBar, SegmentedControl, Switch } from "@/ds";
import { I } from "@/icons";
import { setTheme } from "@/lib/telegram";

const localBool = (key: string, fallback = true): boolean => {
  const v = localStorage.getItem(key);
  return v == null ? fallback : v === "1";
};

export function SettingsScreen() {
  const navigate = useNavigate();
  const { toast, logout } = useApp();

  const [pubProfile, setPubProfile] = useState(() => localBool("lu_pub_profile"));
  const [pubStats, setPubStats] = useState(() => localBool("lu_pub_stats"));
  const [dark, setDark] = useState(() => document.documentElement.getAttribute("data-theme") === "dark");

  const persist = (key: string, set: (v: boolean) => void) => (v: boolean) => {
    localStorage.setItem(key, v ? "1" : "0");
    set(v);
  };

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

        <ListSection label="Приватность">
          <ListItem
            icon={<I.Globe width={16} height={16} />}
            iconColor="var(--gray-500)"
            title="Публичный профиль"
            subtitle="виден другим игрокам"
            trailing={<Switch checked={pubProfile} onChange={persist("lu_pub_profile", setPubProfile)} />}
          />
          <ListItem
            icon={<I.BarChart width={16} height={16} />}
            iconColor="var(--gray-500)"
            title="Показывать статистику"
            trailing={<Switch checked={pubStats} onChange={persist("lu_pub_stats", setPubStats)} />}
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
