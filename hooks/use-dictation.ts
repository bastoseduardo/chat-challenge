"use client"

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"

// Ditado por voz (SPEC-R4-009) com a Web Speech API. Chrome/Edge/Safari têm
// (prefixo webkit); Firefox não, e aí o botão nem aparece.

interface RecognitionResult {
  isFinal: boolean
  0: { transcript: string }
}
interface RecognitionEvent {
  resultIndex: number
  results: ArrayLike<RecognitionResult>
}
interface Recognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((e: RecognitionEvent) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}
type RecognitionCtor = new () => Recognition

function getCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

const noop = () => () => {}

/**
 * `onText(final, interim)`: `final` é o texto já confirmado nesta sessão de
 * ditado e `interim` o trecho ainda provisório. Quem chama junta com o que já
 * estava digitado.
 */
export function useDictation({
  onText,
  onError,
}: {
  onText: (final: string, interim: string) => void
  onError: (kind: "permission" | "other") => void
}) {
  // false no servidor e na hidratação; o botão só aparece no cliente.
  const supported = useSyncExternalStore(noop, () => !!getCtor(), () => false)
  const [listening, setListening] = useState(false)
  const recRef = useRef<Recognition | null>(null)
  const handlers = useRef({ onText, onError })
  useEffect(() => {
    handlers.current = { onText, onError }
  })

  const stop = useCallback(() => {
    recRef.current?.stop()
  }, [])

  const start = useCallback(() => {
    const Ctor = getCtor()
    if (!Ctor || recRef.current) return
    const rec = new Ctor()
    rec.lang = "pt-BR"
    rec.continuous = true
    rec.interimResults = true
    let finalText = ""
    rec.onresult = (e) => {
      let interim = ""
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) finalText += r[0].transcript
        else interim += r[0].transcript
      }
      handlers.current.onText(finalText.trim(), interim.trim())
    }
    rec.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return
      handlers.current.onError(e.error === "not-allowed" || e.error === "service-not-allowed" ? "permission" : "other")
    }
    rec.onend = () => {
      recRef.current = null
      setListening(false)
    }
    recRef.current = rec
    setListening(true)
    try {
      rec.start()
    } catch {
      recRef.current = null
      setListening(false)
      handlers.current.onError("other")
    }
  }, [])

  useEffect(() => () => recRef.current?.abort(), [])

  return { supported, listening, start, stop, toggle: listening ? stop : start }
}
