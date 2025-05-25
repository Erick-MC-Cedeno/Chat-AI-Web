"use client"

import { useEffect, useState } from "react"
import { ChatbotAPIService } from "@/lib/services/chatbot-api"

interface ConnectionStatusProps {
  connectionError: string | null
}

export function ConnectionStatus({ connectionError }: ConnectionStatusProps) {
  const [isChecking, setIsChecking] = useState(false)
  const [lastCheck, setLastCheck] = useState<Date | null>(null)

  const checkConnection = async () => {
    setIsChecking(true)
    try {
      const status = await ChatbotAPIService.checkConnection()
      setLastCheck(new Date())
    } catch (error) {
      console.error("Error checking connection:", error)
    } finally {
      setIsChecking(false)
    }
  }

  useEffect(() => {
    
    checkConnection()

  
    const interval = setInterval(checkConnection, 30000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex items-center justify-center gap-2 mt-2">
      <div
        className={`w-2 h-2 rounded-full transition-colors ${
          connectionError ? "bg-red-500" : isChecking ? "bg-yellow-500" : "bg-green-500"
        }`}
      />
      <span className="text-xs text-muted-foreground">
        {connectionError
          ? "Desconectado de GitHub Codespaces"
          : isChecking
            ? "Verificando conexión..."
            : "Conectado a Flask API (GitHub Codespaces)"}
      </span>
      {lastCheck && (
        <span className="text-xs text-muted-foreground opacity-60">
          • Última verificación: {lastCheck.toLocaleTimeString()}
        </span>
      )}
    </div>
  )
}
