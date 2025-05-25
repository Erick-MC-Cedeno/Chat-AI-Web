import { type NextRequest, NextResponse } from "next/server"
import { ResponseGenerator } from "@/lib/utils/response-generator"

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json()

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Prompt is required and must be a string" }, { status: 400 })
    }

    // Aquí puedes integrar con tu modelo Python
    // Por ahora usamos el generador de respuestas local
    const response = await ResponseGenerator.generateResponse(prompt)

    return NextResponse.json({
      response,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error in model API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
