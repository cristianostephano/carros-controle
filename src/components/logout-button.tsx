import { logout } from "@/app/login/actions";

export function LogoutButton() {
  return (
    <form action={logout} className="mt-2">
      <button type="submit" className="text-xs text-white/50 hover:text-white/80">
        Sair
      </button>
    </form>
  );
}
