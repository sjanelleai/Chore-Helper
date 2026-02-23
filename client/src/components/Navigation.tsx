import { Link, useLocation } from "wouter";
import { CheckSquare, Star, ShoppingBag, LayoutDashboard, Shield } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
} from "@/components/ui/sidebar";

const ALL_NAV_ITEMS = [
  { href: "/", icon: LayoutDashboard, label: "Home", parentOnly: false },
  { href: "/chores", icon: CheckSquare, label: "Chores", parentOnly: false },
  { href: "/rewards", icon: ShoppingBag, label: "Store", parentOnly: false },
  { href: "/badges", icon: Star, label: "Badges", parentOnly: false },
  { href: "/parent", icon: Shield, label: "Parent", parentOnly: true },
];

function MobileNav() {
  const [location] = useLocation();
  const { mode } = useAuth();

  const items = ALL_NAV_ITEMS.filter(i => !i.parentOnly || mode === "parent");

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-t border-border pb-safe md:hidden" data-testid="nav-bottom">
      <div className="max-w-md mx-auto px-2 h-16 flex items-center justify-around">
        {items.map(({ href, icon: Icon, label }) => {
          const isActive = location === href;
          return (
            <Link key={href} href={href} className="relative flex flex-col items-center justify-center w-14 h-full group" data-testid={`nav-link-${label.toLowerCase()}`}>
              <div className={cn(
                "p-2 rounded-md transition-all duration-300",
                isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
              )}>
                <Icon className={cn("w-5 h-5", isActive && "stroke-[2.5px]")} />
                {isActive && (
                  <motion.div
                    layoutId="nav-pill-mobile"
                    className="absolute -bottom-1 w-1 h-1 bg-primary rounded-full"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
              </div>
              <span className={cn("text-[10px] font-bold mt-0.5", isActive ? "text-primary" : "text-muted-foreground")}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function DesktopSidebar() {
  const [location] = useLocation();
  const { mode } = useAuth();

  const items = ALL_NAV_ITEMS.filter(i => !i.parentOnly || mode === "parent");

  return (
    <Sidebar collapsible="none" data-testid="nav-sidebar">
      <SidebarHeader className="p-4">
        <h2 className="text-xl font-display font-bold text-sidebar-primary">HomeQuest</h2>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map(({ href, icon: Icon, label }) => {
                const isActive = location === href;
                return (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={label}>
                      <Link href={href} data-testid={`nav-sidebar-link-${label.toLowerCase()}`}>
                        <Icon />
                        <span>{label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const style = {
    "--sidebar-width": "14rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider defaultOpen={true} style={style as React.CSSProperties}>
      <div className="flex min-h-screen w-full">
        <div className="hidden md:block">
          <DesktopSidebar />
        </div>
        <main className="flex-1 min-w-0 pb-20 md:pb-0">
          {children}
        </main>
      </div>
      <MobileNav />
    </SidebarProvider>
  );
}

export { MobileNav as Navigation };
