export interface Message {
  id: string
  content: string
  sender: "user" | "bot"
  timestamp: Date
  isTyping?: boolean
  error?: boolean
}

export interface Conversation {
  id: string
  title: string
  messages: Message[]
  createdAt: Date
  updatedAt: Date
}

export interface ApiResponse {
  response: string
  timestamp: string
}

export interface ApiError {
  error: string
}

export interface ChatState {
  conversations: Conversation[]
  currentConversationId: string | null
  isLoading: boolean
  connectionError: string | null
}
