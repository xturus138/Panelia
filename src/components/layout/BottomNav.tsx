"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Book, Compass, SquareArrowDown, Settings } from "lucide-react"
import { cn } from "~/lib/utils"
import { useReaderStore } from "~/stores/reader"

const navItems = [
  { href: "/library", label: "Library", icon: Book },
  { href: "/browse", label: "Browse", icon: Compass },
  { href: "/downloads", label: "Downloads", icon: SquareArrowDown },
  { href: "/settings", label: "Settings", icon: Settings },
]

export function BottomNav() {
  const pathname = usePathname()
  const isReaderOpen = useReaderStore((s) => s.isReaderOpen)

  if (pathname.startsWith('/reader') || isReaderOpen) return null

  return (
    <nav className="fixed bottom-4 left-4 right-4 z-50 max-w-lg mx-auto">
      <div className="bg-white dark:bg-zinc-900 rounded-full px-6 py-3 flex items-center justify-around shadow-lg shadow-black/5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/")
          return (
            <Link
              key={label}
              href={href}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-1.5 rounded-full transition-all duration-150",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-semibold">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}