/* 1.1 Приветствие / вход. Пользователь уже аутентифицирован — кнопка ведёт в онбординг. */
import { useNavigate } from "react-router";
import { Button } from "@/ds";

const TgGlyph = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M21.9 4.3l-3.3 15.6c-.25 1.1-.9 1.37-1.83.85l-5.05-3.72-2.44 2.35c-.27.27-.5.5-1 .5l.36-5.1L17.9 6.3c.4-.36-.09-.56-.62-.2L6.1 13.2l-4.97-1.55c-1.08-.34-1.1-1.08.23-1.6L20.5 2.78c.9-.33 1.69.2 1.4 1.52z" />
  </svg>
);

const STATS: [string, string][] = [
  ["320+", "игроков"],
  ["48", "игр/мес"],
  ["4.9", "рейтинг"],
];

export function Welcome() {
  const navigate = useNavigate();
  return (
    <div className="lu-scr">
      <div className="lu-welcome">
        <div className="lu-logo-lockup">
          <div className="lu-logo-mark">
            <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
              <circle cx="26" cy="26" r="15" stroke="#fff" strokeWidth="2.4" opacity=".95" />
              <path d="M26 11v30M11 26h30" stroke="#fff" strokeWidth="2.2" opacity=".5" />
              <path d="M26 19.5l5.2 3.8-2 6.2h-6.4l-2-6.2z" fill="#fff" />
            </svg>
          </div>
          <div style={{ textAlign: "center" }}>
            <div className="lu-wordmark">Lineup</div>
            <div className="lu-welcome__tag">
              Собирай составы на футбол прямо в Telegram. Запишись, выбери позицию — и на поле.
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 18, marginTop: 18 }}>
          {STATS.map(([v, l]) => (
            <div key={l} style={{ textAlign: "center" }}>
              <div className="lu-display" style={{ fontSize: 24, color: "var(--text)" }}>
                {v}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-hint)" }}>{l}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="lu-mainbtn lu-mainbtn--ghost">
        <Button block size="lg" leadingIcon={<TgGlyph />} onClick={() => navigate("/onboarding")}>
          Войти через Telegram
        </Button>
        <p className="lu-note lu-center">Имя и фото подтянутся автоматически.</p>
      </div>
    </div>
  );
}
