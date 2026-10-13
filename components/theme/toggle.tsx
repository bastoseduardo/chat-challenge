"use client"

import { useTheme } from "next-themes"
import { Moon, Sun } from "lucide-react"
import { useEffect, useState } from "react"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return (
      <button
        className="p-1.5 rounded hover:bg-accent"
        aria-label="Alternar tema"
        disabled
      >
        <Sun className="w-4 h-4" />
      </button>
    )
  }

  const isDark = theme === "dark"
  return (
    <button
      className="p-1.5 rounded hover:bg-accent transition-colors"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Modo claro" : "Modo escuro"}
      title={isDark ? "Modo claro" : "Modo escuro"}
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  )
}
