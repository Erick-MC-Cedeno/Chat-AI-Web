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

const COMPLETE_PROMPT = `You are an AI assistant that detects incomplete text and continues it naturally. Do NOT correct or modify the user's existing text.

RULES:
- The input is in {LANGUAGE}. Work in that language.
- If the text appears COMPLETE (ends with . ! ? or forms a complete thought), return it EXACTLY AS-IS — do not change a single character.
- If the text appears INCOMPLETE (cut off mid-word, mid-sentence, trailing off, or missing ending punctuation), extend it with the most natural continuation.
- NEVER alter, correct, or rephrase the user's original words. Preserve spelling, grammar, and style exactly as written.
- Add ONLY the predicted continuation — do not rewrite or touch what is already there.
- Output ONLY the resulting text — no explanations, no commentary.`

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
          { role: "system", content: COMPLETE_PROMPT.replace("{LANGUAGE}", languageName) },
          { role: "user", content: text },
        ],
        temperature: 0.3,
        max_tokens: 4096,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => "")
      return NextResponse.json({ error: `NVIDIA API error: ${response.status} ${errorText}` }, { status: 502 })
    }

    const data = await response.json()
    const completedText = data?.choices?.[0]?.message?.content?.trim() || text

    return NextResponse.json({ correctedText: completedText })
  } catch (err: any) {
    console.error("[repair-speech] Error:", err)
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
  }
}
