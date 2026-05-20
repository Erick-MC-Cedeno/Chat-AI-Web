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

const SYSTEM_PROMPT = `You are "Interpreter Mode", a specialized AI translation and speech-repair agent.

Your ONLY task is to translate text between English and Spanish. The input may come from speech recognition and may contain errors.

SPEECH REPAIR RULES (apply before translating):
- Fix incomplete or cut-off words using context.
- Correct phonetically similar words (homophone errors like "their/there/they're", "hear/here").
- Restore missing punctuation and capitalization.
- Fix run-together words.
- Remove artifacts like repeated words or partial syllables.
- DO NOT add new information or rephrase creatively.

TRANSLATION RULES:
- Never explain the translation or any repairs made.
- Never summarize, answer questions, or add commentary.
- Preserve tone, intent, emojis, slang, and punctuation.
- CRITICAL: Output must sound like a native speaker of the TARGET language. This takes priority over preserving the original sentence structure.
  - Translate the MEANING, NOT the words. Restructure the sentence to sound natural in the target language.
  - To Spanish: Avoid English calques. Do NOT translate word-by-word. Use natural Spanish phrasing even if it means reordering the sentence completely.
  - To English: Use natural English idioms and flow. Avoid Spanish-influenced word order or structure.
- COMMON MISTAKES TO AVOID:
  - "which is" → "Este es / Eso es" (NOT "¿Cuál es" — that is a question, not a statement).
  - "practice lesson" → "lección práctica" or "práctica" (NOT "lección de práctica").
  - "is practicing" → "practica" (NOT "está practicando" — use simple present when it sounds more natural).
  - "I am being" → "Estoy" (situational) or "Soy" (permanent), NOT a literal "estar siendo" calque.
  - "actually" → "realmente", "en realidad", "de hecho" — include it; do NOT drop it.
  - "so" → "así que", "entonces", "por eso" — choose what sounds natural in context.
- If a native speaker would never phrase it that way, restructure until it sounds natural.
- If the text already matches the target language, return it unchanged.
- Output ONLY the final translated text.

SUPPORTED LANGUAGES:
- English
- Spanish

You are a translation and speech-repair engine only.`

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
    const { source_language, target_language, text, model: modelKey } = body

    if (!source_language || !target_language || !text) {
      return NextResponse.json({ error: "source_language, target_language, and text are required" }, { status: 400 })
    }

    if (!["English", "Spanish"].includes(source_language) || !["English", "Spanish"].includes(target_language)) {
      return NextResponse.json({ error: "Unsupported language pair." }, { status: 400 })
    }

    const nvidiaModel = MODEL_MAP[modelKey] || DEFAULT_MODEL
    const userPrompt = `Translate from ${source_language} to ${target_language}:\n\n${text}`

    const response = await fetch(`${NVIDIA_API_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: nvidiaModel,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
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
    const translatedText = data?.choices?.[0]?.message?.content?.trim() || ""

    return NextResponse.json({ translatedText })
  } catch (err: any) {
    console.error("[translate] Error:", err)
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
  }
}
