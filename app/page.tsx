"use client"

import { useState, useCallback } from "react"
import { ChatHeader } from "@/components/chat/chat-header"
import { MessagesArea } from "@/components/chat/messages-area"
import { ChatInput } from "@/components/chat/chat-input"
import { ErrorAlert } from "@/components/chat/error-alert"
import { ConversationSidebar } from "@/components/chat/conversation-sidebar"
import { AgentSidebar } from "@/components/agents/agent-sidebar"
import { LanguageBar } from "@/components/interpreter/language-bar"
import { useChat } from "@/hooks/use-chat"
import type { AgentType, SendMessageOptions } from "@/types/chat"

export default function ChatbotUI() {
  const {
    conversations,
    currentConversation,
    currentConversationId,
    isLoading,
    connectionError,
    selectedModel,
    sendMessage,
    createNewConversation,
    switchConversation,
    deleteConversation,
    updateConversationTitle,
    setSelectedModel,
  } = useChat()

  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)
  const [ttsEnabled, setTtsEnabled] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<AgentType>("chat")
  const [sourceLang, setSourceLang] = useState("English")
  const [targetLang, setTargetLang] = useState("Spanish")

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed)
  }

  const swapLanguages = useCallback(() => {
    const temp = sourceLang
    setSourceLang(targetLang)
    setTargetLang(temp)
  }, [sourceLang, targetLang])

  const handleSendMessage = useCallback(
    (content: string, options?: SendMessageOptions) => {
      if (selectedAgent === "interpreter") {
        sendMessage(content, {
          ...options,
          translation: { source_language: sourceLang, target_language: targetLang },
        })
      } else {
        sendMessage(content, options)
      }
    },
    [selectedAgent, sourceLang, targetLang, sendMessage]
  )

  return (
    <div className="h-screen bg-background text-foreground flex">
      <AgentSidebar selectedAgent={selectedAgent} onSelectAgent={setSelectedAgent} />

      {selectedAgent === "chat" && (
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
      )}

      <div className="flex-1 flex flex-col h-screen min-w-0">
        <div className="flex-shrink-0">
          <ChatHeader
            connectionError={connectionError}
            conversations={conversations}
            currentConversationId={currentConversationId}
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
            onNewConversation={createNewConversation}
            onSwitchConversation={switchConversation}
            onDeleteConversation={deleteConversation}
            onUpdateTitle={updateConversationTitle}
          />
          {connectionError && <ErrorAlert error={connectionError} />}
        </div>

        {selectedAgent === "interpreter" && (
          <div className="flex-shrink-0">
            <LanguageBar
              sourceLang={sourceLang}
              targetLang={targetLang}
              onSourceChange={setSourceLang}
              onTargetChange={setTargetLang}
              onSwap={swapLanguages}
            />
          </div>
        )}

        <div className="flex-1 min-h-0">
          <MessagesArea messages={currentConversation?.messages || []} isLoading={isLoading} />
        </div>

        <div className="flex-shrink-0">
          <ChatInput
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            ttsEnabled={ttsEnabled}
            onToggleTts={() => setTtsEnabled((v) => !v)}
            recordingLang={selectedAgent === "interpreter" ? (sourceLang === "Spanish" ? "es-ES" : "en-US") : undefined}
          />
        </div>
      </div>
    </div>
  )
}
