"use client"

import { useState, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Send, Loader2, Mic, MicOff, Volume2, VolumeX } from "lucide-react"

interface ChatInputProps {
  onSendMessage: (message: string, options?: import("@/types/chat").SendMessageOptions) => void
  isLoading: boolean
  ttsEnabled?: boolean
  onToggleTts?: () => void
  recordingLang?: string
}

export function ChatInput({ onSendMessage, isLoading, ttsEnabled = false, onToggleTts, recordingLang }: ChatInputProps) {
  const [inputValue, setInputValue] = useState("")
  const [isRecording, setIsRecording] = useState(false)
  const [isSpeechSupported, setIsSpeechSupported] = useState(true)
  const [audioLevel, setAudioLevel] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<any>(null)
  const isRecordingRef = useRef(false)
  const lastFinalRef = useRef<{ text: string; time: number }>({ text: "", time: 0 })
  const inputValueRef = useRef("")
  const autoSendTimerRef = useRef<NodeJS.Timeout | null>(null)
  const levelIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const clearAutoSendTimer = () => {
    if (autoSendTimerRef.current) {
      clearTimeout(autoSendTimerRef.current)
      autoSendTimerRef.current = null
    }
  }

  const resetAutoSendTimer = () => {
    clearAutoSendTimer()
    autoSendTimerRef.current = setTimeout(() => {
      if (isRecordingRef.current && inputValueRef.current.trim()) {
        onSendMessage(inputValueRef.current, { ttsFemale: ttsEnabled })
        setInputValue("")
        inputValueRef.current = ""
      }
      autoSendTimerRef.current = null
    }, 1000)
  }

  const handleSendMessage = () => {
    clearAutoSendTimer()
    if (!inputValue.trim() || isLoading) return
    onSendMessage(inputValue, { ttsFemale: ttsEnabled })
    setInputValue("")
    inputValueRef.current = ""
    inputRef.current?.focus()
  }

  const startLevelAnimation = () => {
    if (levelIntervalRef.current) clearInterval(levelIntervalRef.current)
    levelIntervalRef.current = setInterval(() => {
      setAudioLevel(Math.random())
    }, 120)
  }

  const stopLevelAnimation = () => {
    if (levelIntervalRef.current) {
      clearInterval(levelIntervalRef.current)
      levelIntervalRef.current = null
    }
    setAudioLevel(0)
  }

  const initRecognition = () => {
    const win = typeof window !== "undefined" ? (window as any) : null
    const SpeechRecognition = win?.SpeechRecognition || win?.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setIsSpeechSupported(false)
      return
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null
        recognitionRef.current.onend = null
        recognitionRef.current.onerror = null
        recognitionRef.current.stop()
      } catch {
        /* ignore cleanup errors */
      }
      recognitionRef.current = null
    }

    const recognition = new SpeechRecognition()
    recognition.lang = recordingLang || (typeof navigator !== "undefined" ? navigator.language : "en-US")
    recognition.interimResults = true
    recognition.maxAlternatives = 1
    try {
      recognition.continuous = true
    } catch {
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

      setInputValue((prev) => {
        if (finalTranscript) {
          const cleaned = finalTranscript.trim()
          const now = Date.now()

          if (lastFinalRef.current.text === cleaned && now - lastFinalRef.current.time < 3000) {
            return prev
          }

          if (prev.trim().endsWith(cleaned)) {
            lastFinalRef.current = { text: cleaned, time: now }
            inputValueRef.current = prev
            return prev
          }

          const sep = prev && prev.trim() ? " " : ""
          const newText = `${prev}${sep}${cleaned}`
          lastFinalRef.current = { text: cleaned, time: now }
          inputValueRef.current = newText
          return newText
        }

        const next = interim || prev
        inputValueRef.current = next
        return next
      })

      if (finalTranscript.trim() || interim.trim()) {
        resetAutoSendTimer()
      }
    }

    recognition.onerror = (e: any) => {
      try {
        const errName = e?.error || (e?.message ? e.message : "unknown")
        console.warn("Speech recognition error:", errName)
      } catch {
        console.warn("Speech recognition error (unknown)")
      }

      if (e?.error === "not-allowed" || e?.error === "service-not-allowed") {
        isRecordingRef.current = false
        setIsRecording(false)
        setIsSpeechSupported(false)
      }
    }

    recognition.onend = () => {
      if (isRecordingRef.current) {
        try {
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
    clearAutoSendTimer()
    initRecognition()
    const recognition = recognitionRef.current
    if (!recognition) return
    try {
      recognition.start()
      setIsRecording(true)
      isRecordingRef.current = true
      startLevelAnimation()
      inputRef.current?.focus()
    } catch (e) {
      console.warn("Failed to start recognition", e)
      setIsRecording(false)
      isRecordingRef.current = false
      stopLevelAnimation()
    }
  }

  const stopRecording = () => {
    clearAutoSendTimer()
    stopLevelAnimation()
    const recognition = recognitionRef.current
    if (!recognition) return
    try {
      recognition.stop()
    } catch {
      /* ignore */
    }
    setIsRecording(false)
    isRecordingRef.current = false
    inputRef.current?.focus()
  }

  const micButtonScale = isRecording ? 1 + audioLevel * 0.35 : 1

  return (
    <div className="border-t border-border/60 bg-background">
      <div className="max-w-4xl mx-auto px-4 pb-4 pt-2">
        <div className={`relative flex items-center rounded-2xl shadow-sm transition-all duration-300 ${
          isRecording
            ? "bg-red-500/5 border border-red-500/30"
            : "bg-muted/40 border border-border/40 focus-within:border-border/80"
        }`}>
          {isRecording && (
            <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
              <div className="absolute inset-0 bg-gradient-to-r from-red-500/0 via-red-500/5 to-red-500/0 animate-pulse" />
            </div>
          )}

          <div className="flex items-center gap-1 ml-1.5">
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                if (!isSpeechSupported) return
                if (isRecording) stopRecording()
                else startRecording()
              }}
              disabled={isLoading || !isSpeechSupported}
              aria-label={isRecording ? "Detener grabación" : "Iniciar grabación"}
              className="relative h-9 w-9 rounded-full flex items-center justify-center transition-all shrink-0"
              style={{ transform: `scale(${micButtonScale})` }}
            >
              {isRecording ? (
                <>
                  <span className="absolute inset-0 rounded-full bg-red-500/20 animate-ping" />
                  <span className="absolute inset-0 rounded-full bg-red-500/30" />
                  <MicOff className="h-4 w-4 text-white relative z-10" />
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-white rounded-full animate-pulse" />
                </>
              ) : (
                <span className="text-muted-foreground hover:text-foreground hover:bg-muted/60 h-8 w-8 rounded-full flex items-center justify-center">
                  {!isSpeechSupported ? (
                    <MicOff className="h-4 w-4 text-red-400/60" />
                  ) : (
                    <Mic className="h-4 w-4" />
                  )}
                </span>
              )}
            </button>

            {isRecording && (
              <div className="flex items-end gap-[2px] h-5 w-6">
                {[1, 2, 3, 4].map((i) => {
                  const barHeight = Math.max(4, audioLevel * 20 * (i % 2 === 0 ? 1.2 : 0.8) + 4)
                  const delay = i * 0.12
                  return (
                    <span
                      key={i}
                      className="w-[3px] bg-red-400 rounded-full transition-all duration-100"
                      style={{
                        height: `${barHeight}px`,
                        animationDelay: `${delay}s`,
                      }}
                    />
                  )
                })}
              </div>
            )}
          </div>

          <button
            onClick={onToggleTts}
            disabled={isLoading}
            aria-label={ttsEnabled ? "Desactivar voz del bot" : "Activar voz del bot"}
            className={`ml-0.5 h-8 w-8 rounded-full flex items-center justify-center transition-all shrink-0 ${
              ttsEnabled
                ? "bg-blue-500/90 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
            }`}
          >
            {ttsEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>

          <div className="flex-1 relative">
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
              placeholder={
                isRecording ? (inputValue ? "" : "Escuchando...") :
                isLoading ? "Procesando..." :
                "Envía un mensaje..."
              }
              disabled={isLoading}
              className="flex-1 min-w-0 py-3 px-1 text-sm bg-transparent border-0 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/50 shadow-none"
            />
            {isRecording && !inputValue && (
              <span className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse [animation-delay:0.2s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse [animation-delay:0.4s]" />
              </span>
            )}
          </div>

          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading}
            aria-label="Enviar mensaje"
            className={`mr-1.5 h-8 w-8 rounded-full flex items-center justify-center transition-all shadow-sm shrink-0 ${
              isRecording
                ? "bg-red-500 hover:bg-red-600 disabled:opacity-40"
                : "bg-primary hover:bg-primary/80 disabled:opacity-40"
            } disabled:cursor-not-allowed`}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 text-primary-foreground animate-spin" />
            ) : (
              <Send className={`h-4 w-4 ${isRecording ? "text-white" : "text-primary-foreground"}`} />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
