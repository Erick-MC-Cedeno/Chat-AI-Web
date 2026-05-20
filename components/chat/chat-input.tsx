"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Send, Loader2, Mic, MicOff, Volume2, VolumeX, Sparkles } from "lucide-react"

interface ChatInputProps {
  onSendMessage: (message: string, options?: import("@/types/chat").SendMessageOptions) => void
  isLoading: boolean
  ttsEnabled?: boolean
  onToggleTts?: () => void
  recordingLang?: string
  selectedModel?: string
}

function isSpeechRecognitionSupported(): boolean {
  return typeof window !== "undefined" && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
}

export function ChatInput({ onSendMessage, isLoading, ttsEnabled = false, onToggleTts, recordingLang }: ChatInputProps) {
  const [inputValue, setInputValue] = useState("")
  const [isRecording, setIsRecording] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)
  const [isAiProcessing, setIsAiProcessing] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const recognitionRef = useRef<any>(null)
  const isRecordingRef = useRef(false)
  const lastFinalRef = useRef<{ text: string; time: number }>({ text: "", time: 0 })
  const committedTextRef = useRef("")
  const inputValueRef = useRef("")
  const autoSendTimerRef = useRef<NodeJS.Timeout | null>(null)
  const levelIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const aiPendingRef = useRef(false)

  useEffect(() => {
    setSpeechSupported(isSpeechRecognitionSupported())
  }, [])

  useEffect(() => {
    const el = inputRef.current
    if (el) {
      el.style.height = "auto"
      el.style.height = Math.min(el.scrollHeight, 200) + "px"
    }
  }, [inputValue])

  const clearAutoSendTimer = () => {
    if (autoSendTimerRef.current) {
      clearTimeout(autoSendTimerRef.current)
      autoSendTimerRef.current = null
    }
  }

  const handleSendMessage = useCallback(() => {
    clearAutoSendTimer()
    if (!inputValue.trim() || isLoading || isAiProcessing) return
    onSendMessage(inputValue, { ttsFemale: ttsEnabled })
    setInputValue("")
    inputValueRef.current = ""
    committedTextRef.current = ""
    lastFinalRef.current = { text: "", time: 0 }
    if (isRecording) {
      stopAllRecording()
    }
    inputRef.current?.focus()
  }, [inputValue, isLoading, isAiProcessing, onSendMessage, ttsEnabled, isRecording])

  const stopAllRecording = useCallback(() => {
    const recognition = recognitionRef.current
    if (recognition) {
      recognition.onend = null
      recognition.onresult = null
      recognition.onerror = null
      try { recognition.abort() } catch { try { recognition.stop() } catch {} }
      recognitionRef.current = null
    }
    isRecordingRef.current = false
    setIsRecording(false)
    stopLevelAnimation()
  }, [])

  // const processWithAI = useCallback(async (text: string) => {
  //   if (!text.trim() || aiPendingRef.current) return
  //   aiPendingRef.current = true
  //   setIsAiProcessing(true)
  //   let finalText = text
  //   try {
  //     const langCode = recordingLang ? recordingLang.split("-")[0] : undefined
  //     const res = await fetch("/api/repair-speech", {
  //       method: "POST",
  //       headers: { "Content-Type": "application/json" },
  //       body: JSON.stringify({ text, lang: langCode }),
  //     })
  //     if (res.ok) {
  //       const data = await res.json()
  //       if (data?.correctedText && data.correctedText.trim()) {
  //         finalText = data.correctedText
  //         setInputValue(finalText)
  //         inputValueRef.current = finalText
  //       }
  //     }
  //   } catch {
  //   } finally {
  //     setIsAiProcessing(false)
  //     aiPendingRef.current = false
  //   }
  // }, [recordingLang])

  const initRecognition = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setSpeechSupported(false)
      return
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null
        recognitionRef.current.onend = null
        recognitionRef.current.onerror = null
        recognitionRef.current.stop()
      } catch {}
      recognitionRef.current = null
    }

    const recognition = new SpeechRecognition()
    recognition.lang = recordingLang || (typeof navigator !== "undefined" ? navigator.language : "en-US")
    recognition.interimResults = true
    recognition.maxAlternatives = 1
    try { recognition.continuous = true } catch {}

    recognition.onresult = (event: any) => {
      if (!isRecordingRef.current) return

      let interim = ""
      let newFinal = ""
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const res = event.results[i]
        if (res.isFinal) {
          newFinal += res[0].transcript
        } else {
          interim += res[0].transcript
        }
      }

      setInputValue((prev) => {
        const committed = committedTextRef.current

        if (newFinal) {
          const cleaned = newFinal.trim()
          const now = Date.now()
          if (lastFinalRef.current.text === cleaned && now - lastFinalRef.current.time < 3000) return prev
          lastFinalRef.current = { text: cleaned, time: now }

          if (committed.includes(cleaned)) {
            inputValueRef.current = committed
            return committed
          }

          const sep = committed ? " " : ""
          const newText = `${committed}${sep}${cleaned}`
          committedTextRef.current = newText
          inputValueRef.current = newText
          return newText
        }

        if (interim) {
          const base = committed || ""
          const sep = base ? " " : ""
          const display = `${base}${sep}${interim.trim()}`
          inputValueRef.current = display
          return display
        }

        inputValueRef.current = prev
        return prev
      })
    }

    recognition.onerror = (e: any) => {
      console.warn("Speech recognition error:", e?.error || e?.message || "unknown")
      if (e?.error === "not-allowed" || e?.error === "service-not-allowed") {
        isRecordingRef.current = false
        setIsRecording(false)
        setSpeechSupported(false)
      }
    }

    recognition.onend = () => {
      if (!isRecordingRef.current) return
      setTimeout(() => {
        if (!isRecordingRef.current) return
        try {
          initRecognition()
          if (recognitionRef.current) {
            try { recognitionRef.current.start() } catch {}
          }
        } catch {
          isRecordingRef.current = false
          setIsRecording(false)
        }
      }, 100)
    }

    recognitionRef.current = recognition
  }, [recordingLang])

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

  const startRecording = useCallback(async () => {
    clearAutoSendTimer()
    committedTextRef.current = ""
    lastFinalRef.current = { text: "", time: 0 }
    setIsRecording(true)
    isRecordingRef.current = true
    startLevelAnimation()

    initRecognition()
    const recognition = recognitionRef.current
    if (!recognition) {
      setIsRecording(false)
      isRecordingRef.current = false
      stopLevelAnimation()
      return
    }
    try {
      recognition.start()
      inputRef.current?.focus()
    } catch {
      setIsRecording(false)
      isRecordingRef.current = false
      stopLevelAnimation()
    }
  }, [initRecognition, clearAutoSendTimer, startLevelAnimation])

  const stopRecording = useCallback(async () => {
    clearAutoSendTimer()
    stopLevelAnimation()
    const currentText = inputValueRef.current
    setIsRecording(false)
    isRecordingRef.current = false

    const recognition = recognitionRef.current
    if (recognition) {
      recognition.onend = null
      recognition.onresult = null
      recognition.onerror = null
      try { recognition.abort() } catch { try { recognition.stop() } catch {} }
      recognitionRef.current = null
    }
    // if (currentText.trim()) {
    //   processWithAI(currentText)
    // }
    inputRef.current?.focus()
  }, [clearAutoSendTimer])

  const micButtonScale = isRecording ? 1 + audioLevel * 0.35 : 1

  return (
    <div className="border-t border-border/60 bg-background">
      <div className="max-w-4xl mx-auto px-4 pb-4 pt-2">
        <div className={`relative flex items-center rounded-2xl shadow-sm transition-all duration-300 overflow-hidden ${
          isRecording
            ? "bg-violet-500/5 border border-violet-500/30"
            : "bg-muted/40 border border-border/40 focus-within:border-border/80"
        }`}>
          {isRecording && (
            <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-violet-500/5 to-transparent animate-pulse" />
            </div>
          )}

          <div className="flex items-center gap-1 ml-1.5">
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                if (!speechSupported) return
                if (isRecording) stopRecording()
                else startRecording()
              }}
              disabled={isLoading || !speechSupported}
              aria-label={isRecording ? "Detener grabación" : "Iniciar grabación"}
              className="relative h-9 w-9 rounded-full flex items-center justify-center transition-transform duration-200 shrink-0"
              style={{ transform: `scale(${micButtonScale})` }}
            >
              {isRecording ? (
                <>
                  <span className="absolute inset-0 rounded-full animate-ping bg-violet-500/20" />
                  <span className="absolute inset-0 rounded-full bg-violet-500/30" />
                  <MicOff className="h-4 w-4 text-white relative z-10" />
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-white rounded-full animate-pulse" />
                </>
              ) : (
                <span className="text-muted-foreground hover:text-foreground hover:bg-muted/60 h-8 w-8 rounded-full flex items-center justify-center">
                  <Mic className="h-4 w-4" />
                </span>
              )}
            </button>

            <div className={`flex items-end gap-[2px] h-5 w-6 ${isRecording ? '' : 'invisible'}`}>
                {[1, 2, 3, 4].map((i) => {
                  const barHeight = Math.max(4, audioLevel * 20 * (i % 2 === 0 ? 1.2 : 0.8) + 4)
                  const delay = i * 0.12
                  return (
                    <span
                      key={i}
                      className="w-[3px] rounded-full transition-all duration-100 bg-violet-400"
                      style={{
                        height: `${barHeight}px`,
                        animationDelay: `${delay}s`,
                      }}
                    />
                  )
                })}
              </div>
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
            <style>{`textarea.hide-scrollbar::-webkit-scrollbar { display: none }`}</style>
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value)
                const el = e.target
                el.style.height = "auto"
                el.style.height = Math.min(el.scrollHeight, 200) + "px"
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSendMessage()
                }
              }}
              placeholder={
                isAiProcessing ? "Completando con IA..." :
                isRecording ? (inputValue ? "" : "Escuchando...") :
                isLoading ? "Procesando..." :
                "Envía un mensaje..."
              }
              disabled={isLoading || isAiProcessing}
              rows={1}
              className="hide-scrollbar flex-1 min-w-0 w-full py-3 px-1 text-sm bg-transparent border-0 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/50 shadow-none resize-none outline-none"
              style={{ maxHeight: "200px", overflowY: "auto", scrollbarWidth: "none", msOverflowStyle: "none" } as React.CSSProperties}
            />
            {isRecording && (
              <span className={`absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 transition-opacity duration-200 ${inputValue ? 'opacity-0' : 'opacity-100'}`}>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse bg-violet-400" />
                <span className="w-1.5 h-1.5 rounded-full animate-pulse [animation-delay:0.2s] bg-violet-400" />
                <span className="w-1.5 h-1.5 rounded-full animate-pulse [animation-delay:0.4s] bg-violet-400" />
              </span>
            )}
          </div>

          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading || isAiProcessing}
            aria-label="Enviar mensaje"
            className={`mr-1.5 h-8 w-8 rounded-full flex items-center justify-center shadow-sm shrink-0 ${
              isAiProcessing
                ? "bg-amber-500 hover:bg-amber-600"
                : isRecording
                  ? "bg-violet-500 hover:bg-violet-600 disabled:opacity-40"
                  : "bg-primary hover:bg-primary/80 disabled:opacity-40"
            } disabled:cursor-not-allowed`}
          >
            {isAiProcessing ? (
              <Sparkles className="h-4 w-4 text-white animate-pulse" />
            ) : isLoading ? (
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
