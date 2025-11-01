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
    // keep focus in the input after sending so the user can continue typing
    inputRef.current?.focus()
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
              className="w-full py-4 pr-14 pl-4 text-base border-2 border-gray-300 focus:border-gray-400 focus:ring-0 rounded-2xl bg-white shadow-sm transition-all duration-200 placeholder:text-gray-500"
            />

            {/* Sparkles hint (when there's text) */}
            {!isLoading && inputValue.trim() && (
              <div className="absolute right-12 top-1/2 -translate-y-1/2">
                <Sparkles className="h-4 w-4 text-gray-400" />
              </div>
            )}

            {/* Send button placed inside the input on the right */}
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              <Button
                onMouseDown={(e) => e.preventDefault()} /* prevent button from stealing focus */
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isLoading}
                size="sm"
                aria-label="Enviar mensaje"
                className="h-9 w-9 rounded-full bg-black hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed p-0 flex items-center justify-center transition-all duration-200"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                ) : (
                  <Send className="h-4 w-4 text-white" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Footer info removed as requested */}
      </div>
    </div>
  )
}
