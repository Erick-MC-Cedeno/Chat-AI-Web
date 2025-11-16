import { MobileSidebarToggle } from "./mobile-sidebar-toggle"
import { ConnectionStatus } from "./connection-status"
import type { Conversation } from "@/types/chat"

interface ChatHeaderProps {
  connectionError: string | null
  conversations: Conversation[]
  currentConversationId: string | null
  onNewConversation: (title?: string) => void
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
  <div className="flex items-center justify-between py-4 px-4 bg-popover/80 backdrop-blur-sm border-b border-border">
      {/* Mobile sidebar toggle */}
      <MobileSidebarToggle
        conversations={conversations}
        currentConversationId={currentConversationId}
        onNewConversation={onNewConversation}
        onSwitchConversation={onSwitchConversation}
        onDeleteConversation={onDeleteConversation}
        onUpdateTitle={onUpdateTitle}
      />

      {/* Connection status - Centrado o a la derecha si no hay título */}
      <div className="flex-1 flex justify-center md:justify-end">
        <ConnectionStatus connectionError={connectionError} />
      </div>
    </div>
  )
}
