import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Bot, User, AlertCircle } from "lucide-react"
import type { Message } from "@/types/chat"

interface MessageBubbleProps {
  message: Message
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
        <p className="text-sm leading-relaxed">
          {message.content}
        </p>
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
