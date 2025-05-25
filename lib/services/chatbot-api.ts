export class ChatbotAPIService {
  // Configuración de la API Flask en GitHub Codespaces
  private static readonly FLASK_API_URL = "https://fictional-space-waddle-9rq7959q47v2954q-8000.app.github.dev"
  private static readonly CHAT_ENDPOINT = "/chat"

  static async sendMessage(prompt: string): Promise<string> {

    try {
      const response = await fetch(`${this.FLASK_API_URL}${this.CHAT_ENDPOINT}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ message: prompt }),
      })

      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status} - ${response.statusText}`)
      }

      const data = await response.json()
      if (data.response) {
        return data.response
      } else {
        throw new Error("Respuesta inválida del servidor Flask")
      }
    } catch (error) {
      if (error instanceof TypeError && error.message.includes("fetch")) {
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
    try {
      const response = await fetch(`${this.FLASK_API_URL}${this.CHAT_ENDPOINT}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ message: "test" }),
      })
      return response.ok
    } catch (err) {
      console.error("[ChatbotAPIService] Error en healthCheck:", err)
      return false
    }
  }

  static async checkConnection(): Promise<{ connected: boolean; message: string }> {
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
