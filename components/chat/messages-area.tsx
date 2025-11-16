"use client"

import { useRef, useEffect, useState, useCallback } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MessageBubble } from "./message-bubble"
import type { Message } from "@/types/chat"

interface MessagesAreaProps {
  messages: Message[]
}

export function MessagesArea({ messages }: MessagesAreaProps) {
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
      setDelayedMessages(messages.slice(0, -1))
      setTypingMessage(messages[messages.length - 1])
      setTypingText("")
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
    const typeChar = () => {
      if (!isMounted || !typingMessage) return
      setTypingText(typingMessage.content.slice(0, charIndex + 1))
      charIndex++

      if (charIndex < typingMessage.content.length) {
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
        <div className="space-y-6 py-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-96 text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-popover/80 to-card/80 rounded-full flex items-center justify-center mb-6">
                <div className="w-8 h-8 bg-gradient-to-br from-muted to-popover rounded-full" />
              </div>
              <h3 className="text-2xl font-semibold text-foreground mb-3">¿En qué puedo ayudarte hoy?</h3>
              <p className="text-muted-foreground max-w-md leading-relaxed">
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
            </>
          )}
        </div>
      </div>
    </ScrollArea>
  )
}
