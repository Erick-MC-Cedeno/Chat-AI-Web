"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
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

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex">
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

      {/* Main Chat Area */}
      <div className="flex-1 p-4 max-w-4xl mx-auto w-full">
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

        <Card className="h-[600px] flex flex-col border-0 shadow-xl bg-white/90 backdrop-blur-sm">
          <MessagesArea messages={currentConversation?.messages || []} />
          <ChatInput onSendMessage={sendMessage} isLoading={isLoading} />
        </Card>

        <div className="text-center mt-6 text-sm text-muted-foreground">
          <p>Chatbot desarrollado con Next.js, React y TensorFlow</p>
          <p className="text-xs mt-1">API: localhost/api/model</p>
        </div>
      </div>
    </div>
  )
}
