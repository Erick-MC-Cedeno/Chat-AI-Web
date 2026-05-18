"use client"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Bot, User, AlertCircle, Copy, Check, FileCode } from "lucide-react"
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
    <div className="relative my-3 rounded-xl overflow-hidden border border-border/60 bg-[#0d1117] shadow-sm">
      <div className="flex items-center justify-between px-4 py-2 bg-[#161b22] border-b border-border/40">
        <div className="flex items-center gap-2">
          <FileCode className="h-3.5 w-3.5 text-blue-400" />
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            {lang || 'code'}
          </span>
        </div>
        <button
          onClick={copyToClipboard}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors"
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
      <pre className="overflow-x-auto p-4 bg-[#0d1117]">
        <code className="text-sm font-mono text-[#e6edf3] leading-[1.65]">{displayCode}</code>
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
    // patrones de código más confiables: punto y coma, llaves, corchetes, arrows, retorno o asignaciones con operadores típicos
    if (/[{}\[\];<>]|=>|->/.test(line)) return true
    // asignaciones o returns: require operator with identifier on left (e.g. x =, const x =, return )
    if (/\b(return|throw)\b/.test(line)) return true
    if (/\b(const|let|var|def|function|class)\b/.test(line)) return true
    if (/\w+\s*=\s*[^\s].+/.test(line)) return true
    // líneas que acaban en ':' tras una keyword (python) — típico de bloques
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
        <div className="relative">
          <Avatar className={`h-8 w-8 ${message.error ? "bg-red-500" : "bg-gradient-to-r from-blue-500 to-purple-600"} ${message.isTyping && !message.error ? "ring-2 ring-purple-400/60 ring-offset-2 ring-offset-background" : ""}`}>
            <AvatarFallback>
              {message.error ? (
                <AlertCircle className="h-4 w-4 text-destructive-foreground" />
              ) : message.isTyping ? (
                <span className="flex items-center gap-[3px]">
                  <span className="w-[6px] h-[6px] rounded-full bg-white animate-bounce" style={{ animationDelay: "0ms", animationDuration: "1s" }} />
                  <span className="w-[6px] h-[6px] rounded-full bg-white animate-bounce" style={{ animationDelay: "200ms", animationDuration: "1s" }} />
                  <span className="w-[6px] h-[6px] rounded-full bg-white animate-bounce" style={{ animationDelay: "400ms", animationDuration: "1s" }} />
                </span>
              ) : (
                <Bot className="h-4 w-4 text-primary-foreground" />
              )}
            </AvatarFallback>
          </Avatar>
          {message.isTyping && !message.error && (
            <span className="absolute -bottom-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
            </span>
          )}
        </div>
      )}
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          message.sender === "user"
            ? "bg-gradient-to-r from-blue-500 to-purple-600 text-primary-foreground"
            : message.error
              ? "bg-destructive/10 text-destructive-foreground border border-destructive/30"
              : "bg-card text-card-foreground"
        }`}
      >
        <div className="text-sm leading-relaxed">
          {message.isTyping ? (
            // Durante la animación de tipeo, mostrar el contenido incremental
            // como texto plano (sin formatear bloques de código) para asegurar
            // que TODO el texto se presente gradualmente hasta que isTyping=false.
            <p className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: escapeHtml(message.content).replace(/\n/g, "<br />") }} />
          ) : (
            formatMessage(message.content).map((part, index) => {
              // Do not render user's own messages as code blocks — show them as plain text
              if (message.sender === "user") {
                return (
                  <p key={index} dangerouslySetInnerHTML={{ __html: escapeHtml(part.content).replace(/\n/g, "<br />") }} />
                )
              }

              return part.type === "code" ? (
                <CodeBlock key={index} code={part.content} />
              ) : (
                <p key={index} className="mb-2 last:mb-0 leading-relaxed" dangerouslySetInnerHTML={{ __html: escapeHtml(part.content).replace(/\n/g, "<br />") }} />
              )
            })
          )}
        </div>
        <p
          className={`text-xs mt-1 ${
            message.sender === "user" ? "text-primary-foreground" : message.error ? "text-destructive-foreground" : "text-muted-foreground"
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
            <User className="h-4 w-4 text-primary-foreground" />
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  )
}
