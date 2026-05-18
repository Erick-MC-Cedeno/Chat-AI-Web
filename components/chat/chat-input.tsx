"use client"

import { useState, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Send, Loader2, Mic, MicOff, Volume2, VolumeX } from "lucide-react"

interface ChatInputProps {
  onSendMessage: (message: string, options?: { ttsFemale?: boolean }) => void
  isLoading: boolean
  ttsEnabled?: boolean
  onToggleTts?: () => void
}

export function ChatInput({ onSendMessage, isLoading, ttsEnabled = false, onToggleTts }: ChatInputProps) {
  const [inputValue, setInputValue] = useState("")
  const [isRecording, setIsRecording] = useState(false)
  const [isSpeechSupported, setIsSpeechSupported] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<any>(null)
  const isRecordingRef = useRef(false)
  const lastFinalRef = useRef<{ text: string; time: number }>({ text: "", time: 0 })

  const handleSendMessage = () => {
    if (!inputValue.trim() || isLoading) return
    onSendMessage(inputValue, { ttsFemale: ttsEnabled })
    setInputValue("")
    inputRef.current?.focus()
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
      inputRef.current?.focus()
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
  }

  return (
    <div className="border-t border-border/60 bg-background">
      <div className="max-w-4xl mx-auto px-4 pb-4 pt-2">
        <div className="relative flex items-center bg-muted/40 border border-border/40 focus-within:border-border/80 rounded-2xl shadow-sm transition-all duration-200">
              {/* Mic button - left side */}
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  if (!isSpeechSupported) return
                  if (isRecording) stopRecording()
                  else startRecording()
                }}
                disabled={isLoading || !isSpeechSupported}
                aria-label={isRecording ? "Detener grabación" : "Iniciar grabación"}
                className={`ml-1.5 h-8 w-8 rounded-full flex items-center justify-center transition-all shrink-0 ${
                  isRecording
                    ? "bg-red-500/90 text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                }`}
              >
                {isRecording ? (
                  <MicOff className="h-4 w-4" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </button>

              {/* TTS button - activate bot voice */}
              <button
                onClick={onToggleTts}
                disabled={isLoading}
                aria-label={ttsEnabled ? "Desactivar voz del bot" : "Activar voz del bot"}
                className={`ml-1 h-8 w-8 rounded-full flex items-center justify-center transition-all shrink-0 ${
                  ttsEnabled
                    ? "bg-blue-500/90 text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                }`}
              >
                {ttsEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </button>

              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleSendMessage()
                  }
                }}
                placeholder={isLoading ? "Procesando..." : "Envía un mensaje..."}
                disabled={isLoading}
                className="flex-1 min-w-0 py-3 px-2 text-sm bg-transparent border-0 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground shadow-none"
              />

              {/* Send button - right side */}
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isLoading}
                aria-label="Enviar mensaje"
                className="mr-1.5 h-8 w-8 rounded-full bg-primary hover:bg-primary/80 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all shadow-sm shrink-0"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 text-primary-foreground animate-spin" />
                ) : (
                  <Send className="h-4 w-4 text-primary-foreground" />
                )}
              </button>
            </div>
      </div>
    </div>
  )
}
