"use client"

import { useState, useCallback, useEffect } from "react"
import { toast } from "@/hooks/use-toast"
import type { AgentType, Message, ChatState, Conversation, ModelType, SendMessageOptions } from "@/types/chat"
import { ConversationStorage } from "@/lib/services/conversation-storage"

/**
 * useChat hook: manages conversations, messages, and TTS playback.
 * Exposes state and actions: sendMessage, create/switch/delete conversation, and updates.
 */
export function useChat() {
  const [state, setState] = useState<ChatState>({
    conversations: [],
    currentConversationId: null,
    isLoading: false,
    connectionError: null,
    selectedModel: "local",
  })

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return
    const synth = window.speechSynthesis
    const ensure = () => { try { synth.getVoices() } catch { /* ignore */ } }
    ensure()
    synth.onvoiceschanged = ensure
    return () => { try { synth.onvoiceschanged = null } catch { /* ignore */ } }
  }, [])

  useEffect(() => {
    let mounted = true
    setConnectionError(null)
    ;(async () => {
      try {
        const res = await fetch("/api/model")
        if (!mounted) return
        if (!res.ok) return setConnectionError("No se pudo conectar con el endpoint interno de modelos")
        const data = await res.json().catch(() => null)
        if (!data || data.status !== "connected") setConnectionError("No se pudo conectar con la API de modelos")
      } catch (e: any) {
        if (!mounted) return
        setConnectionError(typeof e === "string" ? e : e?.message || "Error desconocido al verificar conexión")
      }
    })()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    const convs = ConversationStorage.loadConversations()
    const id = ConversationStorage.loadCurrentConversationId()
    const savedModel = (() => {
      try { return (typeof window !== "undefined" ? localStorage.getItem("selectedModel") : null) as ModelType | null } catch { return null }
    })()
    const validModels: ModelType[] = ["local", "nvidia-llama", "nvidia-nemotron", "nvidia-kimi", "nvidia-gpt-oss", "nvidia-gpt-oss-120b", "nvidia-glm", "nvidia-mistral"]
    const model: ModelType = savedModel && validModels.includes(savedModel) ? savedModel : "local"
    if (convs.length === 0) {
      const c = ConversationStorage.createNewConversation("chat")
      setState({ conversations: [c], currentConversationId: c.id, isLoading: false, connectionError: null, selectedModel: model })
      // If the created conversation includes a bot welcome message marked as typing,
      // schedule clearing the typing flag after an estimated duration so the UI
      // shows the typing indicator first.
      const welcome = c.messages?.find((m) => m.sender === "bot" && m.isTyping)
      if (welcome) {
        try {
          const final = welcome.content || ""
          const msPerChar = 25
          const minMs = 300
          const maxMs = 3000
          const est = Math.min(maxMs, Math.max(minMs, final.length * msPerChar))
          setTimeout(() => {
            setState((prev) => ({ ...prev, conversations: prev.conversations.map((cv) => cv.id === c.id ? { ...cv, messages: (cv.messages || []).map((m) => m.id === welcome.id ? { ...m, isTyping: false } : m) } : cv) }))
          }, est)
        } catch (e) { /* ignore timing errors */ }
      }
    } else {
      setState({ conversations: convs, currentConversationId: id || convs[0].id, isLoading: false, connectionError: null, selectedModel: model })
    }
  }, [])

  useEffect(() => ConversationStorage.saveConversations(state.conversations), [state.conversations])
  useEffect(() => { if (state.currentConversationId) ConversationStorage.saveCurrentConversationId(state.currentConversationId) }, [state.currentConversationId])

  const getCurrentConversation = useCallback((): Conversation | null => state.conversations.find((c) => c.id === state.currentConversationId) || null, [state.conversations, state.currentConversationId])

  const updateCurrentConversation = useCallback((updates: Partial<Conversation>) => {
    setState((prev) => ({ ...prev, conversations: prev.conversations.map((c) => c.id === prev.currentConversationId ? { ...c, ...updates, updatedAt: new Date() } : c) }))
  }, [])

  const setLoading = useCallback((v: boolean) => setState((p) => ({ ...p, isLoading: v })), [])
  const setConnectionError = useCallback((err: string | null) => setState((p) => ({ ...p, connectionError: err })), [])
  const setSelectedModel = useCallback((model: ModelType) => {
    setState((p) => ({ ...p, selectedModel: model }))
    try { localStorage.setItem("selectedModel", model) } catch {}
  }, [])

  const createNewConversation = useCallback((title?: string, agentType?: AgentType) => {
    const c = ConversationStorage.createNewConversation(agentType || "chat", title)
    setState((p) => ({ ...p, conversations: [c, ...p.conversations], currentConversationId: c.id }))
    // If the created conversation includes a bot welcome message marked as typing,
    // schedule clearing the typing flag after an estimated duration so the UI
    // shows the typing indicator first.
    const welcome = c.messages?.find((m) => m.sender === "bot" && m.isTyping)
    if (welcome) {
      try {
        const final = welcome.content || ""
        const msPerChar = 25
        const minMs = 300
        const maxMs = 3000
        const est = Math.min(maxMs, Math.max(minMs, final.length * msPerChar))
        // Use setState and directly target the newly created conversation by id.
        // Avoid using getCurrentConversation here because closures can capture
        // stale state and cause the messages from the previous conversation to
        // be copied into the new one.
        setTimeout(() => {
          setState((prev) => ({
            ...prev,
            conversations: prev.conversations.map((cv) =>
              cv.id === c.id
                ? { ...cv, messages: (cv.messages || []).map((m) => (m.id === welcome.id ? { ...m, isTyping: false } : m)) }
                : cv
            ),
          }))
        }, est)
      } catch (e) { /* ignore timing errors */ }
    }
  }, [getCurrentConversation, updateCurrentConversation])

  const switchConversation = useCallback((id: string) => setState((p) => ({ ...p, currentConversationId: id })), [])

  const deleteConversation = useCallback((id: string) => {
    setState((prev) => {
      const filtered = prev.conversations.filter((c) => c.id !== id)
      if (prev.currentConversationId === id) {
        if (filtered.length === 0) return { ...prev, conversations: [], currentConversationId: null }
        return { ...prev, conversations: filtered, currentConversationId: filtered[0].id }
      }
      return { ...prev, conversations: filtered }
    })
  }, [])

  const updateConversationTitle = useCallback((conversationId: string, title: string) => {
    setState((p) => ({ ...p, conversations: p.conversations.map((c) => c.id === conversationId ? { ...c, title, updatedAt: new Date() } : c) }))
  }, [])

  /** Ensure voices are available in the browser (returns array of voices). */
  const ensureVoices = async (): Promise<SpeechSynthesisVoice[]> => {
    if (typeof window === "undefined" || !window.speechSynthesis) return []
    const synth = window.speechSynthesis
    let voices = synth.getVoices() || []
    if (voices.length === 0) {
      await new Promise<void>((resolve) => {
        const onVoices = () => { voices = synth.getVoices() || []; resolve() }
        synth.onvoiceschanged = onVoices
        setTimeout(() => resolve(), 500)
      })
      voices = synth.getVoices() || []
    }
    return voices
  }

  /** Select the best voice given language and female preference. */
  const selectVoice = (voices: SpeechSynthesisVoice[], lang?: string, female = false) => {
    if (!voices || voices.length === 0) return null
    let voice: SpeechSynthesisVoice | null = null
    if (lang) voice = voices.find((v) => (v.lang || "").toLowerCase().startsWith(lang.toLowerCase())) || null
    if (!voice && female) voice = voices.find((v) => /female|woman|frau|mujer/i.test(v.name)) || null
    if (!voice && lang === "es") voice = voices.find((v) => /(spanish|es|es-)/i.test((v.name || "") + " " + (v.lang || ""))) || null
    return voice || voices.find((v) => /google|native|alloy/i.test(v.name)) || voices[0] || null
  }

  /** Play text using browser TTS. */
  const playBrowserTTS = async (text: string, female = false, lang?: string) => {
    try {
      if (typeof window === "undefined" || !window.speechSynthesis) return
      const synth = window.speechSynthesis
      const voices = await ensureVoices()
      const voice = selectVoice(voices, lang, female) || undefined
      // Lightweight client-side preprocessing: normalize and expand numbers for Spanish
      const preprocessClient = (t: string, langHint?: string) => {
        let out = String(t || "").trim()
        out = out.normalize('NFC')
        out = out.replace(/\s+/g, ' ')
        if (!/[.!?…]$/.test(out)) out = out + '.'

        if (langHint && langHint.toLowerCase().startsWith('es')) {
          // small number to words for client fallback (handles common cases)
          const units = ["cero","uno","dos","tres","cuatro","cinco","seis","siete","ocho","nueve","diez","once","doce","trece","catorce","quince","dieciseis","diecisiete","dieciocho","diecinueve","veinte"]
          const tens = ["","", "veinte", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"]

          function toWords(n: number): string {
            if (n <= 20) return units[n]
            if (n < 100) {
              const d = Math.floor(n / 10)
              const u = n % 10
              return u === 0 ? tens[d] : `${tens[d]} y ${units[u]}`
            }
            if (n < 1000) {
              const c = Math.floor(n / 100)
              const rest = n % 100
              const hundreds = ["","ciento","doscientos","trescientos","cuatrocientos","quinientos","seiscientos","setecientos","ochocientos","novecientos"]
              return rest === 0 ? (c===1? 'cien': hundreds[c]) : `${hundreds[c]} ${toWords(rest)}`
            }
            return String(n)
          }

          out = out.replace(/\b\d{1,12}\b/g, (m) => {
            try { const n = parseInt(m,10); return isNaN(n) ? m : toWords(n) } catch { return m }
          })
          out = out.replace(/\b(\d+)[.,](\d+)\b/g, (_m, w, f) => {
            if (f.length === 2) return `${toWords(parseInt(w,10))} con ${toWords(parseInt(f.slice(0,2),10))}`
            return `${toWords(parseInt(w,10))} coma ${f.split('').map((d: string) => ['cero','uno','dos','tres','cuatro','cinco','seis','siete','ocho','nueve'][parseInt(d,10)]).join(' ')}`
          })
        }
        return out
      }

      // preprocess for Spanish so browser reads numbers nicely
      const pre = preprocessClient(text, lang)
      const utter = new SpeechSynthesisUtterance(pre)
      if (voice) utter.voice = voice
      // Use language-specific defaults for Spanish for more natural rhythm
      utter.lang = lang || 'es-ES'
      const isEs = Boolean(lang && String(lang).toLowerCase().startsWith("es"))
      utter.rate = isEs ? 0.95 : 1
      // Slightly raise pitch for female preference, otherwise slightly lower for adult male timbre
      utter.pitch = female ? 1.06 : 0.97
      // Slight volume boost for clarity on some browsers
      try { (utter as any).volume = 1 } catch { }
      try { synth.cancel() } catch { }
      synth.speak(utter)
    } catch (e) {
      console.error("Browser TTS error:", e)
    }
  }

  /** Try server-side TTS; fall back to browser TTS when necessary. */
  const playServerTTS = async (text: string, female = false, lang = "es") => {
    try {
      const res = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, lang, ssml: true }) })
      const data = await res.json().catch(() => ({}))
      if (data?.fallbackToClient) return playBrowserTTS(text, female, lang)
      if (data?.audioBase64) {
        const bytes = Uint8Array.from(atob(data.audioBase64), (c) => c.charCodeAt(0))
        const blob = new Blob([bytes], { type: data.contentType || "audio/mpeg" })
        try { if (window?.speechSynthesis) window.speechSynthesis.cancel() } catch { }
        try { (window as any).__lastServerTtsPlayedAt = Date.now() } catch { }
        const audio = new Audio(URL.createObjectURL(blob))
        await audio.play().catch(() => playBrowserTTS(text, female, lang))
        audio.addEventListener("ended", () => { try { (window as any).__lastServerTtsPlayedAt = Date.now() } catch { } })
        return
      }
      toast({ title: "Audio de TTS no disponible", description: "Usando TTS del navegador como alternativa." })
      return playBrowserTTS(text, female, lang)
    } catch (e) {
      console.warn("TTS server error, falling back to browser TTS", e)
      return playBrowserTTS(text, female, lang)
    }
  }

  const cleanResponseText = (text: string): string => {
    return text
      // Quitar marcadores markdown bold/italic (dejar solo el texto)
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/__(.+?)__/g, '$1')
      .replace(/_(.+?)_/g, '$1')
      // Quitar títulos markdown
      .replace(/^#{1,6}\s*/gm, '')
      // Quitar etiquetas HTML sueltas
      .replace(/<\/?[^>]+(>|$)/g, '')
      // Normalizar espacios y saltos de línea
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+$/gm, '')
      .trim()
  }

  const sendMessage = useCallback(async (content: string, options?: SendMessageOptions) => {
    if (!content.trim() || state.isLoading) return
    let conv = getCurrentConversation()
    let created = false
    const nowId = Date.now().toString()
    const userMessage: Message = { id: nowId, content: content.trim(), sender: "user", timestamp: new Date() }
  const isTranslation = !!options?.translation
  const botMessage: Message = { id: (Date.now() + 1).toString(), content: "", sender: "bot", timestamp: new Date(), isTyping: true, isTranslation }

    // Build history from previous turns ONLY (before adding current messages)
    const history = (conv?.messages || [])
      .filter((m) => m.sender === "user" || m.sender === "bot")
      .map((m) => ({ role: m.sender === "user" ? "user" : "assistant", content: m.content }))

    if (!conv) {
      const c = ConversationStorage.createNewConversation(options?.translation ? "interpreter" : "chat", undefined, [userMessage, botMessage])
      setState((p) => ({ ...p, conversations: [c, ...p.conversations], currentConversationId: c.id }))
      conv = c
      created = true
    }

    const updated = created ? conv.messages : ((conv.messages && conv.messages.length > 0) ? [...conv.messages, userMessage, botMessage] : [userMessage, botMessage])
    const hadUserBefore = conv.messages.some((m) => m.sender === "user")
    updateCurrentConversation({ messages: updated, title: !hadUserBefore ? ConversationStorage.generateConversationTitle(updated) : conv.title })

    setLoading(true); setConnectionError(null)
    try {
      let final: string

      if (isTranslation) {
        const res = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source_language: options.translation!.source_language,
            target_language: options.translation!.target_language,
            text: content,
            model: state.selectedModel,
          }),
        })
        if (!res.ok) throw new Error(`Translation API error: ${res.status}`)
        const data = await res.json().catch(() => ({}))
        final = typeof data?.translatedText === "string" && data.translatedText.trim()
          ? data.translatedText
          : "Translation failed. Please try again."
      } else {
        const body: any = { prompt: content, model: state.selectedModel, history }
        if (options?.capabilities) body.capabilities = options.capabilities
        if (options?.ttsFemale) body.ttsFemale = true

        const res = await fetch("/api/model", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        if (!res.ok) throw new Error(`Error en el endpoint interno: ${res.status}`)
        const data = await res.json().catch(() => ({}))
        final = typeof data?.response === "string" && data.response.trim() ? cleanResponseText(data.response) : "Lo siento, no pude procesar tu solicitud. Por favor, intenta nuevamente."
      }

      // Update bot message with final content but keep isTyping=true so the UI
      // can animate the typewriter effect for new responses. After an estimated
      // duration based on text length, mark isTyping=false so the message is
      // persisted as completed and won't re-type on refresh.
      const finalMessagesTyping = updated.map((m) => m.id === botMessage.id ? { ...m, content: final, isTyping: true } : m)
      updateCurrentConversation({ messages: finalMessagesTyping })

      // Estimate typing duration (ms) based on characters; clamp to reasonable bounds
      try {
        const msPerChar = 1.2
        const minMs = 300
        const maxMs = 30000
        const est = Math.min(maxMs, Math.max(minMs, final.length * msPerChar))
        setTimeout(() => {
          const finalMessagesDone = finalMessagesTyping.map((m) => m.id === botMessage.id ? { ...m, isTyping: false } : m)
          updateCurrentConversation({ messages: finalMessagesDone })
        }, est)
      } catch (e) {
        // fallback: immediately clear typing flag
        const finalMessagesDone = finalMessagesTyping.map((m) => m.id === botMessage.id ? { ...m, isTyping: false } : m)
        updateCurrentConversation({ messages: finalMessagesDone })
      }

      if (options?.ttsFemale && typeof window !== "undefined") {
        const ttsLang = options?.translation?.target_language === "English" ? "en" : "es"
        await playServerTTS(final, !!options.ttsFemale, ttsLang)
      }
    } catch (err: any) {
      setConnectionError(`Error de conexión: ${err instanceof Error ? err.message : String(err)}`)
      const errorMessages = (getCurrentConversation()?.messages || []).map((m) => m.id === botMessage.id ? { ...m, content: "Lo siento, hubo un error al procesar tu mensaje. Por favor, inténtalo de nuevo.", error: true } : m)
      updateCurrentConversation({ messages: errorMessages })
    } finally { setLoading(false) }
  }, [state.isLoading, state.selectedModel, getCurrentConversation, updateCurrentConversation, setLoading, setConnectionError])

  const currentConversation = getCurrentConversation()
  return { ...state, currentConversation, sendMessage, createNewConversation, switchConversation, deleteConversation, updateConversationTitle, setSelectedModel }
}
