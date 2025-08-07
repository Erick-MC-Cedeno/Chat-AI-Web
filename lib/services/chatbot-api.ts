export class ChatbotAPIService {
  // Configuración de la API Flask en GitHub Codespaces
  // Considera usar una variable de entorno para FLASK_API_URL en un entorno de producción.
  private static readonly FLASK_API_URL = "http://localhost:8000"

  private static readonly CHAT_ENDPOINT = "/chat"

  /**
   * Envía un mensaje al chatbot y procesa la respuesta para formatear bloques de código.
   * @param prompt El mensaje a enviar al chatbot.
   * @returns La respuesta del chatbot con los bloques de código formateados en Markdown.
   */
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

      if (!data.response) {
        throw new Error("Respuesta inválida del servidor Flask")
      }

      let text = data.response.replace(/\r\n/g, "\n")

      // MEJORA CLAVE: Detectar el prefijo de código y capturar todo el contenido subsiguiente como código.
      // Esto es más robusto para casos donde el bot no indenta o pone todo en una línea.
      const codePrefixRegex = /(^|\n)(Código:|Ejemplo en Python:)\s*/
      const match = text.match(codePrefixRegex)

      if (match) {
        const prefixPart = match[0] // e.g., " Ejemplo en Python:"
        const textBeforePrefix = text.substring(0, match.index) // Texto antes del prefijo
        let codeContent = text.substring(match.index + prefixPart.length) // Todo lo que sigue al prefijo

        // Eliminar la palabra "python" si está incrustada en el código (ya que la añadiremos como lenguaje Markdown)
        codeContent = codeContent.replace(/\bpython\b/g, "").trim()

        // Reconstruir el mensaje: texto antes del prefijo + bloque de código Markdown
        text = `${textBeforePrefix.trimEnd()}\n\`\`\`python\n${codeContent}\n\`\`\`\n`
      } else {
        // Fallback a la detección basada en indentación si no se encuentra un prefijo explícito.
        // Esto es útil para bloques de código sin "Código:" o "Ejemplo en Python:"
        // pero que están consistentemente indentados.
        text = text.replace(/(^|\n)((?:(?: {4}|\t).*(\n|$))+)/g, (_match, prefix, codeBlock) => {
          const cleanedCode = codeBlock.replace(/^ {4}|\t/gm, "").trimEnd()
          return `${prefix}\n\`\`\`python\n${cleanedCode}\n\`\`\`\n`
        })
      }

      return text
    } catch (error) {
      if (error instanceof TypeError && error.message.includes("fetch")) {
        throw new Error(
          "No se pudo conectar con el servidor Flask. Verifica que esté ejecutándose en GitHub Codespaces",
        )
      }
      console.error("[ChatbotAPIService] Error desconocido:", error)
      throw error instanceof Error ? error : new Error("Error desconocido al comunicarse con el servidor Flask")
    }
  }

  /**
   * Realiza una comprobación de salud simple enviando un mensaje de prueba.
   * @returns `true` si la conexión es exitosa, `false` en caso contrario.
   */
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

  /**
   * Verifica la conexión con la API Flask y devuelve un estado detallado.
   * @returns Un objeto con el estado de la conexión (`connected`) y un mensaje (`message`).
   */
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
        return { connected: true, message: msg }
      } else {
        const msg = `Error de conexión Flask: ${response.status} - ${response.statusText}`
        console.warn("[ChatbotAPIService] Conexión fallida:", msg)
        return { connected: false, message: msg }
      }
    } catch (error) {
      console.error("[ChatbotAPIService] Error al verificar conexión:", error)
      return { connected: false, message: "No se pudo conectar con la API Flask en GitHub Codespaces" }
    }
  }
}
