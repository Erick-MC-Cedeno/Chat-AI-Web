"use client"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Menu } from "lucide-react"
import { ConversationSidebar } from "./conversation-sidebar"
import type { Conversation, AgentType } from "@/types/chat"

interface MobileSidebarToggleProps {
  conversations: Conversation[]
  currentConversationId: string | null
  selectedAgent?: AgentType
  onSelectAgent?: (agent: AgentType) => void
  onNewConversation: (title?: string) => void
  onSwitchConversation: (id: string) => void
  onDeleteConversation: (id: string) => void
  onUpdateTitle: (id: string, title: string) => void
}

export function MobileSidebarToggle({
  conversations,
  currentConversationId,
  selectedAgent,
  onSelectAgent,
  onNewConversation,
  onSwitchConversation,
  onDeleteConversation,
  onUpdateTitle,
}: MobileSidebarToggleProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="p-0 w-80">
        <ConversationSidebar
          conversations={conversations}
          currentConversationId={currentConversationId}
          selectedAgent={selectedAgent}
          onSelectAgent={onSelectAgent}
          onNewConversation={onNewConversation}
          onSwitchConversation={onSwitchConversation}
          onDeleteConversation={onDeleteConversation}
          onUpdateTitle={onUpdateTitle}
          isCollapsed={false}
          onToggleCollapse={() => {}}
        />
      </SheetContent>
    </Sheet>
  )
}
