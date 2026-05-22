"use client"

import { micState, type MicUser } from "./mic-state"

export interface VoiceCaptureOptions {
  lang?: string
  model?: string
  micUser?: MicUser
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

const SPEECH_BAND_LOW = 300
const SPEECH_BAND_HIGH = 3400
const NOISE_FLOOR_ALPHA = 0.04
const VAD_HYSTERESIS_DB = 3

export class VoiceCapture {
  private options: VoiceCaptureOptions
  private stream: MediaStream | null = null
  private audioContext: AudioContext | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private analyser: AnalyserNode | null = null
  private mediaRecorder: MediaRecorder | null = null
  private animationId: number | null = null
  private currentRms: number = 0
  private state: VoiceCaptureState = "idle"
  private audioChunks: Blob[] = []
  private speechStartTime: number = 0
  private lastSpeechTime: number = 0
  private isSpeaking: boolean = false
  private silenceTimer: ReturnType<typeof setTimeout> | null = null

  private noiseFloor = 0.02
  private rmsHistory: number[] = []
  private readonly RMS_HISTORY_SIZE = 60
  private adaptiveThreshold = 0.03

  private highpassFilter: BiquadFilterNode | null = null
  private lowpassFilter: BiquadFilterNode | null = null

  private micUser: MicUser = "chat"

  constructor(options: VoiceCaptureOptions = {}) {
    this.options = {
      noiseGateThreshold: 0.015,
      vadThreshold: 0.035,
      vadHoldMs: 500,
      minSpeechMs: 250,
      maxPauseMs: 1000,
      ...options,
    }
    this.micUser = options.micUser || "chat"
  }

  get currentState(): VoiceCaptureState {
    return this.state
  }

  getAudioLevel(): number {
    return Math.min(1, this.currentRms * 5)
  }

  getNoiseFloor(): number {
    return this.noiseFloor
  }

  getAdaptiveThreshold(): number {
    return this.adaptiveThreshold
  }

  private setState(s: VoiceCaptureState) {
    this.state = s
    this.options.onStateChange?.(s)
  }

  async start(): Promise<void> {
    if (micState.active && micState.active !== this.micUser) {
      throw new Error("Another microphone is already active")
    }
    if (!micState.acquire(this.micUser)) return

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

      this.highpassFilter = this.audioContext.createBiquadFilter()
      this.highpassFilter.type = "highpass"
      this.highpassFilter.frequency.value = 80
      this.highpassFilter.Q.value = 0.707

      this.lowpassFilter = this.audioContext.createBiquadFilter()
      this.lowpassFilter.type = "lowpass"
      this.lowpassFilter.frequency.value = 7600
      this.lowpassFilter.Q.value = 0.707

      const gain = this.audioContext.createGain()
      gain.gain.value = 1.5

      this.analyser = this.audioContext.createAnalyser()
      this.analyser.fftSize = 2048
      this.analyser.smoothingTimeConstant = 0.15
      this.analyser.minDecibels = -90
      this.analyser.maxDecibels = -10

      this.source.connect(this.highpassFilter)
      this.highpassFilter.connect(this.lowpassFilter)
      this.lowpassFilter.connect(gain)
      gain.connect(this.analyser)

      this.audioChunks = []
      this.isSpeaking = false
      this.speechStartTime = 0
      this.lastSpeechTime = 0
      this.noiseFloor = 0.02
      this.rmsHistory = []
      this.adaptiveThreshold = this.options.vadThreshold!

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
      micState.release(this.micUser)
      this.setState("error")
      this.options.onError?.(err.message || "Microphone access denied")
      throw err
    }
  }

