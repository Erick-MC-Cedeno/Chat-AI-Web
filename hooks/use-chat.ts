"use client"

import { useState, useCallback, useEffect } from "react"
import type { Message, ChatState, Conversation } from "@/types/chat"
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

    const checkInternal = async () => {
      try {
        const res = await fetch("/api/model", {
          method: "GET",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
        })

        if (!isMounted) return

        if (!res.ok) {
          setConnectionError("No se pudo conectar con el endpoint interno de modelos")
          return
        }

        const data = await res.json()
        if (!data || data.status !== "connected") {
          setConnectionError("No se pudo conectar con la API de modelos")
        }
      } catch (err: any) {
        if (!isMounted) return
        setConnectionError(typeof err === "string" ? err : err?.message || "Error desconocido al verificar conexión")
      }
    }

    checkInternal()

    return () => {
      isMounted = false
    }
  }, [])

  // Cargar conversaciones al inicializar
  useEffect(() => {
    const conversations = ConversationStorage.loadConversations()
    const currentId = ConversationStorage.loadCurrentConversationId()

    if (conversations.length === 0) {
      const newConversation = ConversationStorage.createNewConversation()
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
    // Always persist conversations (including empty array) so deletions are saved to localStorage
    ConversationStorage.saveConversations(state.conversations)
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
          // No quedan conversaciones: dejar la lista vacía y currentConversationId en null
          return {
            ...prev,
            conversations: [],
            currentConversationId: null,
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

      let currentConv = getCurrentConversation()

      // If there's no current conversation (e.g., all were deleted), create one
      let createdHere = false
      if (!currentConv) {
        // prepare user and bot placeholder messages
        const userMessage: Message = {
          id: Date.now().toString(),
          content: content.trim(),
          sender: "user",
          timestamp: new Date(),
        }

        const botMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: "",
          sender: "bot",
          timestamp: new Date(),
        }

        const newConversation = ConversationStorage.createNewConversation(undefined, [userMessage, botMessage])
        // set new conversation in state so subsequent updates operate on it
        setState((prev) => ({
          ...prev,
          conversations: [newConversation, ...prev.conversations],
          currentConversationId: newConversation.id,
        }))

        // update local reference
        currentConv = newConversation
        createdHere = true
      }

      // Agregar mensaje del usuario y un placeholder del bot
      const userMessage: Message = {
        id: Date.now().toString(),
        content: content.trim(),
        sender: "user",
        timestamp: new Date(),
      }

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "",
        sender: "bot",
        timestamp: new Date(),
      }

      // If conversation was just created above, it already contains these messages; otherwise append
      const updatedMessages = createdHere
        ? currentConv.messages
        : (currentConv.messages && currentConv.messages.length > 0
          ? [...currentConv.messages, userMessage, botMessage]
          : [userMessage, botMessage])

      updateCurrentConversation({
        messages: updatedMessages,
        title: currentConv.messages.length === 0 ? content : currentConv.title,
      })

      setLoading(true)
      setConnectionError(null)

      try {
        const res = await fetch("/api/model", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ prompt: content }),
        })

        if (!res.ok) {
          throw new Error(`Error en el endpoint interno: ${res.status}`)
        }

        const data = await res.json()
        let finalResponse = data?.response

        if (typeof finalResponse !== "string" || !finalResponse?.trim()) {
          finalResponse = "Lo siento, no pude procesar tu solicitud. Por favor, intenta nuevamente."
        }

        // Actualizar el mensaje del bot con la respuesta
        const finalMessages = updatedMessages.map((msg) =>
          msg.id === botMessage.id ? { ...msg, content: finalResponse, isTyping: false } : msg,
        )

        updateCurrentConversation({ messages: finalMessages })
      } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : "Error desconocido"
        setConnectionError(`Error de conexión: ${errorMessage}`)

        // Actualizar el mensaje del bot con error
        const errorMessages = updatedMessages.map((msg) =>
          msg.id === botMessage.id
            ? {
                ...msg,
                content: "Lo siento, hubo un error al procesar tu mensaje. Por favor, inténtalo de nuevo.",
                error: true,
              }
            : msg,
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
