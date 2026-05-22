"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Send, Loader2, Mic, MicOff, Volume2, VolumeX, Sparkles } from "lucide-react"
import { micState } from "@/lib/mic-state"
import { VoiceCapture, isVoiceCaptureSupported } from "@/lib/voice-capture"

interface ChatInputProps {
  onSendMessage: (message: string, options?: import("@/types/chat").SendMessageOptions) => void
  isLoading: boolean
  ttsEnabled?: boolean
  onToggleTts?: () => void
  recordingLang?: string
  selectedModel?: string
  agentSpeaking?: boolean
}

function isSpeechRecognitionSupported(): boolean {
  return typeof window !== "undefined" && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
}

export function ChatInput({ onSendMessage, isLoading, ttsEnabled = false, onToggleTts, recordingLang, agentSpeaking = false }: ChatInputProps) {
  const [inputValue, setInputValue] = useState("")
  const [isRecording, setIsRecording] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)
  const [isAiProcessing, setIsAiProcessing] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const captureRef = useRef<VoiceCapture | null>(null)
  const recognitionRef = useRef<any>(null)
  const isRecordingRef = useRef(false)
  const lastFinalRef = useRef<{ text: string; time: number }>({ text: "", time: 0 })
  const committedTextRef = useRef("")
  const inputValueRef = useRef("")
  const autoSendTimerRef = useRef<NodeJS.Timeout | null>(null)
  const levelIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const aiPendingRef = useRef(false)
  const micStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const voiceCaptureSupported = useRef(false)

  useEffect(() => {
    voiceCaptureSupported.current = isVoiceCaptureSupported()
    setSpeechSupported(isSpeechRecognitionSupported() || voiceCaptureSupported.current)
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

  const startRealAudioAnalysis = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
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
  }, [])

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

  const pollVoiceCaptureLevel = useCallback(() => {
    if (levelIntervalRef.current) clearInterval(levelIntervalRef.current)
    levelIntervalRef.current = setInterval(() => {
      const capture = captureRef.current
      if (capture) {
        setAudioLevel(capture.getAudioLevel())
      }
    }, 60)
  }, [])

  useEffect(() => {
    return () => {
      micState.release("chat")
      stopAudioAnalysis()
      const capture = captureRef.current
      if (capture) {
        capture.destroy()
        captureRef.current = null
      }
      const recognition = recognitionRef.current
      if (recognition) {
        try { recognition.abort() } catch {}
        recognitionRef.current = null
      }
    }
  }, [stopAudioAnalysis])

  const stopAllRecording = useCallback(() => {
    const capture = captureRef.current
    if (capture) {
      capture.stop()
      captureRef.current = null
    }
    const recognition = recognitionRef.current
    if (recognition) {
      recognition.onend = null
      recognition.onresult = null
      recognition.onerror = null
      try { recognition.abort() } catch { try { recognition.stop() } catch {} }
      recognitionRef.current = null
    }
    micState.release("chat")
    isRecordingRef.current = false
    setIsRecording(false)
    stopAudioAnalysis()
  }, [stopAudioAnalysis])

  const processWithAI = useCallback(async (text: string) => {
    if (!text.trim() || aiPendingRef.current) return
    aiPendingRef.current = true
    setIsAiProcessing(true)
    let finalText = text
    try {
      const langCode = recordingLang ? recordingLang.split("-")[0] : undefined
      const res = await fetch("/api/repair-speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, lang: langCode }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data?.correctedText && data.correctedText.trim()) {
          finalText = data.correctedText
        }
      }
    } catch {
    } finally {
      setIsAiProcessing(false)
      aiPendingRef.current = false
    }
    return finalText
  }, [recordingLang])

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
    if (micState.active && micState.active !== "chat") return
    if (!micState.acquire("chat")) return
    clearAutoSendTimer()
    committedTextRef.current = ""
    lastFinalRef.current = { text: "", time: 0 }
    setIsRecording(true)
    isRecordingRef.current = true

    if (voiceCaptureSupported.current) {
      try {
        const capture = new VoiceCapture({
          lang: recordingLang ? recordingLang.split("-")[0] : "es",
          micUser: "chat",
          noiseGateThreshold: 0.012,
          vadThreshold: 0.03,
          vadHoldMs: 500,
          minSpeechMs: 300,
          maxPauseMs: 1200,
          onTranscript: async (text: string) => {
            const repaired = await processWithAI(text)
            setInputValue((prev) => {
              const sep = prev ? " " : ""
              const newVal = `${prev}${sep}${repaired || text}`
              inputValueRef.current = newVal
              committedTextRef.current = newVal
              return newVal
            })
            inputRef.current?.focus()
          },
          onError: (err) => {
            console.warn("VoiceCapture error:", err)
          },
          onStateChange: (state) => {
            if (state === "error") {
              setSpeechSupported(false)
            }
          },
        })
        captureRef.current = capture
        await capture.start()
        pollVoiceCaptureLevel()
        inputRef.current?.focus()
        return
      } catch (err) {
        console.warn("VoiceCapture failed, falling back to browser SpeechRecognition:", err)
        captureRef.current = null
      }
    }

    startRealAudioAnalysis()
    initRecognition()
    const recognition = recognitionRef.current
    if (!recognition) {
      micState.release("chat")
      setIsRecording(false)
      isRecordingRef.current = false
      stopAudioAnalysis()
      return
    }
    try {
      recognition.start()
      inputRef.current?.focus()
    } catch {
      micState.release("chat")
      setIsRecording(false)
      isRecordingRef.current = false
      stopAudioAnalysis()
    }
  }, [initRecognition, clearAutoSendTimer, startRealAudioAnalysis, agentSpeaking, recordingLang, processWithAI, pollVoiceCaptureLevel])

  const stopRecording = useCallback(async () => {
    clearAutoSendTimer()
    const capture = captureRef.current
    if (capture) {
      capture.stop()
      captureRef.current = null
    }
    stopAudioAnalysis()
    const currentText = inputValueRef.current
    micState.release("chat")
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
  }, [clearAutoSendTimer, stopAudioAnalysis])

  const micButtonScale = isRecording ? 1 + audioLevel * 0.35 : 1

  return (
    <div className="w-full">
      <div className="max-w-xl mx-auto border-t border-border/60 bg-background px-4 pb-4 pt-2">
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
              disabled={isLoading || !speechSupported || agentSpeaking}
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
                agentSpeaking ? "El agente está hablando..." :
                "Envía un mensaje..."
              }
              disabled={isLoading || isAiProcessing || agentSpeaking}
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
            disabled={!inputValue.trim() || isLoading || isAiProcessing || agentSpeaking}
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
