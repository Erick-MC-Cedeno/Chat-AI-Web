import type { AgentType, Conversation, Message } from "@/types/chat"

export class ConversationStorage {
  private static readonly STORAGE_KEY = "chatbot_conversations"
  private static readonly CURRENT_CONVERSATION_KEY = "chatbot_current_conversation"

  static saveConversations(conversations: Conversation[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(conversations))
    } catch (error) {
      console.error("Error saving conversations:", error)
    }
  }

  static loadConversations(): Conversation[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      if (!stored) return []

      const conversations = JSON.parse(stored)
      return conversations.map((conv: any) => ({
        ...conv,
        createdAt: new Date(conv.createdAt),
        updatedAt: new Date(conv.updatedAt),
        messages: conv.messages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        })),
      }))
    } catch (error) {
      console.error("Error loading conversations:", error)
      return []
    }
  }

  static saveCurrentConversationId(id: string | null): void {
    try {
      if (id) {
        localStorage.setItem(this.CURRENT_CONVERSATION_KEY, id)
      } else {
        localStorage.removeItem(this.CURRENT_CONVERSATION_KEY)
      }
    } catch (error) {
      console.error("Error saving current conversation ID:", error)
    }
  }

  static loadCurrentConversationId(): string | null {
    try {
      return localStorage.getItem(this.CURRENT_CONVERSATION_KEY)
    } catch (error) {
      console.error("Error loading current conversation ID:", error)
      return null
    }
  }

  static generateConversationTitle(messages: Message[]): string {
    const firstUserMessage = messages.find((msg) => msg.sender === "user")
    if (firstUserMessage) {
      const title = firstUserMessage.content.slice(0, 30)
      return title.length < firstUserMessage.content.length ? `${title}...` : title
    }
    return `Conversación ${new Date().toLocaleDateString()}`
  }

  static createNewConversation(agentType: AgentType = "chat", title?: string, messages?: Message[]): Conversation {
    const welcomeMessages: Record<AgentType, string> = {
      chat: "¡Hola! Soy tu asistente inteligente. Puedo ayudarte con programación, matemáticas y responder tus preguntas. ¿En qué puedo ayudarte hoy?",
      interpreter: "¡Hola! Soy tu intérprete AI. Puedo traducir entre inglés y español en tiempo real. ¿Qué te gustaría traducir?",
    }

    const welcomeMessage: Message = {
      id: "welcome",
      content: welcomeMessages[agentType],
      sender: "bot",
      timestamp: new Date(),
      isTyping: true,
    }

    const initialMessages = messages && messages.length > 0 ? messages : [welcomeMessage]

    let convTitle = title
    if (!convTitle) {
      convTitle = this.generateConversationTitle(initialMessages)
    }

    return {
      id: Date.now().toString(),
      title: convTitle,
      messages: initialMessages,
      agentType,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  }
}
