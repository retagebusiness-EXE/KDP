import Link from "next/link";
import { logoutAction } from "@/lib/auth/actions";
import { cn } from "@/lib/utils/cn";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/projects", label: "Projects" },
  { href: "/projects/new", label: "New Book" },
  { href: "/settings", label: "Settings" },
];

export function AppShell({
  children,
  user,
  activePath,
}: {
  children: React.ReactNode;
  user: { name: string | null; email: string; role: string; plan: string };
  activePath: string;
}) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">K</div>
          <span className="text-sm font-semibold text-slate-900">KDP Book Builder</span>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "block rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                activePath === item.href && "bg-indigo-50 text-indigo-700 hover:bg-indigo-50 hover:text-indigo-700"
              )}
            >
              {item.label}
            </Link>
          ))}
          {user.role === "ADMIN" && (
            <Link
              href="/admin"
              className={cn(
                "block rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                activePath === "/admin" && "bg-indigo-50 text-indigo-700"
              )}
            >
              Admin
            </Link>
          )}
        </nav>
        <div className="border-t border-slate-200 p-3">
          <div className="mb-2 rounded-lg bg-slate-50 px-3 py-2">
            <p className="truncate text-xs font-medium text-slate-900">{user.name || user.email}</p>
            <p className="text-xs text-slate-500">{user.plan} plan</p>
          </div>
          <form action={logoutAction}>
            <button type="submit" className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-100">
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 md:hidden">
          <span className="text-sm font-semibold">KDP Book Builder</span>
          <form action={logoutAction}>
            <button type="submit" className="text-sm text-slate-600">
              Sign out
            </button>
          </form>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
