"use client"

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Book, Compass, SquareArrowDown, History, Settings } from "lucide-react";
import { cn } from "~/lib/utils";

const navItems = [
  { href: "/library", label: "Library", icon: Book },
  { href: "/browse", label: "Browse", icon: Compass },
  { href: "/updates", label: "Updates", icon: History },
  { href: "/downloads", label: "Downloads", icon: SquareArrowDown },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur-sm">
      <div className="grid h-16 grid-cols-5 max-w-lg mx-auto font-medium">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={label}
            href={href}
            className={cn(
              "inline-flex flex-col items-center justify-center px-5 hover:bg-muted",
              pathname === href ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Icon className="w-5 h-5 mb-1" />
            <span className="text-xs">{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}