/* Auth + toast context shared by every screen. */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, getToken, setToken, unwrap } from "@/api/client";
import { setCurrency } from "@/lib/format";
import { I } from "@/icons";
import { haptic } from "@/lib/telegram";

export type Me = Awaited<ReturnType<typeof fetchMe>>;
const fetchMe = () => unwrap(api.me.$get());

type Toast = { id: number; text: string; kind: "ok" | "error" };

type AppCtx = {
  me: Me | null;
  meLoading: boolean;
  authed: boolean;
  isOrganizer: boolean;
  isOwner: boolean;
  login: (token: string) => void;
  logout: () => void;
  refreshMe: () => void;
  toast: (text: string, kind?: "ok" | "error") => void;
};

const Ctx = createContext<AppCtx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [hasToken, setHasToken] = useState(() => !!getToken());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: fetchMe,
    enabled: hasToken,
    retry: (count, err) => !(err instanceof Error && "status" in err && (err as { status: number }).status === 401) && count < 2,
  });

  // 401 wipes the stored token (see unwrap) — reflect that in state.
  useEffect(() => {
    if (meQuery.isError && !getToken()) setHasToken(false);
  }, [meQuery.isError]);

  const me = meQuery.data ?? null;

  const login = useCallback(
    (token: string) => {
      setToken(token);
      setHasToken(true);
      void qc.invalidateQueries();
    },
    [qc],
  );

  const logout = useCallback(() => {
    setToken(null);
    setHasToken(false);
    qc.clear();
  }, [qc]);

  const toast = useCallback((text: string, kind: "ok" | "error" = "ok") => {
    haptic(kind === "error" ? "error" : "success");
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2400);
  }, []);

  // Keep the money formatter in sync with platform currency.
  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: () => unwrap(api.settings.$get()),
    enabled: !!me,
    staleTime: 60_000,
  });
  useEffect(() => {
    if (settingsQuery.data?.currency) setCurrency(settingsQuery.data.currency);
  }, [settingsQuery.data?.currency]);

  const value = useMemo<AppCtx>(
    () => ({
      me,
      meLoading: hasToken && meQuery.isPending,
      authed: hasToken && !!me,
      isOrganizer: me?.role === "organizer" || me?.role === "owner",
      isOwner: me?.role === "owner",
      login,
      logout,
      refreshMe: () => void qc.invalidateQueries({ queryKey: ["me"] }),
      toast,
    }),
    [me, hasToken, meQuery.isPending, login, logout, qc, toast],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {toasts.length > 0 && (
        <div className="lu-toast-float" style={{ position: "fixed", maxWidth: 488, margin: "0 auto" }}>
          {toasts.map((t) => (
            <div key={t.id} className={`lu-toast-inline${t.kind === "error" ? " lu-toast-inline--error" : ""}`} style={{ boxShadow: "var(--shadow-pop)", marginTop: 6 }}>
              {t.kind === "error" ? <I.AlertTriangle width={18} height={18} /> : <I.CheckCircle width={18} height={18} />}
              {t.text}
            </div>
          ))}
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useApp(): AppCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp outside AppProvider");
  return ctx;
}

/** Run a mutation with uniform error toasts. */
export function useAction() {
  const { toast } = useApp();
  const qc = useQueryClient();
  return useCallback(
    async (fn: () => Promise<unknown>, opts?: { ok?: string; invalidate?: string[][] }) => {
      try {
        await fn();
        if (opts?.ok) toast(opts.ok);
        for (const key of opts?.invalidate ?? []) void qc.invalidateQueries({ queryKey: key });
        return true;
      } catch (e) {
        toast(e instanceof Error ? e.message : "Что-то пошло не так", "error");
        return false;
      }
    },
    [toast, qc],
  );
}
