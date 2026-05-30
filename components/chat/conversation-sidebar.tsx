"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Plus, MessageSquare, MoreVertical, Trash2, Edit3, Check, X, Menu, ChevronLeft, Bot, BookOpenText } from "lucide-react"
import type { Conversation, AgentType } from "@/types/chat"
import { AGENTS } from "@/types/chat"

interface ConversationSidebarProps {
  conversations: Conversation[]
  currentConversationId: string | null
  selectedAgent?: AgentType
  onSelectAgent?: (agent: AgentType) => void
  onNewConversation: (title?: string) => void
  onSwitchConversation: (id: string) => void
  onDeleteConversation: (id: string) => void
  onUpdateTitle: (id: string, title: string) => void
  isCollapsed: boolean
  onToggleCollapse: () => void
}

const AGENT_ICONS: Record<string, React.ElementType> = { Bot, BookOpenText }

export function ConversationSidebar({
  conversations,
  currentConversationId,
  selectedAgent,
  onSelectAgent,
  onNewConversation,
  onSwitchConversation,
  onDeleteConversation,
  onUpdateTitle,
  isCollapsed,
  onToggleCollapse,
}: ConversationSidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState("")

  const handleStartEdit = (conversation: Conversation) => {
    setEditingId(conversation.id)
    setEditingTitle(conversation.title)
  }

  const handleSaveEdit = () => {
    if (editingId && editingTitle.trim()) onUpdateTitle(editingId, editingTitle.trim())
    setEditingId(null)
    setEditingTitle("")
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditingTitle("")
  }

  const formatDate = (date: Date) => {
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)

    if (diffInHours < 24) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    if (diffInHours < 24 * 7) return date.toLocaleDateString([], { weekday: "short" })
    return date.toLocaleDateString([], { month: "short", day: "numeric" })
  }

  // Collapsed view
  if (isCollapsed) {
    return (
  <div className="w-16 bg-sidebar/90 backdrop-blur-sm border-r border-border flex flex-col items-center py-4 gap-4">
        <Button variant="ghost" size="icon" onClick={onToggleCollapse} className="h-10 w-10">
          <Menu className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => onNewConversation()} className="h-10 w-10">
          <Plus className="h-5 w-5" />
        </Button>
        <div className="flex-1 flex flex-col gap-2 w-full px-2">
          {conversations.slice(0, 5).map(conv => (
            <Button
              key={conv.id}
              variant={conv.id === currentConversationId ? "default" : "ghost"}
              size="icon"
              onClick={() => onSwitchConversation(conv.id)}
              className="h-10 w-10 shrink-0"
            >
              <MessageSquare className="h-4 w-4" />
            </Button>
          ))}
        </div>
      </div>
    )
  }

  return (
  <Card className="w-80 h-full min-h-0 border-0 border-r border-border rounded-none bg-sidebar/90 backdrop-blur-sm flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Conversaciones</CardTitle>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={() => onNewConversation()} className="h-8 w-8">
              <Plus className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onToggleCollapse} className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      {selectedAgent && onSelectAgent && (() => {
        const other = AGENTS.find((a) => a.id !== selectedAgent)
        if (!other) return null
        const Icon = AGENT_ICONS[other.icon] || Bot
        return (
          <div className="px-3 pb-3">
            <button
              onClick={() => onSelectAgent(other.id)}
              className="w-full flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 border border-dashed border-border/40 transition-all duration-200"
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{other.name}</span>
            </button>
          </div>
        )
      })()}
      <CardContent className="p-0 flex-1 flex flex-col min-h-0">
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-2 divide-y divide-border/30">
            {conversations.map(conversation => (
              <div
                key={conversation.id}
                className={`group relative rounded-md py-3 px-2 cursor-pointer transition-colors flex flex-col ${
                  conversation.id === currentConversationId
                    ? "bg-sidebar-primary/30 border border-sidebar-border"
                    : "hover:bg-popover/80"
                }`}
                onClick={() => onSwitchConversation(conversation.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {editingId === conversation.id ? (
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <Input
                          value={editingTitle}
                          onChange={e => setEditingTitle(e.target.value)}
                          className="h-6 text-sm"
                          autoFocus
                          onKeyDown={e => {
                            if (e.key === "Enter") handleSaveEdit()
                            if (e.key === "Escape") handleCancelEdit()
                          }}
                        />
                        <Button variant="ghost" size="icon" onClick={handleSaveEdit} className="h-6 w-6">
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={handleCancelEdit} className="h-6 w-6">
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <h3 className="font-medium text-sm truncate">{conversation.title}</h3>
                        <p className="text-xs text-muted-foreground mt-1">{formatDate(conversation.updatedAt)}</p>
                      </>
                    )}
                  </div>

                  {editingId !== conversation.id && (
                    <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={e => e.stopPropagation()}
                            className="h-6 w-6"
                          >
                            <MoreVertical className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleStartEdit(conversation)}>
                            <Edit3 className="h-4 w-4 mr-2" />
                            Renombrar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onDeleteConversation(conversation.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </div>

                {conversation.messages.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                    {conversation.messages[conversation.messages.length - 1]?.content}
                  </p>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
