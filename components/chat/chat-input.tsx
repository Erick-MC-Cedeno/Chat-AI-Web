"use client"

import { useState, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Send, Loader2, Mic, MicOff, Volume2, VolumeX, Sparkles } from "lucide-react"

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
  const [isAiProcessing, setIsAiProcessing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<any>(null)
  const isRecordingRef = useRef(false)
  const lastFinalRef = useRef<{ text: string; time: number }>({ text: "", time: 0 })
  const committedTextRef = useRef("")
  const inputValueRef = useRef("")
  const autoSendTimerRef = useRef<NodeJS.Timeout | null>(null)
  const levelIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const aiPendingRef = useRef(false)

  const clearAutoSendTimer = () => {
    if (autoSendTimerRef.current) {
      clearTimeout(autoSendTimerRef.current)
      autoSendTimerRef.current = null
    }
  }

  const resetAutoSendTimer = () => {
    clearAutoSendTimer()
  }

  const handleSendMessage = () => {
    clearAutoSendTimer()
    if (!inputValue.trim() || isLoading || isAiProcessing) return
    onSendMessage(inputValue, { ttsFemale: ttsEnabled })
    setInputValue("")
    inputValueRef.current = ""
    committedTextRef.current = ""
    lastFinalRef.current = { text: "", time: 0 }
    if (isRecording) {
      const recognition = recognitionRef.current
      if (recognition) {
        recognition.onend = null
        recognition.onresult = null
        recognition.onerror = null
        try { recognition.abort() } catch { try { recognition.stop() } catch { /* ignore */ } }
        recognitionRef.current = null
      }
      isRecordingRef.current = false
      setIsRecording(false)
      stopLevelAnimation()
      stopMediaRecorder()
    }
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
      if (!isRecordingRef.current) return

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
          lastFinalRef.current = { text: cleaned, time: now }

          const prevTrimmed = prev.trim()
          if (prevTrimmed.endsWith(cleaned) || prevTrimmed.includes(cleaned)) {
            inputValueRef.current = prev
            return prev
          }

          if (cleaned.length >= prevTrimmed.length) {
            inputValueRef.current = cleaned
            committedTextRef.current = cleaned
            return cleaned
          }

          const sep = prevTrimmed ? " " : ""
          const newText = `${prevTrimmed}${sep}${cleaned}`
          inputValueRef.current = newText
          committedTextRef.current = newText
          return newText
        }

        if (interim) {
          const prevTrimmed = prev.trim()
          const interimTrimmed = interim.trim()
          if (interimTrimmed.length > prevTrimmed.length) {
            inputValueRef.current = interimTrimmed
            return interimTrimmed
          }
          inputValueRef.current = prev
          return prev
        }

        inputValueRef.current = prev
        return prev
      })

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
      if (isRecordingRef.current && recognitionRef.current) {
        try {
          initRecognition()
          if (recognitionRef.current) {
            recognitionRef.current.start()
          }
        } catch (e) {
          console.warn("Failed to restart recognition", e)
          isRecordingRef.current = false
          setIsRecording(false)
        }
      }
    }

    recognitionRef.current = recognition
  }

  const processWithAI = async (text: string) => {
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
          setInputValue(finalText)
          inputValueRef.current = finalText
        }
      }

      const audioChunks = audioChunksRef.current
      if (audioChunks.length > 0) {
        const audioBlob = new Blob(audioChunks, { type: "audio/webm" })
        const formData = new FormData()
        formData.append("file", audioBlob, "recording.webm")
        if (recordingLang) formData.append("language", recordingLang.split("-")[0])
        const transRes = await fetch("/api/transcribe", {
          method: "POST",
          body: formData,
        })
        if (transRes.ok) {
          const transData = await transRes.json()
          if (transData?.text && transData.text.trim()) {
            finalText = transData.text
            setInputValue(finalText)
            inputValueRef.current = finalText
          }
        }
      }
    } catch {
      // keep original text on any error
    } finally {
      setIsAiProcessing(false)
      aiPendingRef.current = false
    }
  }

  const startMediaRecorder = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4"
      const recorder = new MediaRecorder(stream, { mimeType })
      audioChunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }
      recorder.start()
      mediaRecorderRef.current = recorder
    } catch {
      // MediaRecorder optional — speech repair still works via text
    }
  }

  const stopMediaRecorder = async (): Promise<void> => {
    const recorder = mediaRecorderRef.current
    if (!recorder) return
    if (recorder.state !== "inactive") {
      await new Promise<void>((resolve) => {
        recorder.onstop = () => {
          recorder.stream.getTracks().forEach((t) => t.stop())
          resolve()
        }
        recorder.stop()
      })
    } else {
      recorder.stream.getTracks().forEach((t) => t.stop())
    }
    mediaRecorderRef.current = null
  }

  const startRecording = () => {
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
      startMediaRecorder()
      inputRef.current?.focus()
    } catch (e) {
      console.warn("Failed to start recognition", e)
      setIsRecording(false)
      isRecordingRef.current = false
      stopLevelAnimation()
    }
  }

  const stopRecording = async () => {
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
      try { recognition.abort() } catch { try { recognition.stop() } catch { /* ignore */ } }
      recognitionRef.current = null
    }
    await stopMediaRecorder()
    if (currentText.trim() || audioChunksRef.current.length > 0) {
      processWithAI(currentText)
    }
    inputRef.current?.focus()
  }

  const micButtonScale = isRecording ? 1 + audioLevel * 0.35 : 1

  return (
    <div className="border-t border-border/60 bg-background">
      <div className="max-w-4xl mx-auto px-4 pb-4 pt-2">
        <div className={`relative flex items-center rounded-2xl shadow-sm transition-all duration-300 overflow-hidden ${
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
              className="relative h-9 w-9 rounded-full flex items-center justify-center transition-transform duration-200 shrink-0"
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

            <div className={`flex items-end gap-[2px] h-5 w-6 ${isRecording ? '' : 'invisible'}`}>
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
                isAiProcessing ? "Mejorando con IA..." :
                isRecording ? (inputValue ? "" : "Escuchando...") :
                isLoading ? "Procesando..." :
                "Envía un mensaje..."
              }
              disabled={isLoading || isAiProcessing}
              className="flex-1 min-w-0 py-3 px-1 text-sm bg-transparent border-0 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/50 shadow-none"
            />
            {isRecording && (
              <span className={`absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 transition-opacity duration-200 ${inputValue ? 'opacity-0' : 'opacity-100'}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse [animation-delay:0.2s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse [animation-delay:0.4s]" />
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
                  ? "bg-red-500 hover:bg-red-600 disabled:opacity-40"
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
