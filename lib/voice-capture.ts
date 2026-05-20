"use client"

export interface VoiceCaptureOptions {
  lang?: string
  model?: string
  noiseGateThreshold?: number
  vadThreshold?: number
  vadHoldMs?: number
  minSpeechMs?: number
  maxPauseMs?: number
  onTranscript?: (text: string) => void
  onInterim?: (text: string) => void
  onStateChange?: (state: VoiceCaptureState) => void
  onError?: (error: string) => void
}

export type VoiceCaptureState = "idle" | "listening" | "speech" | "processing" | "error"

export class VoiceCapture {
  private options: VoiceCaptureOptions
  private stream: MediaStream | null = null
  private audioContext: AudioContext | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private analyser: AnalyserNode | null = null
  private mediaRecorder: MediaRecorder | null = null
  private animationId: number | null = null
  private state: VoiceCaptureState = "idle"
  private audioChunks: Blob[] = []
  private speechStartTime: number = 0
  private lastSpeechTime: number = 0
  private isSpeaking: boolean = false
  private silenceTimer: ReturnType<typeof setTimeout> | null = null
  private vadBuffer: Float32Array = new Float32Array(0)
  private readonly VAD_WINDOW_SIZE = 1024

  constructor(options: VoiceCaptureOptions = {}) {
    this.options = {
      noiseGateThreshold: 0.02,
      vadThreshold: 0.03,
      vadHoldMs: 600,
      minSpeechMs: 300,
      maxPauseMs: 1200,
      ...options,
    }
  }

  get currentState(): VoiceCaptureState {
    return this.state
  }

  private setState(s: VoiceCaptureState) {
    this.state = s
    this.options.onStateChange?.(s)
  }

  async start(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
        },
      })

      this.audioContext = new AudioContext({ sampleRate: 16000 })
      this.source = this.audioContext.createMediaStreamSource(this.stream)

      const highpass = this.audioContext.createBiquadFilter()
      highpass.type = "highpass"
      highpass.frequency.value = 80

      const gain = this.audioContext.createGain()
      gain.gain.value = 2.0

      this.analyser = this.audioContext.createAnalyser()
      this.analyser.fftSize = 2048
      this.analyser.smoothingTimeConstant = 0.2

      this.source.connect(highpass)
      highpass.connect(gain)
      gain.connect(this.analyser)

      this.audioChunks = []
      this.isSpeaking = false
      this.speechStartTime = 0
      this.lastSpeechTime = 0
      this.vadBuffer = new Float32Array(0)

      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      })

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.audioChunks.push(e.data)
      }

      this.mediaRecorder.start(100)
      this.setState("listening")
      this.startVAD()
    } catch (err: any) {
      this.setState("error")
      this.options.onError?.(err.message || "Microphone access denied")
      throw err
    }
  }

  private startVAD() {
    const bufferLength = this.analyser!.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    const tick = () => {
      this.analyser!.getByteTimeDomainData(dataArray)

      let sum = 0
      for (let i = 0; i < bufferLength; i++) {
        const val = (dataArray[i] - 128) / 128
        sum += val * val
      }
      const rms = Math.sqrt(sum / bufferLength)

      const isSpeech = rms > this.options.vadThreshold!

      if (isSpeech) {
        this.lastSpeechTime = Date.now()
        if (!this.isSpeaking) {
          this.speechStartTime = Date.now()
          this.isSpeaking = true
          this.setState("speech")
        }
        if (this.silenceTimer) {
          clearTimeout(this.silenceTimer)
          this.silenceTimer = null
        }
      } else if (this.isSpeaking) {
        const silenceDuration = Date.now() - this.lastSpeechTime
        if (silenceDuration > this.options.maxPauseMs!) {
          if (this.silenceTimer) clearTimeout(this.silenceTimer)
          this.finalizeSpeech()
        } else if (!this.silenceTimer && silenceDuration > this.options.vadHoldMs!) {
          this.silenceTimer = setTimeout(() => {
            if (Date.now() - this.lastSpeechTime >= this.options.maxPauseMs!) {
              this.finalizeSpeech()
            }
            this.silenceTimer = null
          }, this.options.maxPauseMs! - silenceDuration)
        }
      }

      this.animationId = requestAnimationFrame(tick)
    }

    this.animationId = requestAnimationFrame(tick)
  }

  private async finalizeSpeech() {
    if (!this.isSpeaking) return
    this.isSpeaking = false

    const speechDuration = Date.now() - this.speechStartTime
    if (speechDuration < this.options.minSpeechMs!) return

    this.setState("processing")
    await this.transcribeAudio()
    this.setState("listening")
  }

  private async transcribeAudio() {
    if (this.audioChunks.length === 0) return

    const audioBlob = new Blob(this.audioChunks, { type: "audio/webm" })
    this.audioChunks = []

    let audioFile: Blob
    let filename: string
    try {
      audioFile = await convertToWav(audioBlob)
      filename = "speech.wav"
    } catch {
      audioFile = audioBlob
      filename = "speech.webm"
    }

    const formData = new FormData()
    formData.append("audio", audioFile, filename)
    formData.append("lang", this.options.lang || "es")
    if (this.options.model) formData.append("model", this.options.model)

    try {
      const res = await fetch("/api/asr", {
        method: "POST",
        body: formData,
      })

      if (!res.ok) {
        const err = await res.text().catch(() => "ASR failed")
        console.warn("ASR error:", err)
        this.setState("error")
        this.options.onError?.(err)
        return
      }

      const data = await res.json()
      if (data?.text?.trim()) {
        this.options.onTranscript?.(data.text.trim())
      }
    } catch (err) {
      console.warn("ASR request failed:", err)
    }
  }

  stop(): string | null {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer)
      this.silenceTimer = null
    }
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop()
    }
    if (this.source) this.source.disconnect()
    if (this.audioContext) this.audioContext.close()
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop())
    }
    this.setState("idle")
    return null
  }

  destroy() {
    this.stop()
    this.options = {}
  }
}

async function convertToWav(blob: Blob): Promise<Blob> {
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
  const arrayBuffer = await blob.arrayBuffer()
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
  await ctx.close()

  const numChannels = audioBuffer.numberOfChannels
  const sampleRate = audioBuffer.sampleRate
  const length = audioBuffer.length
  const pcmData = new Float32Array(length * numChannels)

  for (let ch = 0; ch < numChannels; ch++) {
    const channelData = audioBuffer.getChannelData(ch)
    pcmData.set(channelData, ch * length)
  }

  const byteRate = sampleRate * numChannels * 2
  const blockAlign = numChannels * 2
  const dataSize = length * numChannels * 2
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }
  writeStr(0, "RIFF")
  view.setUint32(4, 36 + dataSize, true)
  writeStr(8, "WAVE")
  writeStr(12, "fmt ")
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true)
  writeStr(36, "data")
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (let i = 0; i < pcmData.length; i++) {
    const s = Math.max(-1, Math.min(1, pcmData[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    offset += 2
  }

  return new Blob([buffer], { type: "audio/wav" })
}

export function isVoiceCaptureSupported(): boolean {
  return !!(
    typeof window !== "undefined" &&
    navigator.mediaDevices?.getUserMedia &&
    (window.AudioContext || (window as any).webkitAudioContext) &&
    typeof MediaRecorder !== "undefined"
  )
}
