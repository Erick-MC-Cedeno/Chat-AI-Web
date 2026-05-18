"use client"

import { useRef, useEffect, useState, useCallback } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MessageBubble } from "./message-bubble"
import { Bot } from "lucide-react"
import type { Message } from "@/types/chat"

interface MessagesAreaProps {
  messages: Message[]
  isLoading?: boolean
}

export function MessagesArea({ messages, isLoading = false }: MessagesAreaProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const [delayedMessages, setDelayedMessages] = useState<Message[]>([])
  const [typingMessage, setTypingMessage] = useState<Message | null>(null)
  const [typingText, setTypingText] = useState("")
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true)

  const scrollToBottom = useCallback(() => {
    if (!shouldAutoScroll) return
    const scrollArea = scrollAreaRef.current
    if (!scrollArea) return
    const viewport = scrollArea.querySelector("[data-radix-scroll-area-viewport]") as HTMLElement | null
    if (!viewport) return

    requestAnimationFrame(() => {
      viewport.style.scrollBehavior = "smooth"
      viewport.scrollTop = viewport.scrollHeight
    })
  }, [shouldAutoScroll])

  useEffect(() => {
    const scrollArea = scrollAreaRef.current
    if (!scrollArea) return
    const viewport = scrollArea.querySelector("[data-radix-scroll-area-viewport]") as HTMLElement | null
    if (!viewport) return

    const handleScroll = () => {
      const distanceFromBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight
      setShouldAutoScroll(distanceFromBottom < 120)
    }

    viewport.addEventListener("scroll", handleScroll)
    return () => viewport.removeEventListener("scroll", handleScroll)
  }, [])

  useEffect(() => {
    let isMounted = true
    const showMessages = async () => {
      if (messages.length === 0) {
        setDelayedMessages([])
        setTypingMessage(null)
        setTypingText("")
        return
      }
      const last = messages[messages.length - 1]
      // Only animate typing for the last message if it should be typing
      // (either explicitly flagged with isTyping or it's an empty bot placeholder).
      if (last && last.sender === "bot" && (last.isTyping === true || last.content === "")) {
        setDelayedMessages(messages.slice(0, -1))
        setTypingMessage(last)
        setTypingText("")
      } else {
        // No typing animation: show all messages immediately
        setDelayedMessages(messages)
        setTypingMessage(null)
        setTypingText("")
      }
    }

    showMessages()
    return () => {
      isMounted = false
    }
  }, [messages])

  useEffect(() => {
    if (!typingMessage) return
    let isMounted = true
    let charIndex = 0
    // Use Array.from to iterate by user-perceived characters (grapheme clusters)
    // so we don't split surrogate pairs or combined characters (emojis, accented glyphs).
    const chars = Array.from(typingMessage.content || "")

    const typeChar = () => {
      if (!isMounted) return
      setTypingText(chars.slice(0, charIndex + 1).join(""))
      charIndex++

      if (charIndex < chars.length) {
        // small delay to make the typing effect readable but still fast
        requestAnimationFrame(() => setTimeout(typeChar, 1))
      }
    }

    typeChar()

    return () => {
      isMounted = false
    }
  }, [typingMessage])

  useEffect(() => {
    scrollToBottom()
  }, [delayedMessages, typingText, scrollToBottom])

  return (
    <ScrollArea className="h-full w-full" ref={scrollAreaRef}>
      <div className="max-w-4xl mx-auto px-4">
        <div className="space-y-4 pt-8">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-600/20 border border-border/50 flex items-center justify-center mb-8 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                  <Bot className="h-5 w-5 text-white" />
                </div>
              </div>
              <h3 className="text-2xl font-semibold text-foreground mb-3">¿En qué puedo ayudarte hoy?</h3>
              <p className="text-muted-foreground max-w-md leading-relaxed text-[15px]">
                Puedes preguntarme sobre programación, matemáticas, escribir código, resolver problemas o cualquier tema
                que necesites.
              </p>
            </div>
          ) : (
            <>
              {delayedMessages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
              {typingMessage && (
                <MessageBubble key={typingMessage.id + "-typing"} message={{ ...typingMessage, content: typingText }} />
              )}
              {isLoading && !typingMessage && (
                <div className="flex items-center gap-3 pl-1">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 ring-2 ring-background shadow-md flex items-center justify-center">
                    <span className="flex items-center gap-[3px]">
                      <span className="w-[5px] h-[5px] rounded-full bg-white animate-bounce" style={{ animationDelay: "0ms", animationDuration: "1.2s" }} />
                      <span className="w-[5px] h-[5px] rounded-full bg-white animate-bounce" style={{ animationDelay: "200ms", animationDuration: "1.2s" }} />
                      <span className="w-[5px] h-[5px] rounded-full bg-white animate-bounce" style={{ animationDelay: "400ms", animationDuration: "1.2s" }} />
                    </span>
                  </div>
                  <span className="text-sm text-muted-foreground">Pensando</span>
                </div>
              )}
            </>
          )}
          <div className="h-24" />
        </div>
      </div>
    </ScrollArea>
  )
}
