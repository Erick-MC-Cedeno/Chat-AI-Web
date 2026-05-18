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
  model?: string
  timestamp: string
}

export interface ApiError {
  error: string
}

export type ModelType = "local" | "nvidia-llama" | "nvidia-nemotron" | "nvidia-kimi" | "nvidia-gpt-oss" | "nvidia-gpt-oss-120b"

export const MODEL_OPTIONS: { value: ModelType; label: string; description: string }[] = [
  { value: "local", label: "Modelo Local", description: "Chatbot Keras entrenado" },
  { value: "nvidia-llama", label: "Llama 3.1 8B", description: "Meta — vía NVIDIA" },
  { value: "nvidia-nemotron", label: "Nemotron Mini 4B", description: "NVIDIA — vía NVIDIA" },
  { value: "nvidia-kimi", label: "Kimi K2.6", description: "Moonshot AI — vía NVIDIA" },
  { value: "nvidia-gpt-oss", label: "GPT-OSS 20B", description: "OpenAI — vía NVIDIA" },
  { value: "nvidia-gpt-oss-120b", label: "GPT-OSS 120B", description: "OpenAI — vía NVIDIA" },
]

export interface ChatState {
  conversations: Conversation[]
  currentConversationId: string | null
  isLoading: boolean
  connectionError: string | null
  selectedModel: ModelType
}
