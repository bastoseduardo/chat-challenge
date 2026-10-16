"use client"

import { useSyncExternalStore } from "react"

// Painel "O que observar" (SPEC-R4-010). Os componentes chamam `markTour`
// quando a coisa acontece; o painel lê com `useTour`. Estado só deste
// navegador, em localStorage — se o storage falhar, vale só nesta aba.

export const TOUR_STEPS = ["citation", "trail", "note", "share"] as const
export type TourStep = (typeof TOUR_STEPS)[number]

export interface TourState {
  done: TourStep[]
  dismissed: boolean
  collapsed: boolean | null
}

const KEY = "seshat:tour"
const INITIAL: TourState = { done: [], dismissed: false, collapsed: null }

let state: TourState | null = null
const listeners = new Set<() => void>()

function load(): TourState {
  if (state) return state
  try {
    const raw = window.localStorage.getItem(KEY)
    const parsed = raw ? (JSON.parse(raw) as Partial<TourState>) : {}
    state = {
      done: (parsed.done ?? []).filter((s): s is TourStep => TOUR_STEPS.includes(s as TourStep)),
      dismissed: !!parsed.dismissed,
      collapsed: typeof parsed.collapsed === "boolean" ? parsed.collapsed : null,
    }
  } catch {
    state = INITIAL
  }
  return state
}

function save(next: TourState) {
  state = next
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next))
  } catch {}
  listeners.forEach((l) => l())
}

export function markTour(step: TourStep) {
  if (typeof window === "undefined") return
  const s = load()
  if (s.dismissed || s.done.includes(step)) return
  save({ ...s, done: [...s.done, step] })
}

export function dismissTour() {
  save({ ...load(), dismissed: true })
}

export function setTourCollapsed(collapsed: boolean) {
  save({ ...load(), collapsed })
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  // Outra aba marcou/dispensou.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return
    state = null
    listener()
  }
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", onStorage)
  }
}

/** `null` no servidor e na hidratação: o painel só aparece no cliente. */
export function useTour(): TourState | null {
  return useSyncExternalStore(subscribe, load, () => null)
}
