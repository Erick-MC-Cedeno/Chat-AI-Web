import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { Brain } from "lucide-react"
import { MobileSidebarToggle } from "./mobile-sidebar-toggle"
import { ConnectionStatus } from "./connection-status"
import type { Conversation } from "@/types/chat"

interface ChatHeaderProps {
  connectionError: string | null
  conversations: Conversation[]
  currentConversationId: string | null
  onNewConversation: () => void
  onSwitchConversation: (id: string) => void
  onDeleteConversation: (id: string) => void
  onUpdateTitle: (id: string, title: string) => void
}

export function ChatHeader({
  connectionError,
  conversations,
  currentConversationId,
  onNewConversation,
  onSwitchConversation,
  onDeleteConversation,
  onUpdateTitle,
}: ChatHeaderProps) {
  return (
    <Card className="mb-6 border-0 shadow-lg bg-white/80 backdrop-blur-sm">
      <CardHeader className="text-center">
        <div className="flex items-center justify-between mb-2">
          <MobileSidebarToggle
            conversations={conversations}
            currentConversationId={currentConversationId}
            onNewConversation={onNewConversation}
            onSwitchConversation={onSwitchConversation}
            onDeleteConversation={onDeleteConversation}
            onUpdateTitle={onUpdateTitle}
          />
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full">
              <Brain className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Chatbot Inteligente
            </CardTitle>
          </div>
          <div className="w-10" /> 
        </div>

        <p className="text-muted-foreground">Asistente con IA para programación, matemáticas y más</p>

        {/* Componente de estado de conexión mejorado */}
        <ConnectionStatus connectionError={connectionError} />
      </CardHeader>
    </Card>
  )
}
