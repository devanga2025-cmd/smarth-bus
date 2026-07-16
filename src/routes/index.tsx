import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Download, Shield, Bus, Users, Smartphone } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Home,
});

const cards = [
  {
    to: "/admin/login",
    icon: Shield,
    title: "Administrator",
    desc: "Manage buses, drivers, routes, stops, assignments, and active trips.",
    color: "var(--color-admin)",
  },
  {
    to: "/driver",
    icon: Bus,
    title: "Driver",
    desc: "View assigned bus, start trips, share live location, and complete trips.",
    color: "var(--color-driver)",
  },
  {
    to: "/passenger",
    icon: Users,
    title: "Passenger",
    desc: "Search buses by boarding and destination stops and track buses live.",
    color: "var(--color-passenger)",
  },
] as const;

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function Home() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const nav = window.navigator as Navigator & { standalone?: boolean };
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
    setIsInstalled(standalone);

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setCanInstall(true);
    };

    const handleInstalled = () => {
      setInstallPrompt(null);
      setIsInstalled(true);
      setCanInstall(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const installApp = async () => {
    if (!installPrompt) return;

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setInstallPrompt(null);
      setCanInstall(false);
    }
  };

  const installLabel = isInstalled
    ? "App installed"
    : canInstall
      ? "Install App"
      : "Install loading...";

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-5 flex items-center gap-3">
          <div className="w-10 h-10 shrink-0 rounded-xl bg-primary flex items-center justify-center text-primary-foreground text-lg">
            ðŸšŒ
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold">Smart Bus</h1>
            <p className="text-xs text-muted-foreground truncate">
              Live transit tracking &amp; route management
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 md:py-16">
        <div className="text-center mb-8 sm:mb-12">
          <div className="mx-auto mb-5 flex w-full max-w-sm flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={installApp}
              disabled={!installPrompt || isInstalled}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Download size={18} />
              {installLabel}
            </button>
            <div className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border bg-card px-4 py-3 text-xs text-muted-foreground">
              <Smartphone size={16} />
              Opens like a mobile app
            </div>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
            Choose your role
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground mt-3 max-w-xl mx-auto">
            A complete platform for administrators, drivers, and passengers with live GPS tracking
            and real-time trip monitoring.
          </p>
        </div>

        <div className="grid gap-4 sm:gap-6 md:grid-cols-3">
          {cards.map((c) => (
            <Link
              key={c.to}
              to={c.to}
              className="group relative bg-card border rounded-2xl p-5 sm:p-7 transition-all hover:shadow-xl hover:-translate-y-1 hover:border-primary/40"
            >
              <div
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center mb-4 sm:mb-5 text-white"
                style={{ backgroundColor: c.color }}
              >
                <c.icon size={26} />
              </div>
              <h3 className="text-xl sm:text-2xl font-semibold mb-2">{c.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{c.desc}</p>
              <div className="mt-5 sm:mt-6 text-sm font-medium text-primary sm:opacity-0 group-hover:opacity-100 transition-opacity">
                Open dashboard -&gt;
              </div>
            </Link>
          ))}
        </div>
      </main>

      <footer className="border-t mt-8 sm:mt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 text-xs text-muted-foreground text-center">
          Smart Bus - powered by OpenStreetMap &amp; realtime GPS
        </div>
      </footer>
    </div>
  );
}
