export class ChatbotAPIService {
  // Configuración de la API Flask en GitHub Codespaces
  private static readonly FLASK_API_URL = "https://solid-spork-v9g6vrvgqr9fpp54-8000.app.github.dev"
  private static readonly CHAT_ENDPOINT = "/chat"

  static async sendMessage(prompt: string): Promise<string> {
    console.log("[ChatbotAPIService] Enviando mensaje:", prompt)

    try {
      const response = await fetch(`${this.FLASK_API_URL}${this.CHAT_ENDPOINT}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ message: prompt }),
      })

      console.log("[ChatbotAPIService] Código de respuesta HTTP:", response.status)

      if (!response.ok) {
        console.warn("[ChatbotAPIService] Respuesta no OK:", response.statusText)
        throw new Error(`Error HTTP: ${response.status} - ${response.statusText}`)
      }

      const data = await response.json()
      console.log("[ChatbotAPIService] Respuesta recibida:", data)

      if (data.response) {
        return data.response
      } else {
        console.error("[ChatbotAPIService] Formato inválido de respuesta:", data)
        throw new Error("Respuesta inválida del servidor Flask")
      }
    } catch (error) {
      if (error instanceof TypeError && error.message.includes("fetch")) {
        console.error("[ChatbotAPIService] Error de red o fetch:", error.message)
        throw new Error(
          "No se pudo conectar con el servidor Flask. Verifica que esté ejecutándose en GitHub Codespaces",
        )
      }

      console.error("[ChatbotAPIService] Error desconocido:", error)
      throw error instanceof Error
        ? error
        : new Error("Error desconocido al comunicarse con el servidor Flask")
    }
  }

  static async healthCheck(): Promise<boolean> {
    console.log("[ChatbotAPIService] Ejecutando healthCheck()")
    try {
      const response = await fetch(`${this.FLASK_API_URL}${this.CHAT_ENDPOINT}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ message: "test" }),
      })
      console.log("[ChatbotAPIService] Código de respuesta healthCheck:", response.status)
      return response.ok
    } catch (err) {
      console.error("[ChatbotAPIService] Error en healthCheck:", err)
      return false
    }
  }

  static async checkConnection(): Promise<{ connected: boolean; message: string }> {
    console.log("[ChatbotAPIService] Ejecutando checkConnection()")
    try {
      const response = await fetch(`${this.FLASK_API_URL}${this.CHAT_ENDPOINT}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ message: "ping" }),
      })

      if (response.ok) {
        const data = await response.json()
        const msg = `Conectado a GitHub Codespaces - Respuesta: ${data.response?.substring(0, 50)}...`
        console.log("[ChatbotAPIService] Conexión exitosa:", msg)
        return {
          connected: true,
          message: msg,
        }
      } else {
        const msg = `Error de conexión Flask: ${response.status} - ${response.statusText}`
        console.warn("[ChatbotAPIService] Conexión fallida:", msg)
        return {
          connected: false,
          message: msg,
        }
      }
    } catch (error) {
      console.error("[ChatbotAPIService] Error al verificar conexión:", error)
      return {
        connected: false,
        message: "No se pudo conectar con la API Flask en GitHub Codespaces",
      }
    }
  }
}
