export interface Message {
  id: string
  content: string
  sender: "user" | "bot"
  timestamp: Date
  isTyping?: boolean
  error?: boolean
  isTranslation?: boolean
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

export type ModelType = "local" | "nvidia-llama" | "nvidia-nemotron" | "nvidia-kimi" | "nvidia-gpt-oss" | "nvidia-gpt-oss-120b" | "nvidia-glm" | "nvidia-mistral"

export const MODEL_OPTIONS: { value: ModelType; label: string; description: string }[] = [
  { value: "local", label: "Modelo Local", description: "Chatbot Keras entrenado" },
  { value: "nvidia-llama", label: "Llama 3.1 8B", description: "Meta — vía NVIDIA" },
  { value: "nvidia-nemotron", label: "Nemotron 3 Nano Omni", description: "NVIDIA — vía NVIDIA" },
  { value: "nvidia-kimi", label: "Kimi K2.6", description: "Moonshot AI — vía NVIDIA" },
  { value: "nvidia-gpt-oss", label: "GPT-OSS 20B", description: "OpenAI — vía NVIDIA" },
  { value: "nvidia-gpt-oss-120b", label: "GPT-OSS 120B", description: "OpenAI — vía NVIDIA" },
  { value: "nvidia-glm", label: "GLM-5.1", description: "Z-ai — vía NVIDIA" },
  { value: "nvidia-mistral", label: "Mistral Small 4 119B", description: "Mistral AI — vía NVIDIA" },
]

export type AgentType = "chat" | "interpreter"

export interface Agent {
  id: AgentType
  name: string
  description: string
  icon: string
  gradient: string
}

export const AGENTS: Agent[] = [
  {
    id: "chat",
    name: "Chat Mode",
    description: "General AI Assistant",
    icon: "💬",
    gradient: "from-blue-500 to-purple-600",
  },
  {
    id: "interpreter",
    name: "Interpreter Mode",
    description: "AI Translation Specialist",
    icon: "🌐",
    gradient: "from-emerald-500 to-teal-600",
  },
]

export interface TranslationConfig {
  source_language: string
  target_language: string
}

export interface SendMessageOptions {
  ttsFemale?: boolean
  capabilities?: { [key: string]: boolean }
  translation?: TranslationConfig
}

export interface ChatState {
  conversations: Conversation[]
  currentConversationId: string | null
  isLoading: boolean
  connectionError: string | null
  selectedModel: ModelType
}
