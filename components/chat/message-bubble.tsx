"use client"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Bot, User, AlertCircle, Copy, Check, FileCode, UserCircle } from "lucide-react"
import type { Message } from "@/types/chat"
import { useState } from "react"

interface MessageBubbleProps {
  message: Message
}

const escapeHtml = (unsafe: string) => {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

const KNOWN_LANGS = new Set([
  'python','javascript','typescript','js','ts','jsx','tsx','html','css','json','bash','sh','sql',
  'rust','go','java','c','cpp','c++','ruby','php','yaml','yml','xml','docker','makefile','text',
  'graphql','prisma','solidity','kotlin','swift','scala','perl','r','lua','haskell','elixir',
  'clojure','erlang','matlab','zig','nim','dart','ex','exs','tf','hcl','groovy','cmake'
])

const CodeBlock = ({ code }: { code: string }) => {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const lines = code.split('\n')
  const firstLine = (lines[0] || '').trim()
  const langMatch = firstLine.match(/^(\w+)$/)
  const lang = langMatch && KNOWN_LANGS.has(langMatch[1].toLowerCase()) ? langMatch[1].toLowerCase() : ''
  const displayCode = lang ? lines.slice(1).join('\n').trim() : code

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-border/50 bg-[#0d1117] shadow-sm">
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#161b22] border-b border-border/30">
        <div className="flex items-center gap-2">
          <FileCode className="h-3.5 w-3.5 text-blue-400" />
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            {lang || 'code'}
          </span>
        </div>
        <button
          onClick={copyToClipboard}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-400" />
              <span className="text-emerald-400 font-medium">Copiado</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span className="font-medium">Copiar</span>
            </>
          )}
        </button>
      </div>
      <div className="relative">
        <pre className="overflow-x-auto p-4 bg-[#0d1117]">
          <code className="text-sm font-mono text-[#e6edf3] leading-[1.65]">{displayCode}</code>
        </pre>
      </div>
    </div>
  )
}

const formatMessage = (content: string) => {
  const codeBlockRegex = /```([\s\S]*?)```/g
  const parts: { type: "text" | "code"; content: string }[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", content: content.slice(lastIndex, match.index) })
    }
    parts.push({ type: "code", content: match[1].trim() })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < content.length) {
    parts.push({ type: "text", content: content.slice(lastIndex) })
  }

  const isCodeLine = (line: string) => {
    if (/^\s*$/.test(line)) return false
    const trimmed = line.trim()

    // Sangría fuerte = código
    if (/^\s{4,}|^\t/.test(line)) return true

    // Línea comentada con # al inicio
    if (/^\s*#/.test(trimmed)) return true

    // Múltiples símbolos específicos de código (excluyendo paréntesis comunes en texto)
    const codeChars = (trimmed.match(/[{}[\];]/g) || []).length
    if (codeChars >= 2) return true

    // Flechas de función/ puntero
    if (/=>|->/.test(trimmed)) return true

    // Palabras clave de programación (inglés, raras en español)
    if (/\b(const|let|var|function|class|import|export|require|return|throw)\b/.test(trimmed)) return true

    // Asignación con identificador válido (ej: `foo = bar`)
    if (/^[a-zA-Z_$][a-zA-Z0-9_$]*\s*=\s*/.test(trimmed)) return true

    // Definición estilo Python
    if (/^\s*(def|class|if|elif|else|for|while|try|except|with|async|await)\b.*:\s*$/.test(trimmed)) return true

    return false
  }

  const hasFence = parts.some((p) => p.type === "code")
  if (!hasFence) {
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
          pushBuffer()
          bufferIsCode = true
        }
        buffer.push(line)
      } else {
        if (bufferIsCode) {
          if (buffer.length >= 2) {
            pushBuffer()
          } else {
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

    const foundCode = groups.some((g) => g.type === "code")
    if (foundCode) {
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

  const normalized: { type: "text" | "code"; content: string }[] = []
  for (const part of parts) {
    if (part.type === "code") {
      normalized.push(part)
      continue
    }
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
        <div className="relative flex-shrink-0">
          <Avatar className="h-8 w-8 bg-gradient-to-br from-blue-500 to-purple-600 ring-2 ring-background shadow-md">
            <AvatarFallback>
              <Bot className="h-4 w-4 text-white" />
            </AvatarFallback>
          </Avatar>
        </div>
      )}
      <div
        className={`${
          message.sender === "user" ? "max-w-[75%]" : "max-w-[85%] md:max-w-[75%]"
        }`}
      >
        <div
          className={`rounded-2xl px-4 py-3 ${
            message.sender === "user"
              ? "bg-gradient-to-br from-blue-500/90 to-purple-600/90 text-white shadow-md"
              : message.error
                ? "bg-red-500/10 text-foreground border border-red-500/20"
                : "bg-card border border-border/50 shadow-sm"
          }`}
        >
          <div className="text-[15px] leading-[1.7] -mt-[1px]">
            {message.isTyping ? (
              <p className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: escapeHtml(message.content).replace(/\n/g, "<br />") }} />
            ) : message.isTranslation ? (
              <p className="whitespace-pre-wrap leading-[1.75] text-[15px]" dangerouslySetInnerHTML={{ __html: escapeHtml(message.content).replace(/\n/g, "<br />") }} />
            ) : (
              formatMessage(message.content).map((part, index) => {
                if (message.sender === "user") {
                  return (
                    <p key={index} className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: escapeHtml(part.content).replace(/\n/g, "<br />") }} />
                  )
                }

                return part.type === "code" ? (
                  <CodeBlock key={index} code={part.content} />
                ) : (
                  <p key={index} className="mb-3 last:mb-0 leading-[1.75] whitespace-pre-wrap text-[15px]" dangerouslySetInnerHTML={{ __html: escapeHtml(part.content).replace(/\n/g, "<br />") }} />
                )
              })
            )}
          </div>
          <div className={`flex items-center gap-2 mt-2 ${message.sender === "user" ? "justify-end" : "justify-start"}`}>
            <p
              className={`text-[11px] ${
                message.sender === "user" ? "text-white/60" : message.error ? "text-red-400" : "text-muted-foreground/70"
              }`}
            >
              {message.timestamp.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        </div>
      </div>
      {message.sender === "user" && (
        <div className="relative flex-shrink-0">
          <Avatar className="h-8 w-8 bg-gradient-to-br from-emerald-500 to-blue-500 ring-2 ring-background shadow-md">
            <AvatarFallback>
              <UserCircle className="h-4 w-4 text-white" />
            </AvatarFallback>
          </Avatar>
        </div>
      )}
    </div>
  )
}
