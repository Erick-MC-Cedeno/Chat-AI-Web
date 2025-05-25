"use client"

import { useState, useCallback, useEffect } from "react"
import type { Message, ChatState, Conversation } from "@/types/chat"
import { ChatbotAPIService } from "@/lib/services/chatbot-api"
import { ConversationStorage } from "@/lib/services/conversation-storage"

export function useChat() {
  const [state, setState] = useState<ChatState>({
    conversations: [],
    currentConversationId: null,
    isLoading: false,
    connectionError: null,
  })

  // Cargar conversaciones al inicializar
  useEffect(() => {
    const conversations = ConversationStorage.loadConversations()
    const currentId = ConversationStorage.loadCurrentConversationId()

    if (conversations.length === 0) {
      // Crear primera conversación si no hay ninguna
      const newConversation = ConversationStorage.createNewConversation()
      setState({
        conversations: [newConversation],
        currentConversationId: newConversation.id,
        isLoading: false,
        connectionError: null,
      })
      ConversationStorage.saveConversations([newConversation])
      ConversationStorage.saveCurrentConversationId(newConversation.id)
    } else {
      setState({
        conversations,
        currentConversationId: currentId || conversations[0].id,
        isLoading: false,
        connectionError: null,
      })
    }
  }, [])

  // Guardar conversaciones cuando cambien
  useEffect(() => {
    if (state.conversations.length > 0) {
      ConversationStorage.saveConversations(state.conversations)
    }
  }, [state.conversations])

  // Guardar conversación actual cuando cambie
  useEffect(() => {
    ConversationStorage.saveCurrentConversationId(state.currentConversationId)
  }, [state.currentConversationId])

  const getCurrentConversation = useCallback((): Conversation | null => {
    return state.conversations.find((conv) => conv.id === state.currentConversationId) || null
  }, [state.conversations, state.currentConversationId])

  const updateCurrentConversation = useCallback((updates: Partial<Conversation>) => {
    setState((prev) => ({
      ...prev,
      conversations: prev.conversations.map((conv) =>
        conv.id === prev.currentConversationId ? { ...conv, ...updates, updatedAt: new Date() } : conv,
      ),
    }))
  }, [])

  const addMessage = useCallback(
    (message: Message) => {
      const currentConv = getCurrentConversation()
      if (!currentConv) return

      const updatedMessages = [...currentConv.messages, message]
      updateCurrentConversation({ messages: updatedMessages })
    },
    [getCurrentConversation, updateCurrentConversation],
  )

  const updateMessage = useCallback(
    (messageId: string, updates: Partial<Message>) => {
      const currentConv = getCurrentConversation()
      if (!currentConv) return

      const updatedMessages = currentConv.messages.map((msg) => (msg.id === messageId ? { ...msg, ...updates } : msg))
      updateCurrentConversation({ messages: updatedMessages })
    },
    [getCurrentConversation, updateCurrentConversation],
  )

  const setLoading = useCallback((isLoading: boolean) => {
    setState((prev) => ({ ...prev, isLoading }))
  }, [])

  const setConnectionError = useCallback((error: string | null) => {
    setState((prev) => ({ ...prev, connectionError: error }))
  }, [])

  const createNewConversation = useCallback(() => {
    const newConversation = ConversationStorage.createNewConversation()
    setState((prev) => ({
      ...prev,
      conversations: [newConversation, ...prev.conversations],
      currentConversationId: newConversation.id,
    }))
  }, [])

  const switchConversation = useCallback((conversationId: string) => {
    setState((prev) => ({
      ...prev,
      currentConversationId: conversationId,
    }))
  }, [])

  const deleteConversation = useCallback((conversationId: string) => {
    setState((prev) => {
      const filteredConversations = prev.conversations.filter((conv) => conv.id !== conversationId)

      // Si eliminamos la conversación actual, cambiar a otra
      let newCurrentId = prev.currentConversationId
      if (prev.currentConversationId === conversationId) {
        if (filteredConversations.length > 0) {
          newCurrentId = filteredConversations[0].id
        } else {
          // Crear nueva conversación si no queda ninguna
          const newConversation = ConversationStorage.createNewConversation()
          return {
            ...prev,
            conversations: [newConversation],
            currentConversationId: newConversation.id,
          }
        }
      }

      return {
        ...prev,
        conversations: filteredConversations,
        currentConversationId: newCurrentId,
      }
    })
  }, [])

  const updateConversationTitle = useCallback((conversationId: string, title: string) => {
    setState((prev) => ({
      ...prev,
      conversations: prev.conversations.map((conv) =>
        conv.id === conversationId ? { ...conv, title, updatedAt: new Date() } : conv,
      ),
    }))
  }, [])

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || state.isLoading) return

      const currentConv = getCurrentConversation()
      if (!currentConv) return

      // Agregar mensaje del usuario
      const userMessage: Message = {
        id: Date.now().toString(),
        content,
        sender: "user",
        timestamp: new Date(),
      }
      addMessage(userMessage)

      // Actualizar título si es el primer mensaje del usuario
      if (currentConv.messages.length === 1) {
        const newTitle = ConversationStorage.generateConversationTitle([...currentConv.messages, userMessage])
        updateConversationTitle(currentConv.id, newTitle)
      }

      setLoading(true)
      setConnectionError(null)

      try {
        // Crear mensaje del bot con estado de carga
        const botMessageId = (Date.now() + 1).toString()
        const botMessage: Message = {
          id: botMessageId,
          content: "",
          sender: "bot",
          timestamp: new Date(),
          isTyping: true,
        }
        addMessage(botMessage)

        // Llamar a la API
        const response = await ChatbotAPIService.sendMessage(content)

        // Simular efecto de escritura
        await simulateTyping(response, botMessageId)
      } catch (error) {
        console.error("Error calling model API:", error)

        const errorMessage = error instanceof Error ? error.message : "Error desconocido"
        setConnectionError(`Error de conexión: ${errorMessage}`)

        // Actualizar el mensaje del bot con error
        const currentConvAfterError = getCurrentConversation()
        if (currentConvAfterError) {
          const updatedMessages = currentConvAfterError.messages.map((msg) =>
            msg.sender === "bot" && msg.isTyping
              ? {
                  ...msg,
                  content: "Lo siento, hubo un error al procesar tu mensaje. Por favor, inténtalo de nuevo.",
                  isTyping: false,
                  error: true,
                }
              : msg,
          )
          updateCurrentConversation({ messages: updatedMessages })
        }
      } finally {
        setLoading(false)
      }
    },
    [
      state.isLoading,
      getCurrentConversation,
      addMessage,
      updateConversationTitle,
      setLoading,
      setConnectionError,
      updateCurrentConversation,
    ],
  )

  const simulateTyping = useCallback(
    async (text: string, messageId: string): Promise<void> => {
      return new Promise((resolve) => {
        let currentText = ""
        let index = 0

        const typingInterval = setInterval(() => {
          if (index < text.length) {
            currentText += text[index]
            updateMessage(messageId, { content: currentText })
            index++
          } else {
            clearInterval(typingInterval)
            updateMessage(messageId, { isTyping: false })
            resolve()
          }
        }, 30)
      })
    },
    [updateMessage],
  )

  const currentConversation = getCurrentConversation()

  return {
    ...state,
    currentConversation,
    sendMessage,
    createNewConversation,
    switchConversation,
    deleteConversation,
    updateConversationTitle,
  }
}
