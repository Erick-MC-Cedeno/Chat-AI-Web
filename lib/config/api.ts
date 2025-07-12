// Configuración centralizada de la API
export const API_CONFIG = {
  // URL de la API Flask en GitHub Codespaces
  FLASK_URL: "https://humble-train-v9g6vrvgqv534j9-8000.app.github.dev",
  ENDPOINTS: {
    CHAT: "/chat",
  },
  // Configuración de timeouts
  TIMEOUT: 30000, // 30 segundos
  // Headers por defecto
  DEFAULT_HEADERS: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
} as const

// Función helper para construir URLs
export function buildApiUrl(endpoint: string): string {
  return `${API_CONFIG.FLASK_URL}${endpoint}`
}

// Función helper para crear opciones de fetch
export function createFetchOptions(body?: any): RequestInit {
  return {
    method: "POST",
    headers: API_CONFIG.DEFAULT_HEADERS,
    body: body ? JSON.stringify(body) : undefined,
  }
}
