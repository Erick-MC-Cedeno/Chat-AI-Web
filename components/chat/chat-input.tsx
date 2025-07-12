"use client"

import type React from "react"
import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Send, Loader2, Sparkles } from "lucide-react"
import { QuickActions } from "./quick-actions"

interface ChatInputProps {
  onSendMessage: (message: string) => void
  isLoading: boolean
}

export function ChatInput({ onSendMessage, isLoading }: ChatInputProps) {
  const [inputValue, setInputValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSendMessage = () => {
    if (!inputValue.trim() || isLoading) return
    onSendMessage(inputValue)
    setInputValue("")
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleQuickAction = (text: string) => {
    if (!isLoading) {
      setInputValue(text)
      inputRef.current?.focus()
    }
  }

  return (
    <div className="border-t bg-white/80 backdrop-blur-sm">
      <div className="max-w-4xl mx-auto px-4 py-4">
        {/* Quick Actions - solo cuando no hay texto */}
        {!inputValue && (
          <div className="mb-3">
            <QuickActions onActionClick={handleQuickAction} disabled={isLoading} />
          </div>
        )}

        {/* Input Area */}
        <div className="flex gap-3 items-end">
          <div className="flex-1 relative">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={isLoading ? "Procesando..." : "Envía un mensaje..."}
              disabled={isLoading}
              className="w-full py-4 px-4 text-base border-2 border-gray-300 focus:border-gray-400 focus:ring-0 rounded-2xl bg-white shadow-sm transition-all duration-200 placeholder:text-gray-500"
            />
            {!isLoading && inputValue.trim() && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <Sparkles className="h-4 w-4 text-gray-400" />
              </div>
            )}
          </div>

          <Button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading}
            size="lg"
            className="h-12 w-12 rounded-full bg-black hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all duration-200"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-white" />
            ) : (
              <Send className="h-5 w-5 text-white" />
            )}
          </Button>
        </div>

        {/* Footer info */}
        <div className="text-center mt-2">
          <p className="text-xs text-gray-500">
            {isLoading
              ? "Generando respuesta..."
              : "ChatGPT puede cometer errores. Verifica la información importante."}
          </p>
        </div>
      </div>
    </div>
  )
}
