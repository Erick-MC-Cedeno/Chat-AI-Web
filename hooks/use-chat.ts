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

  // Verificar conexión con la API al montar el hook
  useEffect(() => {
    let isMounted = true
    setConnectionError(null)
    ChatbotAPIService.checkConnection()
      .then((result) => {
        if (isMounted && !result.connected) {
          setConnectionError("No se pudo conectar con la API Flask")
        }
      })
      .catch((err) => {
        if (isMounted) {
          setConnectionError(
            typeof err === "string" ? err : err?.message || "Error desconocido al verificar conexión"
          )
        }
      })
    return () => {
      isMounted = false
    }
  }, [])

  // Cargar conversaciones al inicializar
  useEffect(() => {
    const conversations = ConversationStorage.loadConversations()
    const currentId = ConversationStorage.loadCurrentConversationId()

    if (conversations.length === 0) {
      const newConversation = {
        id: Date.now().toString(),
        title: "Nueva conversación",
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      setState({
        conversations: [newConversation],
        currentConversationId: newConversation.id,
        isLoading: false,
        connectionError: null,
      })
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

  // Guardar ID de conversación actual cuando cambie
  useEffect(() => {
    if (state.currentConversationId) {
      ConversationStorage.saveCurrentConversationId(state.currentConversationId)
    }
  }, [state.currentConversationId])

  const getCurrentConversation = useCallback((): Conversation | null => {
    return state.conversations.find((conv) => conv.id === state.currentConversationId) || null
  }, [state.conversations, state.currentConversationId])

  const updateCurrentConversation = useCallback((updates: Partial<Conversation>) => {
    setState((prev) => {
      const updatedConversations = prev.conversations.map((conv) =>
        conv.id === prev.currentConversationId
          ? { ...conv, ...updates, updatedAt: new Date() }
          : conv
      )
      
      return {
        ...prev,
        conversations: updatedConversations,
      }
    })
  }, [])

  const addMessage = useCallback(
    (message: Message) => {
      const currentConv = getCurrentConversation()
      if (!currentConv) {
        return
      }

      const updatedMessages = [...currentConv.messages, message]
      updateCurrentConversation({ 
        messages: updatedMessages,
        updatedAt: new Date()
      })
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
      if (!content.trim() || state.isLoading) {
        return
      }

      const currentConv = getCurrentConversation()
      if (!currentConv) {
        return
      }

      // Agregar mensaje del usuario
      const userMessage: Message = {
        id: Date.now().toString(),
        content: content.trim(),
        sender: "user",
        timestamp: new Date(),
      }
      
      // Crear mensaje del bot con estado de carga
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "",
        sender: "bot",
        timestamp: new Date()
      }

      // Agregar ambos mensajes a la conversación
      const updatedMessages = [...currentConv.messages, userMessage, botMessage]
      updateCurrentConversation({ 
        messages: updatedMessages,
        title: currentConv.messages.length === 0 ? content : currentConv.title
      })

      setLoading(true)
      setConnectionError(null)

      try {
        const response = await ChatbotAPIService.sendMessage(content)

        let finalResponse = response

        if (typeof response !== "string" || !response.trim()) {
          finalResponse = "Lo siento, no pude procesar tu solicitud. Por favor, intenta nuevamente."
        }

        // Actualizar el mensaje del bot con la respuesta
        const finalMessages = updatedMessages.map(msg => 
          msg.id === botMessage.id 
            ? { ...msg, content: finalResponse, isTyping: false }
            : msg
        )

        updateCurrentConversation({ messages: finalMessages })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido"
        setConnectionError(`Error de conexión: ${errorMessage}`)

        // Actualizar el mensaje del bot con error
        const errorMessages = updatedMessages.map(msg =>
          msg.id === botMessage.id
            ? {
                ...msg,
                content: "Lo siento, hubo un error al procesar tu mensaje. Por favor, inténtalo de nuevo.",
                error: true,
              }
            : msg
        )

        updateCurrentConversation({ messages: errorMessages })
      } finally {
        setLoading(false)
      }
    },
    [state.isLoading, getCurrentConversation, updateCurrentConversation, setLoading, setConnectionError],
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
