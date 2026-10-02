import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm rounded-lg border bg-white p-6">
        <div className="mb-4 flex items-center gap-2">
          <span className="rounded bg-brand-yellow px-1.5 py-0.5 text-xs font-bold text-brand-navy">RAIAR</span>
          <span className="text-xs text-zinc-500">Gestão de Frota</span>
        </div>
        <h1 className="mb-4 text-lg font-semibold text-brand-navy">Entrar</h1>
        <LoginForm />
      </div>
    </div>
  );
}
