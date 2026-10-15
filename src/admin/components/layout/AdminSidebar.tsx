import { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Film,
  Tv,
  Clapperboard,
  Users,
  Store,
  CreditCard,
  Megaphone,
  Settings,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  UserCircle,
  Menu,
  X,
  Image,
  MessageSquare,
  Ticket,
  Rows3,
  SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface NavItem {
  title: string;
  icon: React.ElementType;
  href: string;
  badge?: number;
}

const mainNavItems: NavItem[] = [
  { title: "Dashboard", icon: LayoutDashboard, href: "/" },
  { title: "Movies", icon: Film, href: "/movies" },
  { title: "Web Series", icon: Tv, href: "/web-series" },
  { title: "TV Shows", icon: Clapperboard, href: "/tv-shows" },
  { title: "Categories", icon: FolderOpen, href: "/categories" },
  { title: "Cast & Crew", icon: UserCircle, href: "/cast-crew" },
];

const homeManagementNavItems: NavItem[] = [
  { title: "Hero Banners", icon: Image, href: "/home/banners" },
  { title: "Section Builder", icon: Rows3, href: "/home/sections" },
  { title: "Popup", icon: MessageSquare, href: "/popups" },
  { title: "Home Settings", icon: SlidersHorizontal, href: "/home/settings" },
];

const managementNavItems: NavItem[] = [
  { title: "Users", icon: Users, href: "/users" },
  { title: "Redeem Codes", icon: Ticket, href: "/redeem-code" },
  { title: "Ads Manager", icon: Megaphone, href: "/ads" },
  { title: "Subscriptions", icon: CreditCard, href: "/subscriptions" },
  { title: "Vendors", icon: Store, href: "/vendors" },
];

const settingsNavItems: NavItem[] = [{ title: "Settings", icon: Settings, href: "/settings" }];

interface AdminSidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function AdminSidebar({ mobileOpen, onMobileClose }: AdminSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const isMobile = useIsMobile();

  const isActive = (href: string) => (href === "/" ? location.pathname === "/" : location.pathname === href || location.pathname.startsWith(href + "/"));

  // Close mobile sidebar on route change
  useEffect(() => {
    if (isMobile && onMobileClose) {
      onMobileClose();
    }
  }, [location.pathname]);

  const NavSection = ({ items, label }: { items: NavItem[]; label?: string }) => (
    <div className="space-y-1">
      {label && !collapsed && (
        <p className="mb-2 px-4 text-[10px] font-bold uppercase tracking-[0.2em] text-sidebar-foreground/30">
          {label}
        </p>
      )}
      {collapsed && label && !isMobile && <div className="mx-auto my-2 h-px w-8 bg-sidebar-border" />}
      {items.map((item) => (
        <NavLink
          key={item.href}
          to={item.href}
          onClick={(e) => {
            e.stopPropagation();
            onMobileClose?.();
          }}
          preventScrollReset
          className={cn(
            "group relative mx-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/60 transition-all duration-200 hover:bg-sidebar-accent hover:text-sidebar-foreground",
            isActive(item.href) && "bg-gradient-to-r from-primary/20 to-primary/5 text-primary shadow-sm"
          )}
        >
          <item.icon className={cn(
            "h-[18px] w-[18px] shrink-0 transition-colors",
            isActive(item.href) && "text-primary"
          )} />
          {(!collapsed || isMobile) && (
            <>
              <span className="flex-1">{item.title}</span>
              {item.badge && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                  {item.badge}
                </span>
              )}
            </>
          )}
          {collapsed && !isMobile && item.badge && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
              {item.badge}
            </span>
          )}
        </NavLink>
      ))}
    </div>
  );

  const SidebarContent = () => (
    <>
      {/* Logo Section */}
      <div className={cn(
        "flex flex-col items-center justify-center border-b border-sidebar-border py-3",
        collapsed && !isMobile ? "px-2" : "px-4"
      )}>
        {collapsed && !isMobile ? (
          <span style={{ fontFamily: 'Nunito, sans-serif', color: '#E54B2A' }} className="text-xl font-black">
            G+
          </span>
        ) : (
          <>
            <span style={{ fontFamily: 'Nunito, sans-serif', color: '#E54B2A' }} className="text-[26px] font-black tracking-tight">
              GUTARGOO+
            </span>
            <span className="text-[9px] font-semibold uppercase tracking-widest text-sidebar-foreground/50">
              Admin Panel
            </span>
          </>
        )}
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1">
        <nav className="space-y-6 py-6">
          <NavSection items={mainNavItems} label="Content" />
          <NavSection items={homeManagementNavItems} label="Home Management" />
          <NavSection items={managementNavItems} label="Management" />
          <NavSection items={settingsNavItems} label="System" />
        </nav>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t border-sidebar-border px-3 py-2.5">
        <div className="flex items-center justify-between">
          {(!collapsed || isMobile) && (
            <p className="text-[10px] font-medium tracking-wide text-sidebar-foreground/40">
              Powered By{" "}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text font-bold text-transparent">
                Infyle Technologies
              </span>
            </p>
          )}
          {!isMobile && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className={cn(
                "flex items-center justify-center rounded-lg bg-sidebar-accent p-2 text-primary transition-all hover:bg-primary hover:text-primary-foreground",
                collapsed && "mx-auto"
              )}
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
      </div>
    </>
  );

  // Mobile: Use Sheet component
  if (isMobile) {
    return (
      <Sheet open={mobileOpen} onOpenChange={(open) => !open && onMobileClose?.()}>
        <SheetContent side="left" className="w-[280px] p-0 bg-sidebar border-sidebar-border">
          <div className="flex h-full flex-col">
            <SidebarContent />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: Fixed sidebar
  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 hidden md:flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300",
        collapsed ? "w-[72px]" : "w-64"
      )}
    >
      <SidebarContent />
    </aside>
  );
}

export function MobileSidebarTrigger({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="md:hidden h-10 w-10 rounded-xl"
      onClick={onClick}
    >
      <Menu className="h-5 w-5" />
    </Button>
  );
}