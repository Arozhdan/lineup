/* End-to-end typed API client (Hono RPC) + auth token storage. */
import { hc } from "hono/client";
import type { AppType } from "@server/app";

const TOKEN_KEY = "lu_token";

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string | null): void => {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
};

export const api = hc<AppType>("/api", {
  headers: (): Record<string, string> => {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  },
});

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type ResponseLike = { ok: boolean; status: number; json(): Promise<unknown> };

/** Validation-failure body that zValidator contributes to every route's type union. */
type ValidationFailure = { success: false };

/** Resolve the JSON payload type of a (possibly promised) RPC response. */
export type UnwrapJson<T> = T extends PromiseLike<infer U>
  ? UnwrapJson<U>
  : T extends ResponseLike
    ? Exclude<Awaited<ReturnType<T["json"]>>, ValidationFailure>
    : never;

/** Unwrap a typed RPC response; throws ApiError with the server's RU message. */
export async function unwrap<T extends ResponseLike | PromiseLike<ResponseLike>>(resPromise: T): Promise<UnwrapJson<T>> {
  const res = (await resPromise) as ResponseLike;
  if (!res.ok) {
    let message = `Ошибка ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      /* non-JSON error body */
    }
    if (res.status === 401) setToken(null);
    throw new ApiError(res.status, message);
  }
  return (await res.json()) as UnwrapJson<T>;
}

/** POST multipart (photo / QR upload) — outside RPC typing. */
export async function uploadFile(path: string, file: File): Promise<{ url?: string; qrImage?: string }> {
  const form = new FormData();
  form.append("file", file);
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new ApiError(res.status, body.message ?? `Ошибка ${res.status}`);
  }
  return res.json() as Promise<{ url?: string; qrImage?: string }>;
}
