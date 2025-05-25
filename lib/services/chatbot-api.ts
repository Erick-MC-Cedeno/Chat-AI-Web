import type { ApiResponse, ApiError } from "@/types/chat"

export class ChatbotAPIService {
  private static readonly API_ENDPOINT = "/api/model"

  static async sendMessage(prompt: string): Promise<string> {
    try {
      const response = await fetch(this.API_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
      })

      if (!response.ok) {
        const errorData: ApiError = await response.json()
        throw new Error(errorData.error || "Error en la respuesta del servidor")
      }

      const data: ApiResponse = await response.json()
      return data.response
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error("Error desconocido al comunicarse con el servidor")
    }
  }

  static async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(this.API_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: "test" }),
      })
      return response.ok
    } catch {
      return false
    }
  }
}
