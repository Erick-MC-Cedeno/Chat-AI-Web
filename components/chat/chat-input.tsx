"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CardContent } from "@/components/ui/card"
import { Send, Loader2 } from "lucide-react"
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
    <CardContent className="p-4 border-t bg-gray-50/50">
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={isLoading ? "Procesando..." : "Escribe tu mensaje aquí..."}
          disabled={isLoading}
          className="flex-1 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
        />
        <Button
          onClick={handleSendMessage}
          disabled={!inputValue.trim() || isLoading}
          className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>

      <QuickActions onActionClick={handleQuickAction} disabled={isLoading} />
    </CardContent>
  )
}
