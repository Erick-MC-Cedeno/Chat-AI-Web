import { type NextRequest, NextResponse } from "next/server"

// Configuración: leer desde variables de entorno para facilitar despliegues
const FLASK_URL = process.env.FLASK_URL || "https://ideal-chainsaw-45gj7v7g6xphqwwx-4000.app.github.dev"
const FLASK_CHAT_PATH = process.env.FLASK_CHAT_PATH || "/chat"
const FLASK_TIMEOUT_MS = Number(process.env.FLASK_TIMEOUT_MS) || 10000

const NVIDIA_TIMEOUT_MS = 120000

type FlaskResponse = { response?: string; model?: string }

async function callFlask(payload: unknown, timeout = FLASK_TIMEOUT_MS): Promise<FlaskResponse> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)

  try {
    const res = await fetch(`${FLASK_URL}${FLASK_CHAT_PATH}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    if (!res.ok) {
      const text = await res.text().catch(() => "")
      throw new Error(`Flask API error: ${res.status} ${res.statusText} ${text}`)
    }

    const data = (await res.json()) as FlaskResponse
    return data
  } finally {
    clearTimeout(id)
  }
}

function makeErrorResponse(message: string, status = 500) {
  return NextResponse.json({ error: message, timestamp: new Date().toISOString() }, { status })
}

export async function POST(request: NextRequest) {
  try {
  const body = await request.json().catch(() => ({}))
  const prompt = typeof body.prompt === "string" ? body.prompt : body.message
  const model = typeof body.model === "string" ? body.model : ""
  // Extract optional flags forwarded from client
  const capabilities = body.capabilities
  const ttsFemale = body.ttsFemale
  const history = Array.isArray(body.history) ? body.history : []

    if (!prompt || typeof prompt !== "string") {
      return makeErrorResponse("'prompt' (string) is required", 400)
    }

    // Forward to Flask and normalize response
  // Forward optional metadata to the Flask model server so it can adapt behavior
  const flaskPayload: any = { message: prompt, history }
  if (model) flaskPayload.model = model
  if (capabilities) flaskPayload.capabilities = capabilities
  if (ttsFemale) flaskPayload.ttsFemale = true

  const isNvidia = typeof model === "string" && model.startsWith("nvidia-")
  const flaskData = await callFlask(flaskPayload, isNvidia ? NVIDIA_TIMEOUT_MS : FLASK_TIMEOUT_MS)

    if (!flaskData || typeof flaskData.response !== "string") {
      return makeErrorResponse("Invalid response from model server", 502)
    }

    return NextResponse.json({ response: flaskData.response, model: flaskData.model || "local", timestamp: new Date().toISOString() })
  } catch (err: any) {
    console.error("[app/api/model] POST error:", err)

    if (err.name === "AbortError") {
      return makeErrorResponse("Request to model timed out", 504)
    }

    if (err.message?.includes("Flask API error")) {
      return makeErrorResponse("Model server returned an error. Check model logs.", 502)
    }

    return makeErrorResponse("Internal server error")
  }
}

// Simple health check that delegates to the model server.
export async function GET() {
  try {
    const flaskData = await callFlask({ message: "health check" }, 5000)

    if (flaskData && typeof flaskData.response === "string") {
      return NextResponse.json({ status: "connected", message: "Model server reachable", flaskResponse: flaskData.response, timestamp: new Date().toISOString() })
    }

    return NextResponse.json({ status: "error", message: "Model server returned unexpected payload", timestamp: new Date().toISOString() }, { status: 502 })
  } catch (err: any) {
    console.error("[app/api/model] GET health error:", err)
    const message = err.name === "AbortError" ? "Model server timed out" : err.message || "Unknown error"
    return NextResponse.json({ status: "disconnected", message, timestamp: new Date().toISOString() }, { status: 500 })
  }
}