  private startVAD() {
    const bufferLength = this.analyser!.frequencyBinCount
    const timeData = new Uint8Array(bufferLength)
    const freqData = new Uint8Array(bufferLength)
    const sampleRate = this.audioContext!.sampleRate
    const nyquist = sampleRate / 2
    const speechBinLow = Math.floor((SPEECH_BAND_LOW / nyquist) * (bufferLength - 1))
    const speechBinHigh = Math.ceil((SPEECH_BAND_HIGH / nyquist) * (bufferLength - 1))

    const CONSECUTIVE_SPEECH_FRAMES = 3
    const CONSECUTIVE_SILENCE_FRAMES = 6
    let speechFrameCount = 0
    let silenceFrameCount = 0

    const tick = () => {
      this.analyser!.getByteTimeDomainData(timeData)
      this.analyser!.getByteFrequencyData(freqData)

      let rmsSum = 0
      for (let i = 0; i < bufferLength; i++) {
        const val = (timeData[i] - 128) / 128
        rmsSum += val * val
      }
      const rms = Math.sqrt(rmsSum / bufferLength)

      let speechBandEnergy = 0
      let totalEnergy = 0
      for (let i = 0; i < bufferLength; i++) {
        const energy = (freqData[i] / 255) ** 2
        totalEnergy += energy
        if (i >= speechBinLow && i <= speechBinHigh) {
          speechBandEnergy += energy
        }
      }

      const speechRatio = totalEnergy > 0 ? speechBandEnergy / totalEnergy : 0

      this.updateNoiseFloor(rms)

      const rmsDb = 20 * Math.log10(Math.max(rms, 1e-6))
      const floorDb = 20 * Math.log10(Math.max(this.noiseFloor, 1e-6))
      const snrEstimate = rmsDb - floorDb

      this.currentRms = rms

      let isSpeech: boolean

      const gateThresholdDb = 20 * Math.log10(Math.max(this.options.noiseGateThreshold!, 1e-6))
      if (rmsDb < gateThresholdDb) {
        isSpeech = false
      } else if (speechRatio > 0.35 && snrEstimate > 6) {
        isSpeech = true
      } else {
        const hysteresisDb = this.isSpeaking ? -VAD_HYSTERESIS_DB : 0
        const thresholdDb = 20 * Math.log10(Math.max(this.adaptiveThreshold, 1e-6)) + hysteresisDb
        isSpeech = rmsDb > thresholdDb && speechRatio > 0.2
      }

      if (isSpeech) {
        speechFrameCount++
        silenceFrameCount = 0
        if (speechFrameCount >= CONSECUTIVE_SPEECH_FRAMES && !this.isSpeaking) {
          this.lastSpeechTime = Date.now()
          this.speechStartTime = Date.now()
          this.isSpeaking = true
          this.setState("speech")
          if (this.silenceTimer) {
            clearTimeout(this.silenceTimer)
            this.silenceTimer = null
          }
        }
        if (this.isSpeaking) {
          this.lastSpeechTime = Date.now()
          if (this.silenceTimer) {
            clearTimeout(this.silenceTimer)
            this.silenceTimer = null
          }
        }
      } else {
        speechFrameCount = 0
        silenceFrameCount++
        if (this.isSpeaking && silenceFrameCount >= CONSECUTIVE_SILENCE_FRAMES) {
          const silenceDuration = Date.now() - this.lastSpeechTime
          if (silenceDuration > this.options.maxPauseMs!) {
            if (this.silenceTimer) {
              clearTimeout(this.silenceTimer)
              this.silenceTimer = null
            }
            this.finalizeSpeech()
          } else if (!this.silenceTimer && silenceDuration > this.options.vadHoldMs!) {
            const remaining = this.options.maxPauseMs! - silenceDuration
            this.silenceTimer = setTimeout(() => {
              if (this.isSpeaking && Date.now() - this.lastSpeechTime >= this.options.maxPauseMs!) {
                this.finalizeSpeech()
              }
              this.silenceTimer = null
            }, remaining)
          }
        }
      }

      this.animationId = requestAnimationFrame(tick)
    }

    this.animationId = requestAnimationFrame(tick)
  }

  private updateNoiseFloor(rms: number) {
    this.rmsHistory.push(rms)
    if (this.rmsHistory.length > this.RMS_HISTORY_SIZE) {
      this.rmsHistory.shift()
    }

    if (!this.isSpeaking) {
      this.noiseFloor = this.noiseFloor * (1 - NOISE_FLOOR_ALPHA) + rms * NOISE_FLOOR_ALPHA
    }

    const sorted = [...this.rmsHistory].sort((a, b) => a - b)
    const p25 = sorted[Math.floor(sorted.length * 0.25)] || this.noiseFloor

    this.adaptiveThreshold = Math.max(
      p25 * 3.5,
      this.noiseFloor * 2.5,
      this.options.vadThreshold!
    )
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
    micState.release(this.micUser)
    this.setState("idle")
    return null
  }

  destroy() {
    this.stop()
    this.options = {} as VoiceCaptureOptions
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
    typeof navigator.mediaDevices?.getUserMedia === "function" &&
    (window.AudioContext || (window as any).webkitAudioContext) &&
    typeof MediaRecorder !== "undefined"
  )
}
