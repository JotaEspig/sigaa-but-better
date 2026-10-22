import type { ApiErrorBody, ApiErrorCode, Envelope } from "./types";

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;

  constructor(code: ApiErrorCode, message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }

  get isAuth(): boolean {
    return this.code === "UNAUTHENTICATED" || this.code === "SESSION_EXPIRED";
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

const MOCK = import.meta.env.DEV && import.meta.env.VITE_MOCK === "1";

/** Listeners notified on 401s so the app can clear caches and go to /login. */
type AuthListener = (code: ApiErrorCode) => void;
const authListeners = new Set<AuthListener>();
export function onAuthError(fn: AuthListener): () => void {
  authListeners.add(fn);
  return () => authListeners.delete(fn);
}

async function toError(res: Response): Promise<ApiError> {
  let body: Partial<ApiErrorBody> | null = null;
  try {
    body = (await res.json()) as ApiErrorBody;
  } catch {
    // Non-JSON error (proxy page, network middlebox…).
  }
  if (body?.error) return new ApiError(body.error.code, body.error.message, res.status);
  if (res.status === 401) return new ApiError("UNAUTHENTICATED", "Sessão inválida.", 401);
  if (res.status === 429) return new ApiError("RATE_LIMITED", "Muitas requisições.", 429);
  return new ApiError("SIGAA_UNAVAILABLE", `Erro ${res.status} ao falar com o servidor.`, res.status);
}

interface RequestOptions {
  method?: "GET" | "POST";
  body?: unknown;
  refresh?: boolean;
  signal?: AbortSignal;
  /** Login itself returns 401 for wrong passwords; don't treat that as "session expired". */
  skipAuthRedirect?: boolean;
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<Envelope<T>> {
  const url = opts.refresh ? `${path}${path.includes("?") ? "&" : "?"}refresh=1` : path;

  if (MOCK) {
    const { mockRequest } = await import("../mocks/handlers");
    try {
      return await mockRequest<T>(opts.method ?? "GET", path, opts.body);
    } catch (e) {
      if (isApiError(e) && e.isAuth && !opts.skipAuthRedirect) authListeners.forEach((fn) => fn(e.code));
      throw e;
    }
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? "GET",
      credentials: "same-origin",
      headers: opts.body !== undefined ? { "Content-Type": "application/json", Accept: "application/json" } : { Accept: "application/json" },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiError("SIGAA_UNAVAILABLE", "Não foi possível conectar ao servidor.", 0);
  }

  if (res.status === 204) return { data: undefined as T, fetchedAt: new Date().toISOString() };
  if (!res.ok) {
    const err = await toError(res);
    if (err.isAuth && !opts.skipAuthRedirect) authListeners.forEach((fn) => fn(err.code));
    throw err;
  }
  return (await res.json()) as Envelope<T>;
}

/** Plain URL for downloads (served by the BFF as attachments). */
export function fileUrl(classId: string, fileId: string): string {
  return `/api/classes/${encodeURIComponent(classId)}/files/${encodeURIComponent(fileId)}`;
}

export const TRANSCRIPT_URL = "/api/documents/transcript";
export const OFFICIAL_SIGAA_URL = "https://sig.ifc.edu.br/sigaa/verTelaLogin.do";
export const IS_MOCK = MOCK;
