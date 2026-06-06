/* 1.2 Создание профиля — визард 4 шага (имя → основная позиция → запасные → детали). */
import { useState } from "react";
import { useNavigate } from "react-router";
import { api, unwrap } from "@/api/client";
import { useApp, useAction } from "@/app/AppContext";
import { Button, Input, NavBar, PositionBadge, SegmentedControl } from "@/ds";
import { PositionPicker, PosLegend } from "@/ds/PositionPicker";
import { FOOT_OPTIONS, LEVEL_LABEL, type ProfileInput } from "@lineup/shared";

const STEPS = 4;
const TITLES = ["Как тебя зовут?", "Твоя основная позиция", "Запасные позиции", "Ещё пара деталей"];
const LEDES = [
  "Подтянули из Telegram — поправь, если нужно.",
  "Это полный состав 11×11. Нажми точку, где любишь играть — мы подберём тебе место в любом формате.",
  "Где ещё готов сыграть? Выбери до трёх — поможет автобалансу, когда основная занята.",
  "По желанию — поможет честно делить команды. Можно пропустить.",
];

type FootOption = (typeof FOOT_OPTIONS)[number];

export function Onboarding() {
  const navigate = useNavigate();
  const { me, refreshMe, toast } = useApp();
  const run = useAction();

  const [step, setStep] = useState(1);
  const [first, setFirst] = useState(me?.first ?? "");
  const [last, setLast] = useState(me?.last ?? "");
  const [primary, setPrimary] = useState<string | null>(me?.primaryPos ?? null);
  const [fallbacks, setFallbacks] = useState<string[]>(me?.fallbackPos ?? []);
  const [foot, setFoot] = useState<FootOption | null>((me?.foot as FootOption | null | undefined) ?? null);
  const [level, setLevel] = useState<number>(me?.level ?? 3);
  const [area, setArea] = useState(me?.area ?? "");
  const [kitSize, setKitSize] = useState(me?.kitSize ?? "");
  const [saving, setSaving] = useState(false);

  const canNext = step === 1 ? !!first.trim() : step === 2 ? !!primary : true;

  const finish = async () => {
    setSaving(true);
    const payload: ProfileInput = {
      first: first.trim(),
      last: last.trim(),
      primaryPos: primary,
      fallbackPos: fallbacks,
      foot,
      level,
      area: area.trim(),
      kitSize: kitSize.trim(),
    };
    const ok = await run(() => unwrap(api.me.$patch({ json: payload })), {
      invalidate: [["me"]],
    });
    setSaving(false);
    if (ok) {
      refreshMe();
      toast("Профиль создан — добро пожаловать!");
      navigate("/", { replace: true });
    }
  };

  const next = () => {
    if (step < STEPS) setStep(step + 1);
    else void finish();
  };

  return (
    <div className="lu-scr">
      <NavBar
        plain
        title="Создание профиля"
        subtitle={`Шаг ${step} из ${STEPS}`}
        onBack={() => (step > 1 ? setStep(step - 1) : navigate("/welcome"))}
        backLabel="Назад"
        trailing={
          step === STEPS ? (
            <button className="lu-navbar__btn" onClick={() => void finish()}>
              Пропустить
            </button>
          ) : null
        }
      />
      <div className="lu-scr__body" style={{ gap: 16 }}>
        <div className="lu-steps">
          {Array.from({ length: STEPS }, (_, i) => (
            <span key={i} className="lu-steps__dot" data-on={i + 1 <= step} />
          ))}
        </div>
        <div style={{ padding: "0 2px" }}>
          <h2 className="lu-h1">{TITLES[step - 1]}</h2>
          <p className="lu-lede">{LEDES[step - 1]}</p>
        </div>

        {step === 1 && (
          <div className="lu-stack">
            <div className="lu-form-grid">
              <Input label="Имя" value={first} onChange={(e) => setFirst(e.target.value)} />
              <Input label="Фамилия" value={last} onChange={(e) => setLast(e.target.value)} />
            </div>
            <Input label="Ник в Telegram" value={me?.handle ?? ""} disabled help="Подтянулся автоматически" />
          </div>
        )}

        {step === 2 && (
          <>
            <PositionPicker value={primary} onChange={setPrimary} format={11} />
            <PosLegend />
            <div className="lu-pick-summary">
              <span className="lu-section-label">Основная</span>
              {primary ? <PositionBadge code={primary} size="lg" /> : <span className="lu-muted">нажми точку на схеме</span>}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <PositionPicker
              multiple
              max={3}
              value={fallbacks}
              onChange={setFallbacks}
              format={11}
              exclude={primary ? [primary] : []}
            />
            <div className="lu-pick-summary">
              <span className="lu-section-label">Запасные</span>
              {fallbacks.length ? (
                fallbacks.map((c) => <PositionBadge key={c} code={c} />)
              ) : (
                <span className="lu-muted">можно пропустить</span>
              )}
            </div>
          </>
        )}

        {step === 4 && (
          <div className="lu-stack" style={{ gap: 18 }}>
            <div>
              <div className="lu-section-label" style={{ marginBottom: 8, paddingLeft: 2 }}>
                Рабочая нога
              </div>
              <SegmentedControl<FootOption>
                value={foot ?? "Правая"}
                onChange={setFoot}
                options={[...FOOT_OPTIONS]}
              />
            </div>
            <div>
              <div className="lu-section-label" style={{ marginBottom: 8, paddingLeft: 2 }}>
                Уровень игры · самооценка 1–5
              </div>
              <SegmentedControl
                value={String(level)}
                onChange={(v) => setLevel(+v)}
                options={["1", "2", "3", "4", "5"]}
              />
              <p className="lu-note" style={{ paddingTop: 6 }}>
                {LEVEL_LABEL[level] ?? "Средний"} · виден только организатору для баланса команд.
              </p>
            </div>
            <div className="lu-form-grid">
              <Input label="Район" value={area} onChange={(e) => setArea(e.target.value)} />
              <Input label="Размер формы" value={kitSize} onChange={(e) => setKitSize(e.target.value)} />
            </div>
          </div>
        )}
      </div>
      <div className="lu-mainbtn">
        {step === 3 && !fallbacks.length ? (
          <Button block size="lg" variant="secondary" onClick={next}>
            Пропустить запасные
          </Button>
        ) : (
          <Button block size="lg" disabled={!canNext} loading={step === STEPS && saving} onClick={next}>
            {step < STEPS ? "Дальше" : "Готово · на поле"}
          </Button>
        )}
      </div>
    </div>
  );
}
