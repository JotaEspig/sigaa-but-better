import { Eye, EyeOff, ExternalLink, Info, Lock, ShieldCheck, User } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router";
import { OFFICIAL_SIGAA_URL } from "../api/client";
import { useLogin, useSession } from "../api/hooks";
import type { ApiErrorCode } from "../api/types";
import { DitherField } from "../components/DitherField";
import { Logo } from "../components/Logo";
import { ThemeSwitcher } from "../components/ThemeSwitcher";
import { Button } from "../components/ui";

const loginErrors: Partial<Record<ApiErrorCode, string>> = {
  INVALID_CREDENTIALS: "Usuário ou senha inválidos. Confira e tente novamente.",
  RATE_LIMITED: "Muitas tentativas de login. Aguarde um minuto antes de tentar de novo.",
  SIGAA_UNAVAILABLE: "O SIGAA não respondeu. Ele pode estar fora do ar. Tente daqui a pouco.",
  UNSUPPORTED_ACCOUNT:
    "Login feito, mas sua conta não abriu direto no Portal do Discente (por exemplo, por ter vários vínculos ou avisos pendentes). Resolva isso no SIGAA oficial e tente de novo.",
  PARSE_ERROR: "O SIGAA respondeu de um jeito inesperado. Tente de novo em instantes.",
};

/** Only allow same-app relative paths as post-login redirect targets. */
function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export function LoginPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const session = useSession();
  const login = useLogin();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const errId = useId();
  const expired = params.get("expired") === "1";
  const next = safeNext(params.get("next"));

  if (session.isSuccess && !login.isPending && !expired) return <Navigate to={next} replace />;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    login.mutate({ username: username.trim(), password }, { onSuccess: () => navigate(next, { replace: true }) });
  };

  const errorMsg = login.error ? (loginErrors[login.error.code] ?? login.error.message) : null;

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* Form */}
      <div className="flex flex-col px-4 py-6 sm:px-8">
        <div className="flex items-center justify-between">
          <Logo />
          <div className="w-40 sm:w-auto">
            <ThemeSwitcher compact />
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h2 className="text-2xl font-bold tracking-tight">Entrar</h2>
          <p className="mt-1 text-sm text-muted">Use o mesmo usuário e senha do SIGAA.</p>

          {expired && (
            <div role="status" className="mt-5 flex gap-2.5 rounded-xl border border-warning/30 bg-warning-soft px-3.5 py-3 text-sm text-warning">
              <Info className="mt-0.5 size-4 shrink-0" />
              <span>Sua sessão no SIGAA expirou. Entre novamente para continuar.</span>
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
            <div>
              <label htmlFor="username" className="mb-1.5 block text-sm font-medium">
                Usuário
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
                <input
                  id="username"
                  name="username"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  aria-invalid={!!errorMsg}
                  aria-describedby={errorMsg ? errId : undefined}
                  className="h-11 w-full rounded-xl border border-line bg-surface pr-3 pl-9 text-[0.95rem] shadow-soft transition-colors outline-none placeholder:text-subtle focus:border-brand focus:ring-4 focus:ring-brand/15"
                  placeholder="seu.usuario"
                />
              </div>
            </div>
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
                Senha
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
                <input
                  id="password"
                  name="password"
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={!!errorMsg}
                  aria-describedby={errorMsg ? errId : undefined}
                  className="h-11 w-full rounded-xl border border-line bg-surface pr-11 pl-9 text-[0.95rem] shadow-soft transition-colors outline-none focus:border-brand focus:ring-4 focus:ring-brand/15"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg"
                  aria-label={show ? "Ocultar senha" : "Mostrar senha"}
                  aria-pressed={show}
                >
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {errorMsg && (
              <p id={errId} role="alert" className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm text-danger">
                {errorMsg}
              </p>
            )}

            <Button type="submit" size="lg" className="w-full" loading={login.isPending} disabled={!username.trim() || !password}>
              {login.isPending ? "Conectando ao SIGAA…" : "Entrar"}
            </Button>
          </form>

          <div className="mt-6 flex gap-2.5 rounded-xl border border-line bg-surface-2 px-3.5 py-3 text-xs leading-relaxed text-muted">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand" />
            <p>
              <strong className="font-semibold text-fg">Projeto não oficial.</strong> Sua senha é enviada apenas ao SIGAA e nunca é armazenada.{" "}
              <a href={OFFICIAL_SIGAA_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 font-medium text-brand-strong underline underline-offset-2">
                Acessar o SIGAA oficial
                <ExternalLink className="size-3" />
              </a>
            </p>
          </div>
        </div>
      </div>
      {/* Visual panel: purely decorative dither animation. */}
      <div className="relative hidden overflow-hidden bg-[#0c120f] lg:block">
        <DitherField className="absolute inset-0" />
      </div>
    </div>
  );
}
