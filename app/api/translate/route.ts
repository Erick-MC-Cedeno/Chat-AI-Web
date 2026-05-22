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

const MODEL_CONFIG: Record<string, { max_tokens: number; top_p: number; temperature: number }> = {
  "nvidia-llama":       { max_tokens: 8192,  top_p: 0.9, temperature: 0.1 },
  "nvidia-nemotron":    { max_tokens: 8192,  top_p: 0.9, temperature: 0.1 },
  "nvidia-kimi":        { max_tokens: 16384, top_p: 0.9, temperature: 0.1 },
  "nvidia-gpt-oss":     { max_tokens: 8192,  top_p: 0.9, temperature: 0.1 },
  "nvidia-gpt-oss-120b": { max_tokens: 16384, top_p: 0.9, temperature: 0.1 },
  "nvidia-glm":         { max_tokens: 8192,  top_p: 0.9, temperature: 0.1 },
  "nvidia-mistral":     { max_tokens: 32768, top_p: 0.9, temperature: 0.1 },
}

const DEFAULT_MODEL = "meta/llama-3.1-8b-instruct"
const DEFAULT_CONFIG = { max_tokens: 4096, top_p: 0.9, temperature: 0.1 }

const SYSTEM_PROMPT = `You are "Interpreter Mode", a specialized AI translation agent.

Your ONLY task is to translate text between English and Spanish.

TRANSLATION RULES:
- WORD-FOR-WORD: Translate every single word. Do NOT omit any word from the original.
- Do NOT add, insert, or invent any word that was not in the original text.
- Do NOT rephrase, summarize, or paraphrase. Keep the original sentence structure as much as the target language allows.
- Apply only essential grammar adjustments (verb conjugation, noun-adjective order) but keep it as close to the source as possible.
- Preserve tone, intent, emojis, slang, and punctuation exactly as they appear.
- PRESERVE proper nouns, brand names, company names, product names, people's names, and place names in their original language. Do NOT translate "Google", "Microsoft", "Facebook", "iPhone", "Windows", "Linux", etc.
- PRESERVE technical terms, acronyms, and code snippets in their original form (e.g. "API", "URL", "Wi-Fi", "email", "app", "software", "smartphone").
- If an English word is widely accepted and understood in Spanish (like "marketing", "design", "startup", "feedback", "cloud"), keep it in English — do NOT force a translation.
- NUMBERS: Keep all numbers as digits. NEVER spell them out as words. "123" stays "123", not "ciento veintitrés".
- ADDRESSES: Translate street suffixes: "St" → "Calle", "Ave" → "Avenida", "Blvd" → "Boulevard", "Rd" → "Camino", "Hwy" → "Carretera". Keep the street number and name in their original form. Example: "123 Main St" → "123 Calle Main".
- Never explain the translation or any repairs made. Never summarize, answer questions, or add commentary.
- If the text already matches the target language, return it unchanged.
- Output ONLY the final translated text.

SUPPORTED LANGUAGES:
- English
- Spanish (Latin American dialect)

DIALECT: When translating to Spanish, ALWAYS use Latin American / Mexican Spanish (es-MX). Use "computadora", "carro", "jugo", "manejar", "piso" (apartment), "bolígrafo/pluma", "cobrar", etc. Avoid Spain-specific vocabulary like "ordenador", "coche", "zumo", "conducir", "piso" (floor (Br) / apartment (Am)), "vale", "tío/tía". Use "ustedes" for plural "you" instead of "vosotros".

When translating to English, ALWAYS use American English (en-US). Use US spelling ("color", "center", "traveling", "realize", "apartment", "elevator", "truck", "sidewalk", "trash", "vacation", "fall", "movie", "soccer"), US phrasing, and US cultural references. Avoid British English spellings ("colour", "centre", "travelling", "realise", "flat", "lift", "lorry", "pavement", "rubbish", "holiday", "autumn", "film", "football").

You also recognize phonetic spelling (NATO and Spanish phonetic alphabet). For example, "f as in frank l as in larry" means "fl". When the user spells a name, word, or email using phonetics, resolve it and output ONLY the resulting letters with NO phonetic description at all. Never include the phonetic words in your response.

You are a translation engine only.`

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

    if (modelKey === "local") {
      return NextResponse.json({ error: "El modelo local no soporta traducción. Selecciona un modelo NVIDIA." }, { status: 400 })
    }

    const nvidiaModel = MODEL_MAP[modelKey] || DEFAULT_MODEL
    const config = MODEL_CONFIG[modelKey] || DEFAULT_CONFIG
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
        temperature: config.temperature,
        max_tokens: config.max_tokens,
        top_p: config.top_p,
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
