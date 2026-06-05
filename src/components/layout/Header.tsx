import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Menu, X, Coins, GitCompare, MessageSquare, Bell, Shield, User as UserIcon, Home, LayoutDashboard, Heart, History as HistoryIcon, Plus, BadgeCheck, LogOut, LogIn, UserPlus, Newspaper } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useCompare } from "@/hooks/use-compare";
import { useI18n } from "@/hooks/use-i18n";
import { LanguageToggle } from "@/components/LanguageToggle";

type AdminMode = "admin" | "user";

export function Header() {
  const { user, roles, signOut } = useAuth();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [tokens, setTokens] = useState<number | null>(null);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const { ids: compareIds } = useCompare();
  const isAdmin = roles.includes("admin");
  const [adminMode, setAdminMode] = useState<AdminMode>("admin");

  useEffect(() => {
    if (!isAdmin) return;
    const stored = (typeof window !== "undefined" && (localStorage.getItem("adminMode") as AdminMode)) || "admin";
    setAdminMode(stored === "user" ? "user" : "admin");
  }, [isAdmin]);

  const switchMode = (m: AdminMode) => {
    setAdminMode(m);
    try { localStorage.setItem("adminMode", m); } catch {}
    navigate({ to: m === "admin" ? "/dashboard/admin" : "/dashboard/owner" });
  };

  useEffect(() => {
    if (!user) { setTokens(null); setUnread(0); return; }
    supabase.from("profiles").select("tokens_balance").eq("id", user.id).single()
      .then(({ data }) => setTokens(data?.tokens_balance ?? 0));
    const loadUnread = () => {
      supabase.from("messages").select("id", { count: "exact", head: true })
        .eq("recipient_id", user.id).is("read_at", null)
        .then(({ count }) => setUnread(count ?? 0));
    };
    loadUnread();
    const ch = supabase.channel(`hdr-msgs-${user.id}`)
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "messages", filter: `recipient_id=eq.${user.id}` }, loadUnread)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  // Effective role view: admins in "user" mode behave like a regular owner
  const inAdminView = isAdmin && adminMode === "admin";
  const inUserView = !isAdmin || adminMode === "user";
  const canPost = roles.includes("proprietaire") || isAdmin;
  const userDashboardPath = roles.includes("proprietaire") || isAdmin
    ? "/dashboard/owner"
    : "/dashboard/tenant";

  const close = () => setOpen(false);

  return (
    <nav className="sticky top-0 z-50 bg-background/85 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 md:h-20 flex items-center justify-between gap-3">
        <div className="flex items-center gap-8 min-w-0">
          <Link to="/" onClick={close} className="font-display text-xl md:text-2xl font-bold tracking-tight text-primary italic truncate">
            Vohitra.
          </Link>
          <div className="hidden md:flex gap-6 text-sm font-medium items-center">
            <Link to="/" className="hover:text-primary transition-colors">{t("nav.listings")}</Link>
            <Link to="/blog" className="hover:text-primary transition-colors">{t("nav.blog")}</Link>
            {user && inAdminView && (
              <Link to="/dashboard/admin" className="hover:text-primary transition-colors">{t("nav.adminSpace")}</Link>
            )}
            {user && inUserView && (
              <>
                <Link to={userDashboardPath} className="hover:text-primary transition-colors">{t("nav.mySpace")}</Link>
                <Link to="/messages" className="hover:text-primary transition-colors relative inline-flex items-center gap-1">
                  {t("nav.messages")}
                  {unread > 0 && <span className="text-[10px] font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full min-w-4 text-center">{unread}</span>}
                </Link>
                <details className="relative group">
                  <summary className="list-none cursor-pointer hover:text-primary transition-colors select-none">{t("nav.more")}</summary>
                  <div className="absolute right-0 mt-2 w-52 bg-popover border border-border rounded-xl shadow-lg p-1.5 z-50 flex flex-col">
                    <Link to="/favorites" className="px-3 py-2 rounded-md hover:bg-muted flex items-center gap-2 text-sm"><Heart className="size-4 text-primary" />{t("nav.favorites")}</Link>
                    <Link to="/alerts" className="px-3 py-2 rounded-md hover:bg-muted flex items-center gap-2 text-sm"><Bell className="size-4 text-primary" />{t("nav.alerts")}</Link>
                    <Link to="/history" className="px-3 py-2 rounded-md hover:bg-muted flex items-center gap-2 text-sm"><HistoryIcon className="size-4 text-primary" />{t("nav.history")}</Link>
                    <Link to="/kyc" className="px-3 py-2 rounded-md hover:bg-muted flex items-center gap-2 text-sm"><BadgeCheck className="size-4 text-primary" />{t("nav.verification")}</Link>
                  </div>
                </details>
              </>
            )}
          </div>
        </div>

        {/* Desktop right */}
        <div className="hidden md:flex items-center gap-3">
          {isAdmin && (
            <div className="flex items-center bg-muted rounded-full p-0.5">
              <button
                onClick={() => switchMode("admin")}
                className={`flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${adminMode === "admin" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
              >
                <Shield className="size-3.5" /> {t("nav.admin")}
              </button>
              <button
                onClick={() => switchMode("user")}
                className={`flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${adminMode === "user" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
              >
                <UserIcon className="size-3.5" /> {t("nav.user")}
              </button>
            </div>
          )}
          {compareIds.length > 0 && inUserView && (
            <Link to="/compare" className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/5 hover:bg-primary/10 rounded-full transition-colors">
              <GitCompare className="size-3.5 text-primary" />
              <span className="text-xs font-medium">{t("nav.compare")} ({compareIds.length})</span>
            </Link>
          )}
          <LanguageToggle />
          <ThemeToggle />
          {user && inUserView && tokens !== null && (
            <Link to="/tokens" className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/5 hover:bg-primary/10 rounded-full transition-colors">
              <Coins className="size-3.5 text-primary" />
              <span className="text-xs font-mono font-medium">{tokens} {t("nav.tokens")}</span>
            </Link>
          )}
          {user ? (
            <button
              onClick={async () => { await signOut(); navigate({ to: "/" }); }}
              className="text-sm font-medium px-4 py-2 hover:bg-black/5 rounded-lg transition-colors"
            >
              {t("nav.signOut")}
            </button>
          ) : (
            <>
              <Link to="/login" className="text-sm font-medium px-4 py-2 hover:bg-black/5 rounded-lg transition-colors">{t("nav.signIn")}</Link>
              <Link to="/signup" className="text-sm font-medium bg-foreground text-background px-5 py-2 rounded-lg hover:opacity-90 transition-opacity">{t("nav.signUp")}</Link>
            </>
          )}
        </div>

        {/* Mobile right */}
        <div className="md:hidden flex items-center gap-2">
          <LanguageToggle />
          <ThemeToggle />
          {user && inUserView && tokens !== null && (
            <Link to="/tokens" onClick={close} className="flex items-center gap-1 px-2.5 py-1 bg-primary/10 rounded-full">
              <Coins className="size-3 text-primary" />
              <span className="text-xs font-mono font-bold">{tokens}</span>
            </Link>
          )}
          <button
            aria-label={t("nav.menu")}
            onClick={() => setOpen((v) => !v)}
            className="p-2 -mr-2 rounded-md hover:bg-black/5"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {/* Mobile sheet */}
      {open && (
        <div className="md:hidden border-t border-border bg-background animate-fade-up">
          <div className="px-4 py-4 flex flex-col gap-1 text-sm font-medium">
            {isAdmin && (
              <div className="flex items-center bg-muted rounded-full p-0.5 mb-3 self-stretch w-full">
                <button
                  onClick={() => { switchMode("admin"); close(); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-full transition-colors ${adminMode === "admin" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
                >
                  <Shield className="size-3.5" /> {t("nav.admin")}
                </button>
                <button
                  onClick={() => { switchMode("user"); close(); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-full transition-colors ${adminMode === "user" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
                >
                  <UserIcon className="size-3.5" /> {t("nav.user")}
                </button>
              </div>
            )}

            {user && inUserView && canPost && (
              <Link to="/property/new" onClick={close} className="mb-2 py-3 px-4 bg-primary text-primary-foreground rounded-xl flex items-center justify-center gap-2 font-semibold shadow-sm">
                <Plus className="size-4" /> {t("nav.newListing")}
              </Link>
            )}

            {/* Section: Navigation */}
            <MobileLink to="/" onClick={close} icon={<Home className="size-4" />} label={t("nav.listings")} />
            <MobileLink to="/blog" onClick={close} icon={<Newspaper className="size-4" />} label={t("nav.blog")} />
            {compareIds.length > 0 && inUserView && (
              <MobileLink to="/compare" onClick={close} icon={<GitCompare className="size-4" />} label={`${t("nav.compare")} (${compareIds.length})`} />
            )}

            {user ? (
              <>
                <div className="my-2 h-px bg-border" />
                {/* Section: Espace */}
                {inAdminView && (
                  <MobileLink to="/dashboard/admin" onClick={close} icon={<Shield className="size-4" />} label={t("nav.adminSpace")} />
                )}
                {inUserView && (
                  <>
                    <MobileLink to={userDashboardPath} onClick={close} icon={<LayoutDashboard className="size-4" />} label={t("nav.mySpace")} />
                    <MobileLink to="/messages" onClick={close} icon={<MessageSquare className="size-4" />} label={t("nav.messages")} badge={unread > 0 ? unread : undefined} />
                    <MobileLink to="/favorites" onClick={close} icon={<Heart className="size-4" />} label={t("nav.myFavorites")} />
                    <MobileLink to="/alerts" onClick={close} icon={<Bell className="size-4" />} label={t("nav.myAlerts")} />
                    <MobileLink to="/tokens" onClick={close} icon={<Coins className="size-4" />} label={t("nav.buyTokens")} />
                    <MobileLink to="/history" onClick={close} icon={<HistoryIcon className="size-4" />} label={t("nav.history")} />
                    <MobileLink to="/kyc" onClick={close} icon={<BadgeCheck className="size-4" />} label={t("nav.idVerification")} />
                  </>
                )}

                <div className="my-2 h-px bg-border" />
                <button
                  onClick={async () => { close(); await signOut(); navigate({ to: "/" }); }}
                  className="text-left py-2.5 px-3 rounded-md hover:bg-muted text-destructive flex items-center gap-3"
                >
                  <LogOut className="size-4" /> {t("nav.signOut")}
                </button>
              </>
            ) : (
              <>
                <div className="my-2 h-px bg-border" />
                <MobileLink to="/login" onClick={close} icon={<LogIn className="size-4" />} label={t("nav.signIn")} />
                <Link to="/signup" onClick={close} className="mt-1 py-3 px-4 bg-foreground text-background rounded-xl flex items-center justify-center gap-2 font-semibold">
                  <UserPlus className="size-4" /> {t("nav.signUp")}
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}

/** Single mobile-menu row — icon + label + optional badge, fully symmetric. */
function MobileLink({
  to,
  onClick,
  icon,
  label,
  badge,
}: {
  to: string;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}) {
  return (
    <Link
      to={to as any}
      onClick={onClick}
      className="py-2.5 px-3 rounded-md hover:bg-muted flex items-center gap-3"
    >
      <span className="text-primary shrink-0">{icon}</span>
      <span className="flex-1">{label}</span>
      {badge !== undefined && (
        <span className="text-[10px] font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
          {badge}
        </span>
      )}
    </Link>
  );
}
