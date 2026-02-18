import { Link, useLocation } from "wouter";
import { CheckSquare, Star, ShoppingBag, LayoutDashboard, Shield } from "lucide-react";
import { motion } from "framer-motion";

export function Navigation() {
  const [location] = useLocation();

  const navItems = [
    { href: "/", icon: LayoutDashboard, label: "Home" },
    { href: "/chores", icon: CheckSquare, label: "Chores" },
    { href: "/rewards", icon: ShoppingBag, label: "Store" },
    { href: "/badges", icon: Star, label: "Badges" },
    { href: "/parent", icon: Shield, label: "Parent" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-t border-border pb-safe" data-testid="nav-bottom">
      <div className="max-w-md mx-auto px-2 h-16 flex items-center justify-around">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = location === href;
          return (
            <Link key={href} href={href} className="relative flex flex-col items-center justify-center w-14 h-full group" data-testid={`nav-link-${label.toLowerCase()}`}>
              <div className={`
                p-2 rounded-xl transition-all duration-300
                ${isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'}
              `}>
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5px]' : ''}`} />
                {isActive && (
                  <motion.div
                    layoutId="nav-pill"
                    className="absolute -bottom-1 w-1 h-1 bg-primary rounded-full"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
              </div>
              <span className={`text-[10px] font-bold mt-0.5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
