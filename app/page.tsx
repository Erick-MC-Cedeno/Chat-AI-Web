"use client"

import { useState, useCallback, useMemo, useEffect } from "react"
import { ChatHeader } from "@/components/chat/chat-header"
import { MessagesArea } from "@/components/chat/messages-area"
import { ChatInput } from "@/components/chat/chat-input"
import { ErrorAlert } from "@/components/chat/error-alert"

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

  const [ttsEnabled, setTtsEnabled] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<AgentType>("chat")

  const [sourceLang, setSourceLang] = useState("English")
  const [targetLang, setTargetLang] = useState("Spanish")

  useEffect(() => {
    const savedAgent = localStorage.getItem("selectedAgent") as AgentType | null
    if (savedAgent === "chat" || savedAgent === "interpreter") {
      setSelectedAgent(savedAgent)
    }
    const savedSource = localStorage.getItem("sourceLang")
    if (savedSource) setSourceLang(savedSource)
    const savedTarget = localStorage.getItem("targetLang")
    if (savedTarget) setTargetLang(savedTarget)
  }, [])

  const agentConversations = useMemo(
    () => conversations.filter((c) => c.agentType === selectedAgent),
    [conversations, selectedAgent]
  )

  const agentCurrentConversation = useMemo(
    () => agentConversations.find((c) => c.id === currentConversationId) || agentConversations[0] || null,
    [agentConversations, currentConversationId]
  )

  useEffect(() => {
    try { localStorage.setItem("sourceLang", sourceLang) } catch {}
  }, [sourceLang])

  useEffect(() => {
    try { localStorage.setItem("targetLang", targetLang) } catch {}
  }, [targetLang])

  const swapLanguages = useCallback(() => {
    const temp = sourceLang
    setSourceLang(targetLang)
    setTargetLang(temp)
  }, [sourceLang, targetLang])

  const handleSelectAgent = useCallback((agent: AgentType) => {
    setSelectedAgent(agent)
    try { localStorage.setItem("selectedAgent", agent) } catch {}
    const agentConvs = conversations.filter((c) => c.agentType === agent)
    if (agentConvs.length === 0) {
      createNewConversation(undefined, agent)
    } else if (!agentConvs.find((c) => c.id === currentConversationId)) {
      switchConversation(agentConvs[0].id)
    }
  }, [conversations, currentConversationId, createNewConversation, switchConversation])

  const handleNewConversation = useCallback((title?: string) => {
    createNewConversation(title, selectedAgent)
  }, [createNewConversation, selectedAgent])

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
      <AgentSidebar
        selectedAgent={selectedAgent}
        onSelectAgent={handleSelectAgent}
        conversations={agentConversations}
        currentConversationId={agentCurrentConversation?.id || null}
        onNewConversation={handleNewConversation}
        onSwitchConversation={switchConversation}
        onDeleteConversation={deleteConversation}
      />

      <div className="flex-1 flex flex-col h-screen min-w-0">
        <div className="flex-shrink-0">
          <ChatHeader
            connectionError={connectionError}
            conversations={agentConversations}
            currentConversationId={agentCurrentConversation?.id || null}
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
            onNewConversation={handleNewConversation}
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
          <MessagesArea messages={agentCurrentConversation?.messages || []} isLoading={isLoading} />
        </div>

        <div className="flex-shrink-0">
          <ChatInput
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            ttsEnabled={ttsEnabled}
            onToggleTts={() => setTtsEnabled((v) => !v)}
            recordingLang={selectedAgent === "interpreter" ? (sourceLang === "Spanish" ? "es" : "en-US") : undefined}
            selectedModel={selectedModel}
          />
        </div>
      </div>
    </div>
  )
}
