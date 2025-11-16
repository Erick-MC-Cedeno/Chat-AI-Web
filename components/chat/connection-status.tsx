"use client"

import { useEffect, useState } from "react"

interface ConnectionStatusProps {
  connectionError: string | null
}

export function ConnectionStatus({ connectionError }: ConnectionStatusProps) {
  const [isChecking, setIsChecking] = useState(false)

  const checkConnection = async () => {
    setIsChecking(true)
    try {
      const res = await fetch("/api/model", {
        method: "GET",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
      })
      const status = res.ok ? await res.json() : { status: "disconnected" }
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
      <span className="ml-2 text-xl font-bold tracking-wide uppercase text-muted-foreground">
        Loredo Chatbot
      </span>
    </div>
  )
}
