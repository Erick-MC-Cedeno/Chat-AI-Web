"use client"

import { useState } from "react"
import { ChatHeader } from "@/components/chat/chat-header"
import { MessagesArea } from "@/components/chat/messages-area"
import { ChatInput } from "@/components/chat/chat-input"
import { ErrorAlert } from "@/components/chat/error-alert"
import { ConversationSidebar } from "@/components/chat/conversation-sidebar"
import { useChat } from "@/hooks/use-chat"

export default function ChatbotUI() {
  const {
    conversations,
    currentConversation,
    currentConversationId,
    isLoading,
    connectionError,
    sendMessage,
    createNewConversation,
    switchConversation,
    deleteConversation,
    updateConversationTitle,
  } = useChat()

  // Start the sidebar collapsed so on refresh it stays closed unless the user opens it
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed)
  }

  return (
  <div className="h-screen bg-background text-foreground flex">
      {/* Sidebar - Hidden on mobile, shown on desktop */}
      <div className="hidden md:block">
        <ConversationSidebar
          conversations={conversations}
          currentConversationId={currentConversationId}
          onNewConversation={createNewConversation}
          onSwitchConversation={switchConversation}
          onDeleteConversation={deleteConversation}
          onUpdateTitle={updateConversationTitle}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={toggleSidebar}
        />
      </div>

      {/* Main Chat Area - Sin Card contenedora */}
      <div className="flex-1 flex flex-col h-screen">
        {/* Header */}
        <div className="flex-shrink-0">
          {" "}
          {/* Eliminado px-4 pt-4 para que el header ocupe todo el ancho */}
          <ChatHeader
            connectionError={connectionError}
            conversations={conversations}
            currentConversationId={currentConversationId}
            onNewConversation={createNewConversation}
            onSwitchConversation={switchConversation}
            onDeleteConversation={deleteConversation}
            onUpdateTitle={updateConversationTitle}
          />
          {connectionError && <ErrorAlert error={connectionError} />}
        </div>

        {/* Messages Area - Usa toda la altura disponible */}
        <div className="flex-1 min-h-0">
          <MessagesArea messages={currentConversation?.messages || []} />
        </div>

        {/* Input - Fijo en la parte inferior */}
        <div className="flex-shrink-0">
          <ChatInput onSendMessage={sendMessage} isLoading={isLoading} />
        </div>

        {/* Footer info removed as requested */}
      </div>
    </div>
  )
}
