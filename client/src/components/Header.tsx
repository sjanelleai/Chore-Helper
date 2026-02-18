import { UserCircle } from "lucide-react";
import { PointsDisplay } from "./PointsDisplay";

export function Header({ title, showPoints = true }: { title: string, showPoints?: boolean }) {
  return (
    <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border/50">
      <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-between">
        <h1 className="text-xl font-display font-bold text-foreground">
          {title}
        </h1>
        {showPoints && <PointsDisplay compact />}
      </div>
    </header>
  );
}
