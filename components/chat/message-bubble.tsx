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
  // 1) Detectar bloques de código fenceados (triple backticks)
  const codeBlockRegex = /```([\s\S]*?)```/g
  const parts: { type: "text" | "code"; content: string }[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = codeBlockRegex.exec(content)) !== null) {
    // Añadir texto antes del bloque de código
    if (match.index > lastIndex) {
      parts.push({ type: "text", content: content.slice(lastIndex, match.index) })
    }
    // Añadir el bloque de código fenceado
    parts.push({ type: "code", content: match[1].trim() })
    lastIndex = match.index + match[0].length
  }
  // Añadir el texto restante después del último bloque de código
  if (lastIndex < content.length) {
    parts.push({ type: "text", content: content.slice(lastIndex) })
  }

  // Heurística por línea para detectar bloques de código no fenceados sin transformar
  // texto explicativo en código. Requiere al menos 2 líneas consecutivas "code-like"
  // para considerar que son un bloque de código.
  const isCodeLine = (line: string) => {
    if (/^\s*$/.test(line)) return false
    const trimmed = line.trim()
    // indentación fuerte (bloques de código)
    if (/^\s{4,}|^\t/.test(line)) return true
    // comentarios de código (python-style)
    if (/^\s*#/.test(line)) return true
    // signos y patrones típicos de código (paréntesis, llaves, corchetes, punto y coma, arrows, asignación)
    if (/[(){}\[\];<>]|=>|=/.test(line)) return true
    // definiciones/keywords comunes — exigir palabra completa
    if (/\b(def|class|return|import|from|const|let|var|function|if|else|for|while|try|except|lambda)\b/.test(line)) return true
    // llamadas o expresiones con paréntesis (p. ej. func(a, b))
    if (/\w+\s*\([^)]{0,}\)/.test(line)) return true
    // en Python, una línea que termina con ':' y empieza con una keyword suele indicar un bloque
    if (/^\s*(def|class|if|for|while|try|except|with)\b.*:\s*$/.test(line)) return true
    return false
  }

  const hasFence = parts.some((p) => p.type === "code")
  if (!hasFence) {
    // Si no hay fences, intentar dividir el texto por líneas y localizar grupos de líneas 'code-like'
    const lines = content.split(/\r?\n/)
    const groups: { type: "text" | "code"; content: string }[] = []
    let buffer: string[] = []
    let bufferIsCode = false

    const pushBuffer = () => {
      if (buffer.length === 0) return
      const text = buffer.join("\n")
      groups.push({ type: bufferIsCode ? "code" : "text", content: bufferIsCode ? text.trim() : text })
      buffer = []
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const codey = isCodeLine(line)
      if (codey) {
        if (!bufferIsCode) {
          // cerrar buffer de texto
          pushBuffer()
          bufferIsCode = true
        }
        buffer.push(line)
      } else {
        if (bufferIsCode) {
          // ver si el buffer de código es suficientemente grande para considerarlo código
          if (buffer.length >= 2) {
            pushBuffer()
          } else {
            // buffer muy corto: tratarlo como texto (evitar que una línea suelta se marque como código)
            const recovered = buffer.join("\n")
            buffer = [recovered, line]
            bufferIsCode = false
            continue
          }
          bufferIsCode = false
        }
        buffer.push(line)
      }
    }
    pushBuffer()

    // Si los grupos detectados tienen código, devolverlos; si no, usar las partes originales
    const foundCode = groups.some((g) => g.type === "code")
    if (foundCode) {
      // compactar grupos adyacentes del mismo tipo
      const compact: { type: "text" | "code"; content: string }[] = []
      for (const g of groups) {
        const last = compact[compact.length - 1]
        if (last && last.type === g.type) {
          last.content = `${last.content}\n${g.content}`
        } else {
          compact.push({ ...g })
        }
      }
      return compact
    }
  }

  // Si llegamos aquí, usamos las partes detectadas por fences y las normalizamos fusión de códigos
  const normalized: { type: "text" | "code"; content: string }[] = []
  for (const part of parts) {
    if (part.type === "code") {
      normalized.push(part)
      continue
    }
    // si la parte de texto contiene un bloque de líneas que parecen código, intentar dividirla
    const lines = part.content.split(/\r?\n/)
    let acc: string[] = []
    let accIsCode = false
    for (const line of lines) {
      const codey = isCodeLine(line)
      if (codey) {
        if (!accIsCode) {
          if (acc.length) normalized.push({ type: "text", content: acc.join("\n") })
          acc = [line]
          accIsCode = true
        } else {
          acc.push(line)
        }
      } else {
        if (accIsCode) {
          if (acc.length >= 2) normalized.push({ type: "code", content: acc.join("\n").trim() })
          else normalized.push({ type: "text", content: acc.join("\n") })
          acc = [line]
          accIsCode = false
        } else {
          acc.push(line)
        }
      }
    }
    if (acc.length) normalized.push({ type: accIsCode ? "code" : "text", content: accIsCode ? acc.join("\n").trim() : acc.join("\n") })
  }

  // Fusionar código adyacente
  const merged: { type: "text" | "code"; content: string }[] = []
  for (const part of normalized) {
    const last = merged[merged.length - 1]
    if (part.type === "code" && last && last.type === "code") {
      last.content = `${last.content}\n${part.content}`
    } else {
      merged.push({ ...part })
    }
  }

  return merged.length > 0 ? merged : [{ type: "text", content }]
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
          {formatMessage(message.content).map((part, index) => {
            // Do not render user's own messages as code blocks — show them as plain text
            if (message.sender === "user") {
              return (
                <p key={index} dangerouslySetInnerHTML={{ __html: part.content.replace(/\n/g, "<br />") }} />
              )
            }

            return part.type === "code" ? (
              <CodeBlock key={index} code={part.content} />
            ) : (
              // Renderiza el texto, reemplazando saltos de línea con <br />
              <p key={index} dangerouslySetInnerHTML={{ __html: part.content.replace(/\n/g, "<br />") }} />
            )
          })}
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
