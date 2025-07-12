"use client"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Bot, User, AlertCircle, Copy, Check } from "lucide-react"
import type { Message } from "@/types/chat"
import { useState } from "react"

interface MessageBubbleProps {
  message: Message
}

const CodeBlock = ({ code }: { code: string }) => {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative mt-2 rounded-lg bg-gray-900 p-4">
      <button
        onClick={copyToClipboard}
        className="absolute right-2 top-2 rounded-lg p-2 text-gray-400 hover:bg-gray-700 hover:text-white"
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </button>
      <pre className="overflow-x-auto">
        <code className="text-sm text-white">{code}</code>
      </pre>
    </div>
  )
}

const formatMessage = (content: string) => {
  // Expresión regular para detectar bloques de código Markdown (triple backticks)
  const codeBlockRegex = /```([\s\S]*?)```/g
  const parts = []
  let lastIndex = 0
  let match

  while ((match = codeBlockRegex.exec(content)) !== null) {
    // Añadir texto antes del bloque de código
    if (match.index > lastIndex) {
      parts.push({
        type: "text",
        content: content.slice(lastIndex, match.index),
      })
    }
    // Añadir el bloque de código
    parts.push({
      type: "code",
      content: match[1].trim(), // El contenido del bloque de código
    })
    lastIndex = match.index + match[0].length
  }
  // Añadir el texto restante después del último bloque de código
  if (lastIndex < content.length) {
    parts.push({
      type: "text",
      content: content.slice(lastIndex),
    })
  }
  return parts.length > 0 ? parts : [{ type: "text", content }]
}

export function MessageBubble({ message }: MessageBubbleProps) {
  return (
    <div className={`flex gap-3 ${message.sender === "user" ? "justify-end" : "justify-start"}`}>
      {message.sender === "bot" && (
        <Avatar className={`h-8 w-8 ${message.error ? "bg-red-500" : "bg-gradient-to-r from-blue-500 to-purple-600"}`}>
          <AvatarFallback>
            {message.error ? <AlertCircle className="h-4 w-4 text-white" /> : <Bot className="h-4 w-4 text-white" />}
          </AvatarFallback>
        </Avatar>
      )}
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          message.sender === "user"
            ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white"
            : message.error
              ? "bg-red-100 text-red-900 border border-red-200"
              : "bg-gray-100 text-gray-900"
        }`}
      >
        <div className="text-sm leading-relaxed">
          {formatMessage(message.content).map((part, index) =>
            part.type === "code" ? (
              <CodeBlock key={index} code={part.content} />
            ) : (
              // Renderiza el texto, reemplazando saltos de línea con <br />
              <p key={index} dangerouslySetInnerHTML={{ __html: part.content.replace(/\n/g, "<br />") }} />
            ),
          )}
        </div>
        <p
          className={`text-xs mt-1 ${
            message.sender === "user" ? "text-blue-100" : message.error ? "text-red-600" : "text-gray-500"
          }`}
        >
          {message.timestamp.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
      {message.sender === "user" && (
        <Avatar className="h-8 w-8 bg-gradient-to-r from-green-500 to-blue-500">
          <AvatarFallback>
            <User className="h-4 w-4 text-white" />
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  )
}
