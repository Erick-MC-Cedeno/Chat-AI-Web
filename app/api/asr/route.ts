import { NextRequest, NextResponse } from "next/server"

const NVIDIA_ASR_URL = process.env.NVIDIA_ASR_URL || "https://ai.api.nvidia.com/v1/audio/transcriptions"
const NVIDIA_ASR_MODEL = process.env.NVIDIA_ASR_MODEL || "nvidia/canary-0.6b"

const LANG_MAP: Record<string, string> = {
  es: "es",
  en: "en",
  "en-US": "en",
  "es-ES": "es",
}

function isNvidiaModel(model: string): boolean {
  return model.startsWith("nvidia-")
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const audio = formData.get("audio") as File | null
    const lang = (formData.get("lang") as string) || "es"
    const model = (formData.get("model") as string) || "nvidia-llama"

    if (!audio) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 })
    }

    const audioBuffer = Buffer.from(await audio.arrayBuffer())

    if (isNvidiaModel(model)) {
      return await transcribeWithNvidia(audioBuffer, audio.type, lang)
    }

    return NextResponse.json({ error: "no-asr" }, { status: 400 })
  } catch (err: any) {
    console.error("[asr] Error:", err)
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
  }
}

async function transcribeWithNvidia(
  audioBuffer: Buffer,
  mimeType: string,
  lang: string
): Promise<NextResponse> {
  const apiKey = process.env.NVIDIA_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "NVIDIA_API_KEY not configured" }, { status: 500 })
  }

  const langCode = LANG_MAP[lang] || "es"

  const formData = new FormData()
  const blob = new Blob([audioBuffer], { type: mimeType || "audio/webm" })
  formData.append("audio_file", blob, "speech.webm")
  formData.append("model", NVIDIA_ASR_MODEL)
  formData.append("language", langCode)

  try {
    const res = await fetch(NVIDIA_ASR_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => "")
      return NextResponse.json(
        { error: `NVIDIA ASR error: ${res.status} ${errText}` },
        { status: 502 }
      )
    }

    const data = await res.json()
    const text = data?.text || data?.results?.[0]?.transcript || ""

    return NextResponse.json({ text: text.trim() })
  } catch (err: any) {
    return NextResponse.json({ error: `NVIDIA ASR failed: ${err.message}` }, { status: 502 })
  }
}
