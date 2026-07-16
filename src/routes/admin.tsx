import {
  createFileRoute,
  Outlet,
  Link,
  useRouterState,
  useNavigate,
  redirect,
} from "@tanstack/react-router";
import {
  LayoutDashboard,
  Bus,
  User,
  MapPin,
  Link2,
  CalendarClock,
  Radio,
  Home,
  LogOut,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { adminLogout, adminMe } from "@/lib/admin-auth.functions";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
  errorComponent: AdminErrorComponent,
  beforeLoad: async ({ location }) => {
    if (location.pathname === "/admin/login") {
      return;
    }

    const session = await adminMe();
    if (!session) {
      throw redirect({ to: "/admin/login" });
    }
  },
});

function AdminErrorComponent({ error }: { error: Error }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (error.message === "Unauthorized") {
      navigate({ to: "/admin/login" });
    }
  }, [error, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Unauthorized Access
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You need to be logged in to access the admin dashboard.
        </p>
        <div className="mt-6">
          <Button onClick={() => navigate({ to: "/admin/login" })} className="w-full">
            Go to Login
          </Button>
        </div>
      </div>
    </div>
  );
}

const nav: { to: string; label: string; icon: typeof Bus; exact?: boolean }[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/buses", label: "Buses", icon: Bus },
  { to: "/admin/drivers", label: "Drivers", icon: User },
  { to: "/admin/routes", label: "Routes & Stops", icon: MapPin },
  { to: "/admin/assignments", label: "Assignments", icon: Link2 },
  { to: "/admin/trips", label: "Trips", icon: CalendarClock },
  { to: "/admin/monitor", label: "Live Monitor", icon: Radio },
];

function AdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const meFn = useServerFn(adminMe);
  const logoutFn = useServerFn(adminLogout);

  useEffect(() => {
    if (pathname === "/admin/login") return;

    let cancelled = false;
    meFn().then((session) => {
      if (!cancelled) setAdminEmail(session?.email ?? null);
    });

    return () => {
      cancelled = true;
    };
  }, [meFn, pathname]);

  const handleLogout = async () => {
    await logoutFn();
    setAdminEmail(null);
    navigate({ to: "/admin/login" });
  };

  if (pathname === "/admin/login") {
    return <Outlet />;
  }

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-60 shrink-0 border-r bg-card hidden md:flex flex-col">
        <div className="p-5 border-b">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center text-sm">
              🚌
            </div>
            <div>
              <div className="text-sm font-bold leading-none">Smart Bus</div>
              <div className="text-[10px] text-muted-foreground mt-1">Admin</div>
            </div>
          </Link>
        </div>
        <nav className="p-3 flex-1 space-y-1">
          {nav.map((n) => {
            const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${active ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >
                <n.icon size={16} />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t space-y-2">
          {adminEmail && (
            <div className="px-3 py-2 text-xs">
              <p className="text-muted-foreground">Logged in as</p>
              <p className="font-medium truncate text-foreground">{adminEmail}</p>
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start text-xs"
            onClick={handleLogout}
          >
            <LogOut size={14} className="mr-2" />
            Logout
          </Button>
          <Link
            to="/"
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground px-3 py-2"
          >
            <Home size={14} /> Back to home
          </Link>
        </div>
      </aside>

      {/* Mobile top nav with logout */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t z-50 flex overflow-x-auto">
        {nav.map((n) => {
          const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
          return (
            <Link
              key={n.to}
              to={n.to}
              className={`flex-1 min-w-[64px] py-2 flex flex-col items-center gap-1 text-[10px] ${active ? "text-primary" : "text-muted-foreground"}`}
            >
              <n.icon size={16} />
              {n.label.split(" ")[0]}
            </Link>
          );
        })}
        <button
          onClick={handleLogout}
          className="flex-1 min-w-[64px] py-2 flex flex-col items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition"
        >
          <LogOut size={16} />
          Logout
        </button>
      </div>

      <main className="flex-1 overflow-x-hidden pb-20 md:pb-0">
        <Outlet />
      </main>
    </div>
  );
}
