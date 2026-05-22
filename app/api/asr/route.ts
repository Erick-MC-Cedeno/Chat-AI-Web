import { NextRequest, NextResponse } from "next/server"

const ASR_PROVIDER = (process.env.ASR_PROVIDER || "nvidia").toLowerCase()

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.NVIDIA_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "NVIDIA API key not configured" }, { status: 500 })
    }

    const formData = await request.formData()
    const audioFile = formData.get("audio") as File | Blob | null
    const lang = (formData.get("lang") as string) || "es"
    const model = (formData.get("model") as string) || process.env.NVIDIA_ASR_MODEL || "nvidia/canary-0.6b"

    if (!audioFile) {
      return NextResponse.json({ error: "'audio' file is required" }, { status: 400 })
    }

    if (ASR_PROVIDER === "nvidia") {
      const nvidiaUrl = process.env.NVIDIA_ASR_URL || "https://ai.api.nvidia.com/v1/audio/transcriptions"

      const nvidiaForm = new FormData()
      nvidiaForm.append("audio", audioFile, "audio.wav")
      nvidiaForm.append("model", model)
      nvidiaForm.append("language", lang)
      nvidiaForm.append("response_format", "json")

      const response = await fetch(nvidiaUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: nvidiaForm,
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => "")
        return NextResponse.json(
          { error: `NVIDIA ASR API error: ${response.status} ${errorText}` },
          { status: 502 }
        )
      }

      const data = await response.json()
      const text = data?.text || data?.results?.[0]?.transcript || ""

      return NextResponse.json({ text })
    }

    return NextResponse.json(
      { error: `Unsupported ASR_PROVIDER: ${ASR_PROVIDER}. Configure ASR_PROVIDER=nvidia` },
      { status: 501 }
    )
  } catch (err: any) {
    console.error("[ASR] Error:", err)
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
  }
}
