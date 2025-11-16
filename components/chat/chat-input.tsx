"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Send, Loader2, Sparkles, Mic, MicOff } from "lucide-react"
import { QuickActions } from "./quick-actions"

interface ChatInputProps {
  onSendMessage: (message: string, options?: { capabilities?: { [key: string]: boolean }; ttsFemale?: boolean }) => void
  isLoading: boolean
}

export function ChatInput({ onSendMessage, isLoading }: ChatInputProps) {
  const [inputValue, setInputValue] = useState("")
  const [isRecording, setIsRecording] = useState(false)
  const [isSpeechSupported, setIsSpeechSupported] = useState(true)
  // Use stable defaults during SSR to avoid hydration mismatches. We'll restore
  // persisted values on mount (client-side) in a useEffect below.
  const [capabilityStates, setCapabilityStates] = useState<{ [key: string]: boolean }>({ Programación: false, Matemáticas: false })
  const [ttsFemale, setTtsFemale] = useState<boolean>(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<any>(null)
  const isRecordingRef = useRef(false)
  const lastFinalRef = useRef<{ text: string; time: number }>({ text: "", time: 0 })
  // Persist user preference for voice mode in localStorage ("true" / "false").
  // Initialize to false (stable for SSR) and restore on mount.
  const [voiceMode, setVoiceMode] = useState<boolean>(false)

  const handleSendMessage = () => {
    if (!inputValue.trim() || isLoading) return
    onSendMessage(inputValue, { capabilities: capabilityStates, ttsFemale })
    setInputValue("")
    // keep focus in the input after sending so the user can continue typing
    inputRef.current?.focus()
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleQuickAction = (text: string) => {
    if (!isLoading) {
      setInputValue(text)
      inputRef.current?.focus()
    }
  }

  const handleToggleCapability = (label: string) => {
    setCapabilityStates((prev) => {
      const next = { ...prev, [label]: !prev[label] }
      try {
        localStorage.setItem("capabilityStates", JSON.stringify(next))
      } catch (e) {}
      return next
    })
  }

  const handleToggleTts = () => {
    setTtsFemale((v) => {
      const next = !v
      try {
        localStorage.setItem("ttsFemale", next ? "true" : "false")
      } catch (e) {}
      return next
    })
  }

  // Initialize SpeechRecognition (Web Speech API) if available
  const initRecognition = () => {
    const win = typeof window !== "undefined" ? (window as any) : null
    const SpeechRecognition = win?.SpeechRecognition || win?.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setIsSpeechSupported(false)
      return
    }

    // If there is an existing recognition instance, try to stop and cleanup it first
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null
        recognitionRef.current.onend = null
        recognitionRef.current.onerror = null
        recognitionRef.current.stop()
      } catch (e) {
        /* ignore cleanup errors */
      }
      recognitionRef.current = null
    }

    const recognition = new SpeechRecognition()
    recognition.lang = "es-ES"
    // Try to keep recognition continuous; some browsers stop automatically, so
    // we restart in onend while `isRecording` is true to emulate continuous capture.
    recognition.interimResults = true
    recognition.maxAlternatives = 1
    // Some implementations support continuous mode
    try {
      recognition.continuous = true
    } catch (e) {
      /* not supported everywhere */
    }

    recognition.onresult = (event: any) => {
      let interim = ""
      let finalTranscript = ""
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const res = event.results[i]
        if (res.isFinal) {
          finalTranscript += res[0].transcript
        } else {
          interim += res[0].transcript
        }
      }

      // update the input: when there's a final transcript, append it to the existing
      // input (so we don't lose typed text). For interim results, show the live
      // transcription but keep it replaceable by later final transcripts.
      setInputValue((prev) => {
        if (finalTranscript) {
          const cleaned = finalTranscript.trim()
          const now = Date.now()

          // If we've just appended the same final text recently, ignore to avoid duplicates
          if (
            lastFinalRef.current.text === cleaned &&
            now - lastFinalRef.current.time < 3000
          ) {
            return prev
          }

          // If the current input already ends with the cleaned final transcript,
          // avoid appending it again (helps when recognition returns overlapping finals).
          if (prev.trim().endsWith(cleaned)) {
            lastFinalRef.current = { text: cleaned, time: now }
            return prev
          }

          const sep = prev && prev.trim() ? " " : ""
          const newText = `${prev}${sep}${cleaned}`
          lastFinalRef.current = { text: cleaned, time: now }
          return newText
        }

        // show interim if available, otherwise keep previous user-typed content
        return interim || prev
      })

      // Do NOT stop recognition on final results. `onend` will restart it if
      // `isRecording` remains true, providing continuous listening until the
      // user explicitly stops.
    }

    recognition.onerror = (e: any) => {
      try {
        // Avoid passing the full event object to console.error because in
        // Next.js dev mode it may be treated as an unhandled error overlay.
        const errName = e?.error || (e?.message ? e.message : "unknown")
        console.warn("Speech recognition error:", errName)
      } catch (err) {
        // Swallow any logging errors
        console.warn("Speech recognition error (unknown)")
      }

      // If permission denied or service not allowed, stop and disable speech support
      if (e?.error === "not-allowed" || e?.error === "service-not-allowed") {
        isRecordingRef.current = false
        setIsRecording(false)
        setIsSpeechSupported(false)
      }
    }

    recognition.onend = () => {
      // If the user didn't explicitly stop, restart recognition to keep it running.
      // Use isRecordingRef to avoid stale closures.
      if (isRecordingRef.current) {
        try {
          // Recreate a fresh recognition instance and start it. Some browsers
          // require a new instance after end/stop.
          initRecognition()
          recognitionRef.current?.start()
        } catch (e) {
          console.warn("Failed to restart recognition", e)
          isRecordingRef.current = false
          setIsRecording(false)
        }
      } else {
        isRecordingRef.current = false
        setIsRecording(false)
      }
    }

    recognitionRef.current = recognition
  }

  const startRecording = () => {
    initRecognition()
    const recognition = recognitionRef.current
    if (!recognition) return
    try {
      recognition.start()
      setIsRecording(true)
      isRecordingRef.current = true
      // focus input so caret is visible and user can still edit
      inputRef.current?.focus()
      // Persist user preference: they enabled voice mode by starting recording
      try {
        if (typeof window !== "undefined") {
          localStorage.setItem("voiceMode", "true")
        }
      } catch (e) {
        /* ignore localStorage errors */
      }
      setVoiceMode(true)
    } catch (e) {
      console.warn("Failed to start recognition", e)
      setIsRecording(false)
      isRecordingRef.current = false
    }
  }

  const stopRecording = () => {
    const recognition = recognitionRef.current
    if (!recognition) return
    try {
      recognition.stop()
    } catch (e) {
      /* ignore */
    }
    setIsRecording(false)
    isRecordingRef.current = false
    inputRef.current?.focus()
    // Persist user preference: they disabled voice mode by stopping recording
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("voiceMode", "false")
      }
    } catch (e) {
      /* ignore localStorage errors */
    }
    setVoiceMode(false)
  }

  // Keep local state and localStorage in sync if storage is changed elsewhere
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!e.key) return
      try {
        if (e.key === "voiceMode") setVoiceMode(e.newValue === "true")
        if (e.key === "ttsFemale") setTtsFemale(e.newValue === "true")
        if (e.key === "capabilityStates") setCapabilityStates(e.newValue ? JSON.parse(e.newValue) : { Programación: false, Matemáticas: false })
      } catch (err) {
        // ignore
      }
    }
    try {
      window?.addEventListener?.("storage", onStorage)
    } catch (e) {}
    return () => {
      try {
        window?.removeEventListener?.("storage", onStorage)
      } catch (e) {}
    }
  }, [])

  // On mount, restore persisted preferences from localStorage. Doing this in
  // useEffect ensures the initial server-render matches the client and avoids
  // hydration mismatches.
  useEffect(() => {
    try {
      if (typeof window === "undefined") return
      const v = localStorage.getItem("voiceMode")
      const tts = localStorage.getItem("ttsFemale")
      const caps = localStorage.getItem("capabilityStates")

      if (v === "true") setVoiceMode(true)
      else if (v === "false") setVoiceMode(false)

      if (tts === "true") setTtsFemale(true)
      else if (tts === "false") setTtsFemale(false)

      if (caps) {
        try {
          setCapabilityStates(JSON.parse(caps))
        } catch (e) {
          // ignore parse errors
        }
      }
    } catch (e) {
      // ignore
    }
  }, [])

  return (
  <div className="border-t bg-popover/80 backdrop-blur-sm border-border">
      <div className="max-w-4xl mx-auto px-4 py-4">
        {/* Quick Actions - solo cuando no hay texto */}
        {!inputValue && (
          <div className="mb-3">
            <QuickActions
              onActionClick={handleQuickAction}
              disabled={isLoading}
              capabilityStates={capabilityStates}
              onToggleCapability={handleToggleCapability}
              ttsFemale={ttsFemale}
              onToggleTts={handleToggleTts}
            />
          </div>
        )}

        {/* Input Area */}
        <div className="flex gap-3 items-end">
          <div className="flex-1 relative">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={isLoading ? "Procesando..." : "Envía un mensaje..."}
              disabled={isLoading}
              className="w-full py-4 pr-14 pl-4 text-base border-2 border-border focus:border-primary focus:ring-0 rounded-2xl bg-card shadow-sm transition-all duration-200 placeholder:text-muted-foreground"
            />

            {/* Removed Sparkles hint per UX request */}

            {/* Send button placed inside the input on the right */}
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
              {/* Microphone button */}
              <Button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  if (!isSpeechSupported) return
                  if (isRecording) stopRecording()
                  else startRecording()
                }}
                disabled={isLoading || !isSpeechSupported}
                size="sm"
                aria-label={isRecording ? "Detener grabación" : "Iniciar grabación"}
                variant={isRecording ? undefined : undefined}
                className={`relative h-9 w-9 rounded-full p-0 flex items-center justify-center transition-all duration-200 disabled:bg-muted ${
                  isRecording
                    ? "bg-red-500/90 hover:bg-red-500"
                    : voiceMode
                      ? "bg-secondary/80 hover:bg-secondary/90 ring-2 ring-primary/40"
                      : "bg-secondary/80 hover:bg-secondary/90"
                }`}
                title={isSpeechSupported ? (isRecording ? "Detener" : voiceMode ? "Modo voz recordado — haz click para iniciar" : "Grabar voz") : "Reconocimiento de voz no soportado en este navegador"}
              >
                {isRecording ? (
                  <MicOff className="h-4 w-4 text-white" />
                ) : (
                  <>
                    <Mic className="h-4 w-4 text-primary-foreground" />
                    {/* Small persisted mode indicator dot when voiceMode is enabled but not actively recording */}
                    {voiceMode && !isRecording && (
                      <span className="absolute -right-0.5 -top-0.5 block h-2 w-2 rounded-full bg-primary-600 ring-1 ring-white" aria-hidden />
                    )}
                  </>
                )}
              </Button>
              {/* Voice mode badge */}
              <span className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium select-none ${
                voiceMode ? "bg-green-100 text-green-800" : "bg-muted/10 text-muted-foreground"
              }`}>
                Voz: {voiceMode ? "On" : "Off"}
              </span>

              <Button
                onMouseDown={(e) => e.preventDefault()} /* prevent button from stealing focus */
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isLoading}
                size="sm"
                aria-label="Enviar mensaje"
                className="h-9 w-9 rounded-full bg-primary hover:bg-primary/80 disabled:bg-muted disabled:cursor-not-allowed p-0 flex items-center justify-center transition-all duration-200"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary-foreground" />
                ) : (
                  <Send className="h-4 w-4 text-primary-foreground" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Footer info removed as requested */}
      </div>
    </div>
  )
}
