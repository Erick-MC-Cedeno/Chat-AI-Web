import { NextRequest, NextResponse } from "next/server"

const NVIDIA_API_BASE = "https://integrate.api.nvidia.com/v1"

const STT_MODEL = process.env.STT_MODEL || "nvidia/canary-1b"

function getApiKey(): string | null {
  return process.env.NVIDIA_API_KEY || process.env.STT_API_KEY || null
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = getApiKey()
    if (!apiKey) {
      return NextResponse.json({ error: "STT API key not configured (set NVIDIA_API_KEY or STT_API_KEY)" }, { status: 500 })
    }

    const formData = await request.formData()
    const audioFile = formData.get("file") as File | null
    const language = (formData.get("language") as string) || undefined

    if (!audioFile) {
      return NextResponse.json({ error: "'file' (audio) is required" }, { status: 400 })
    }

    const audioBytes = await audioFile.arrayBuffer()
    const audioBlob = new Blob([audioBytes], { type: audioFile.type })

    const body = new FormData()
    body.append("file", audioBlob, audioFile.name || "audio.webm")
    body.append("model", STT_MODEL)
    body.append("response_format", "json")
    if (language) {
      body.append("language", language)
    }

    const response = await fetch(`${NVIDIA_API_BASE}/audio/transcriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body,
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => "")
      return NextResponse.json({ error: `STT API error: ${response.status} ${errorText}` }, { status: 502 })
    }

    const data = await response.json()
    const text = (data?.text || data?.transcription || "").trim()

    if (!text) {
      return NextResponse.json({ error: "Transcription returned empty result" }, { status: 502 })
    }

    return NextResponse.json({ text })
  } catch (err: any) {
    console.error("[transcribe] Error:", err)
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
  }
}
