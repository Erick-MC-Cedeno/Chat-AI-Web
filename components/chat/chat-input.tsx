"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Send, Loader2, Mic, MicOff, Volume2, VolumeX } from "lucide-react"
import { micState } from "@/lib/mic-state"
import type { MicUser } from "@/lib/mic-state"

interface ChatInputProps {
  onSendMessage: (message: string, options?: import("@/types/chat").SendMessageOptions) => void
  isLoading: boolean
  ttsEnabled?: boolean
  onToggleTts?: () => void
  recordingLang?: string
  selectedModel?: string
  agentSpeaking?: boolean
  agentType?: MicUser
}

function isSpeechRecognitionSupported(): boolean {
  return typeof window !== "undefined" && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
}

export function ChatInput({ onSendMessage, isLoading, ttsEnabled = false, onToggleTts, recordingLang, agentSpeaking = false, agentType = "chat" }: ChatInputProps) {
  const [inputValue, setInputValue] = useState("")
  const [isRecording, setIsRecording] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)
  const [speechSupported, setSpeechSupported] = useState(false)
  const [micDevices, setMicDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedMicId, setSelectedMicId] = useState<string>("")
  const micInitRef = useRef(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const recognitionRef = useRef<any>(null)
  const isRecordingRef = useRef(false)
  const lastFinalRef = useRef<{ text: string; time: number }>({ text: "", time: 0 })
  const committedTextRef = useRef("")
  const inputValueRef = useRef("")
  const autoSendTimerRef = useRef<NodeJS.Timeout | null>(null)
  const levelIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const warmupLangRef = useRef<string>("")

  const enumerateMics = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const audioInputs = devices.filter((d) => d.kind === "audioinput")
      setMicDevices(audioInputs)
      if (audioInputs.length > 0 && !micInitRef.current) {
        micInitRef.current = true
        setSelectedMicId(audioInputs[0].deviceId)
      }
    } catch {}
  }, [])

  useEffect(() => {
    enumerateMics()
    const handler = () => enumerateMics()
    navigator.mediaDevices?.addEventListener("devicechange", handler)
    return () => {
      navigator.mediaDevices?.removeEventListener("devicechange", handler)
    }
  }, [enumerateMics])

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

  const recordingLangRef = useRef(recordingLang)
  useEffect(() => { recordingLangRef.current = recordingLang }, [recordingLang])

  useEffect(() => {
    const lang = recordingLang
    if (!lang || !isSpeechRecognitionSupported()) return

    const warmUp = () => {
      if (warmupLangRef.current === lang) return
      warmupLangRef.current = lang
      try {
        const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        if (!SR) return
        const r = new SR()
        r.lang = lang
        r.interimResults = true
        r.continuous = true
        r.onstart = () => { try { r.abort() } catch {} }
        r.start()
      } catch {}
    }

    document.addEventListener("pointerdown", warmUp, { once: true })
    return () => document.removeEventListener("pointerdown", warmUp)
  }, [recordingLang])

  useEffect(() => {
    if (!isRecordingRef.current) return
    stopAllRecording()
    startRecording()
  }, [recordingLang])

  const clearAutoSendTimer = () => {
    if (autoSendTimerRef.current) {
      clearTimeout(autoSendTimerRef.current)
      autoSendTimerRef.current = null
    }
  }

  const handleSendMessage = useCallback(() => {
    clearAutoSendTimer()
    if (!inputValue.trim() || isLoading) return
    onSendMessage(inputValue, { ttsFemale: ttsEnabled })
    setInputValue("")
    inputValueRef.current = ""
    committedTextRef.current = ""
    lastFinalRef.current = { text: "", time: 0 }
    inputRef.current?.focus()
  }, [inputValue, isLoading, onSendMessage, ttsEnabled])

  const startRealAudioAnalysis = useCallback(async () => {
    try {
      const constraints: MediaStreamConstraints = { audio: true }
      if (selectedMicId) {
        constraints.audio = { deviceId: { exact: selectedMicId } }
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      micStreamRef.current = stream
      const audioContext = new AudioContext()
      audioContextRef.current = audioContext
      const source = audioContext.createMediaStreamSource(stream)
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.8
      analyserRef.current = analyser
      source.connect(analyser)

      const bufferLength = analyser.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)

      const tick = () => {
        if (!analyserRef.current) return
        analyserRef.current.getByteTimeDomainData(dataArray)
        let sum = 0
        for (let i = 0; i < bufferLength; i++) {
          const value = (dataArray[i] - 128) / 128
          sum += value * value
        }
        const rms = Math.sqrt(sum / bufferLength)
        setAudioLevel(Math.min(1, rms * 4))
        animFrameRef.current = requestAnimationFrame(tick)
      }

      animFrameRef.current = requestAnimationFrame(tick)
    } catch {
      startFakeAnimation()
    }
  }, [selectedMicId])

  const startFakeAnimation = () => {
    if (levelIntervalRef.current) clearInterval(levelIntervalRef.current)
    levelIntervalRef.current = setInterval(() => {
      setAudioLevel(Math.min(1, Math.pow(Math.random(), 0.7) * 1.2))
    }, 100)
  }

  const stopAudioAnalysis = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop())
      micStreamRef.current = null
    }
    if (levelIntervalRef.current) {
      clearInterval(levelIntervalRef.current)
      levelIntervalRef.current = null
    }
    setAudioLevel(0)
  }, [])

  useEffect(() => {
    return () => {
      micState.release(agentType)
      stopAudioAnalysis()
      const recognition = recognitionRef.current
      if (recognition) {
        try { recognition.abort() } catch {}
        recognitionRef.current = null
      }
    }
  }, [stopAudioAnalysis, agentType])

  const stopAllRecording = useCallback(() => {
    const recognition = recognitionRef.current
    if (recognition) {
      recognition.onend = null
      recognition.onresult = null
      recognition.onerror = null
      try { recognition.abort() } catch { try { recognition.stop() } catch {} }
      recognitionRef.current = null
    }
    micState.release(agentType)
    isRecordingRef.current = false
    setIsRecording(false)
    stopAudioAnalysis()
  }, [stopAudioAnalysis, agentType])

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

  const startRecording = useCallback(async () => {
    if (agentSpeaking) return
    if (micState.active && micState.active !== agentType) return
    if (!micState.acquire(agentType)) return
    clearAutoSendTimer()
    committedTextRef.current = ""
    lastFinalRef.current = { text: "", time: 0 }
    setIsRecording(true)
    isRecordingRef.current = true

    startRealAudioAnalysis()
    initRecognition()
    const recognition = recognitionRef.current
    if (!recognition) {
      micState.release(agentType)
      setIsRecording(false)
      isRecordingRef.current = false
      stopAudioAnalysis()
      return
    }
    try {
      recognition.start()
      inputRef.current?.focus()
    } catch {
      micState.release(agentType)
      setIsRecording(false)
      isRecordingRef.current = false
      stopAudioAnalysis()
    }
  }, [initRecognition, clearAutoSendTimer, startRealAudioAnalysis, agentSpeaking, agentType])

  const stopRecording = useCallback(async () => {
    clearAutoSendTimer()
    stopAudioAnalysis()
    micState.release(agentType)
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
    inputRef.current?.focus()
  }, [clearAutoSendTimer, stopAudioAnalysis, agentType])

  const micButtonScale = isRecording ? 1 + audioLevel * 0.35 : 1

  return (
    <div className="w-full">
      <div className="max-w-xl mx-auto border-t border-border/60 bg-background px-4 pb-4 pt-2">
        <div className={`relative flex items-center rounded-2xl shadow-sm transition-all duration-300 overflow-hidden ${
          isRecording
            ? "bg-violet-500/5 border border-violet-500/30 shadow-[0_0_15px_-3px_rgba(139,92,246,0.15)]"
            : "bg-muted/40 border border-border/40 focus-within:border-border/70 focus-within:shadow-[0_0_0_1px_rgba(255,255,255,0.03)]"
        }`}>
          {isRecording && (
            <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-violet-500/[0.06] to-transparent animate-pulse" />
              <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-violet-400/40 to-transparent" />
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
              disabled={isLoading || (!isRecording && (!speechSupported || agentSpeaking))}
              aria-label={isRecording ? "Detener grabación" : "Iniciar grabación"}
              className="relative h-9 w-9 rounded-full flex items-center justify-center transition-all duration-200 shrink-0 active:scale-90"
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
                <span className="text-muted-foreground hover:text-foreground hover:bg-muted/60 active:bg-muted/80 h-8 w-8 rounded-full flex items-center justify-center transition-all duration-150">
                  <Mic className="h-4 w-4" />
                </span>
              )}
            </button>

            <div className={`flex items-end gap-[2px] h-5 w-7 ${isRecording ? '' : 'invisible'}`}>
                {[0, 1, 2, 3, 4].map((i) => {
                  const barHeight = Math.max(3, audioLevel * 22 * (1 + Math.sin(i * 1.2) * 0.3) + 3)
                  const colors = [
                    'bg-violet-400/60',
                    'bg-violet-400/85',
                    'bg-purple-400',
                    'bg-violet-400/85',
                    'bg-violet-400/60'
                  ]
                  return (
                    <span
                      key={i}
                      className={`w-[3px] rounded-full transition-all duration-200 ease-out ${colors[i]}`}
                      style={{
                        height: `${barHeight}px`,
                        transitionDelay: `${i * 25}ms`,
                      }}
                    />
                  )
                })}
              </div>
          </div>

          <button
            onClick={onToggleTts}
            disabled={isLoading || agentSpeaking}
            aria-label={ttsEnabled ? "Desactivar voz del bot" : "Activar voz del bot"}
            className={`ml-0.5 h-8 w-8 rounded-full flex items-center justify-center transition-all duration-150 shrink-0 active:scale-90 ${
              ttsEnabled
                ? "bg-blue-500/90 text-white shadow-sm hover:bg-blue-500 hover:shadow-[0_0_10px_-2px_rgba(59,130,246,0.35)]"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60 active:bg-muted/80"
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
                isRecording ? (inputValue ? "" : "Escuchando...") :
                isLoading ? "Procesando..." :
                agentSpeaking ? "El agente está hablando..." :
                "Envía un mensaje..."
              }
              disabled={isLoading || agentSpeaking}
              rows={1}
              className="hide-scrollbar flex-1 min-w-0 w-full py-3 px-1 text-sm bg-transparent border-0 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/50 shadow-none resize-none outline-none transition-[height] duration-150 ease-out"
              style={{ maxHeight: "200px", overflowY: "auto", scrollbarWidth: "none", msOverflowStyle: "none" } as React.CSSProperties}
            />
            {isRecording && (
              <span className={`absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 transition-opacity duration-300 ${inputValue ? 'opacity-0' : 'opacity-100'}`}>
                <span className="w-1.5 h-1.5 rounded-full animate-bounce bg-violet-400 [animation-duration:1s]" />
                <span className="w-1.5 h-1.5 rounded-full animate-bounce bg-violet-400 [animation-delay:0.15s] [animation-duration:1s]" />
                <span className="w-1.5 h-1.5 rounded-full animate-bounce bg-violet-400 [animation-delay:0.3s] [animation-duration:1s]" />
              </span>
            )}
          </div>

          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading || agentSpeaking}
            aria-label="Enviar mensaje"
            className={`mr-1.5 h-8 w-8 rounded-full flex items-center justify-center shadow-sm shrink-0 transition-all duration-150 active:scale-90 ${
              isRecording
                ? "bg-violet-500 hover:bg-violet-600 hover:shadow-[0_0_12px_-2px_rgba(139,92,246,0.4)] disabled:opacity-40 disabled:hover:shadow-none disabled:active:scale-100"
                : "bg-primary hover:bg-primary/80 hover:shadow-[0_0_12px_-2px_rgba(59,130,246,0.3)] disabled:opacity-40 disabled:hover:shadow-none disabled:active:scale-100"
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
