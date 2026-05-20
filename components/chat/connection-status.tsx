"use client"

import { useEffect, useState } from "react"

interface ConnectionStatusProps {
  connectionError: string | null
}

type Status = "checking" | "connected" | "disconnected"

export function ConnectionStatus({ connectionError }: ConnectionStatusProps) {
  const [status, setStatus] = useState<Status>("checking")

  const checkConnection = async () => {
    setStatus("checking")
    try {
      const res = await fetch("/api/model", {
        method: "GET",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
      })
      setStatus(res.ok ? "connected" : "disconnected")
    } catch {
      setStatus("disconnected")
    }
  }

  useEffect(() => {
    if (connectionError) {
      setStatus("disconnected")
      return
    }
    checkConnection()
    const interval = setInterval(checkConnection, 30000)
    return () => clearInterval(interval)
  }, [connectionError])

  const dotColor =
    status === "connected" ? "bg-green-500" :
    status === "checking" ? "bg-yellow-500" :
    "bg-red-500"

  const label =
    status === "connected" ? "Conectado" :
    status === "checking" ? "Conectando..." :
    "Desconectado"

  return (
    <div className="flex items-center justify-center gap-2 mt-2">
      <div className={`w-2 h-2 rounded-full transition-colors ${dotColor}`} />
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
    </div>
  )
}
