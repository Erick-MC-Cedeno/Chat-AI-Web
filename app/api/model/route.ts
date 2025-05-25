import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json()

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Prompt is required and must be a string" }, { status: 400 })
    }

    // Llamar directamente a la API Flask en GitHub Codespaces
    const flaskResponse = await fetch("https://solid-spork-v9g6vrvgqr9fpp54-8000.app.github.dev/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        message: prompt, // Flask espera "message"
      }),
    })

    if (!flaskResponse.ok) {
      throw new Error(`Flask API error: ${flaskResponse.status} - ${flaskResponse.statusText}`)
    }

    const flaskData = await flaskResponse.json()

    return NextResponse.json({
      response: flaskData.response,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error in model API:", error)

    // Proporcionar mensajes de error más específicos
    let errorMessage = "Internal server error"

    if (error instanceof Error) {
      if (error.message.includes("Flask API error")) {
        errorMessage = "Error en la API Flask. Verifica que esté ejecutándose correctamente en GitHub Codespaces."
      } else if (error.message.includes("fetch")) {
        errorMessage = "No se pudo conectar con la API Flask en GitHub Codespaces"
      } else {
        errorMessage = error.message
      }
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

// Endpoint adicional para verificar el estado de la conexión con Flask
export async function GET() {
  try {
    const flaskResponse = await fetch("https://solid-spork-v9g6vrvgqr9fpp54-8000.app.github.dev/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ message: "health check" }),
    })

    if (flaskResponse.ok) {
      const data = await flaskResponse.json()
      return NextResponse.json({
        status: "connected",
        message: "Flask API en GitHub Codespaces está funcionando correctamente",
        flaskResponse: data.response,
        timestamp: new Date().toISOString(),
      })
    } else {
      return NextResponse.json(
        {
          status: "error",
          message: `Flask API respondió con error: ${flaskResponse.status}`,
          timestamp: new Date().toISOString(),
        },
        { status: 500 },
      )
    }
  } catch (error) {
    return NextResponse.json(
      {
        status: "disconnected",
        message: "No se pudo conectar con Flask API en GitHub Codespaces",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
