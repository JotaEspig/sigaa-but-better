import { Compass } from "lucide-react";
import { Link } from "react-router";

export default function NotFoundPage() {
  return (
    <div className="card mx-auto mt-10 flex max-w-md flex-col items-center gap-3 px-6 py-12 text-center animate-in">
      <span className="grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand-strong">
        <Compass className="size-7" />
      </span>
      <p className="text-5xl font-bold tracking-tight text-subtle tabular">404</p>
      <h1 className="text-lg font-semibold">Página não encontrada</h1>
      <p className="text-sm text-muted">Esse endereço não existe por aqui. Que tal voltar para o início?</p>
      <Link to="/" className="mt-2 inline-flex h-10 items-center rounded-xl bg-brand px-4 text-sm font-medium text-brand-fg hover:bg-brand-strong">
        Ir para o início
      </Link>
    </div>
  );
}
