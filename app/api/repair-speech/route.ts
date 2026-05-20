import { NextRequest, NextResponse } from "next/server"

const NVIDIA_API_BASE = "https://integrate.api.nvidia.com/v1"

const MODEL_MAP: Record<string, string> = {
  "nvidia-llama": "meta/llama-3.1-8b-instruct",
  "nvidia-nemotron": "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
  "nvidia-kimi": "moonshotai/kimi-k2.6",
  "nvidia-gpt-oss": "openai/gpt-oss-20b",
  "nvidia-gpt-oss-120b": "openai/gpt-oss-120b",
  "nvidia-glm": "z-ai/glm-5.1",
  "nvidia-mistral": "mistralai/mistral-small-4-119b-2603",
}

const DEFAULT_MODEL = "meta/llama-3.1-8b-instruct"

const REPAIR_PROMPT = `You are a speech-to-text error correction AI. Your ONLY task is to fix errors introduced by automatic speech recognition (ASR).

RULES:
- The input is in {LANGUAGE}. Correct it in that language.
- Fix incomplete or cut-off words using context.
- Correct phonetically similar words (homophones like "their/there/they're", "hear/here", "write/right").
- For Spanish: fix common ASR errors (e.g. "haber" vs "a ver", "hecho" vs "echo", "haya" vs "halla", "tubo" vs "tuvo").
- For English: fix common ASR errors (e.g. "gonna" → "going to", "wanna" → "want to", "gimme" → "give me").
- Restore missing punctuation and capitalization.
- Fix run-together words (e.g. "gotcha" from "got you" — keep or split based on context).
- Remove artifacts like repeated words or partial syllables ("I I want" → "I want").
- DO NOT add new information or rephrase creatively.
- Preserve the original meaning, tone, and intent.
- If the text is already clean, return it unchanged.
- Output ONLY the corrected text — no explanations, no commentary.`

function getApiKey(): string | null {
  return process.env.NVIDIA_API_KEY || null
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = getApiKey()
    if (!apiKey) {
      return NextResponse.json({ error: "NVIDIA API key not configured" }, { status: 500 })
    }

    const body = await request.json().catch(() => ({}))
    const { text, model: modelKey, lang } = body

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "'text' (string) is required" }, { status: 400 })
    }

    const nvidiaModel = MODEL_MAP[modelKey] || DEFAULT_MODEL

    const languageName = lang === "es" ? "Spanish" : lang === "en" ? "English" : "the detected language"

    const response = await fetch(`${NVIDIA_API_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: nvidiaModel,
        messages: [
          { role: "system", content: REPAIR_PROMPT.replace("{LANGUAGE}", languageName) },
          { role: "user", content: text },
        ],
        temperature: 0.1,
        max_tokens: 4096,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => "")
      return NextResponse.json({ error: `NVIDIA API error: ${response.status} ${errorText}` }, { status: 502 })
    }

    const data = await response.json()
    const correctedText = data?.choices?.[0]?.message?.content?.trim() || text

    return NextResponse.json({ correctedText })
  } catch (err: any) {
    console.error("[repair-speech] Error:", err)
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
  }
}
