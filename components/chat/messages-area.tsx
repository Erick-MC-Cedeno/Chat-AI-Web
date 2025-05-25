"use client"

import { useRef, useEffect } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MessageBubble } from "./message-bubble"
import type { Message } from "@/types/chat"

interface MessagesAreaProps {
  messages: Message[]
}

export function MessagesArea({ messages }: MessagesAreaProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  // Auto-scroll al final cuando hay nuevos mensajes
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
  }, [messages])

  return (
    <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
      <div className="space-y-4">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
      </div>
    </ScrollArea>
  )
}
