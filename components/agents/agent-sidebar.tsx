"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Bot, BookOpenText, Plus, MessageSquare, Trash2, ChevronLeft, ChevronRight, Edit3 } from "lucide-react"
import { AGENTS } from "@/types/chat"
import type { AgentType, Conversation } from "@/types/chat"

const ICON_MAP: Record<string, React.ElementType> = {
  Bot,
  BookOpenText,
}

interface AgentSidebarProps {
  selectedAgent: AgentType
  onSelectAgent: (agent: AgentType) => void
  conversations?: Conversation[]
  currentConversationId?: string | null
  onNewConversation?: () => void
  onSwitchConversation?: (id: string) => void
  onDeleteConversation?: (id: string) => void
}

export function AgentSidebar({
  selectedAgent,
  onSelectAgent,
  conversations = [],
  currentConversationId = null,
  onNewConversation,
  onSwitchConversation,
  onDeleteConversation,
}: AgentSidebarProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={cn(
      "bg-sidebar/90 backdrop-blur-sm border-r border-border flex flex-col shrink-0 transition-all duration-300",
      expanded ? "w-80" : "w-16"
    )}>
      {/* Agent buttons */}
      <div className={cn("flex gap-2 px-2 pt-4", expanded ? "flex-row" : "flex-col items-center")}>
        {AGENTS.map((agent) => {
          const isSelected = agent.id === selectedAgent
          const IconComponent = ICON_MAP[agent.icon]
          return (
            <button
              key={agent.id}
              onClick={() => onSelectAgent(agent.id)}
              className={cn(
                "rounded-xl flex items-center justify-center transition-all duration-200 relative group shrink-0",
                expanded ? "w-full px-3 py-2 gap-2" : "w-12 h-12",
                isSelected
                  ? `bg-gradient-to-br ${agent.gradient} shadow-lg`
                  : "hover:bg-accent/50"
              )}
              title={agent.name}
            >
              {IconComponent && (
                <IconComponent className={cn("w-5 h-5 shrink-0", isSelected ? "text-white" : "text-muted-foreground")} />
              )}
              {expanded && (
                <span className={cn("text-sm truncate", isSelected ? "text-white font-medium" : "text-muted-foreground")}>
                  {agent.name}
                </span>
              )}
              {isSelected && !expanded && (
                <span className="absolute -right-0.5 -top-0.5 w-2.5 h-2.5 bg-primary rounded-full border-2 border-sidebar" />
              )}
              {!expanded && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-popover border border-border rounded-lg text-xs opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 shadow-lg pointer-events-none whitespace-nowrap">
                  <p className="font-medium text-foreground">{agent.name}</p>
                  <p className="text-muted-foreground text-[10px]">{agent.description}</p>
                  {agent.skills && agent.skills.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {agent.skills.map((skill, i) => (
                        <li key={i} className="text-[10px] text-muted-foreground/70 flex items-center gap-1">
                          <span className="w-1 h-1 rounded-full bg-muted-foreground/30 shrink-0" />
                          {skill}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>

      <div className={cn("h-px bg-border/50 my-3", expanded ? "mx-3" : "w-8 mx-auto")} />

      {/* New conversation button */}
      <div className={cn(expanded ? "px-3" : "flex justify-center")}>
        <button
          onClick={() => onNewConversation?.()}
          className={cn(
            "rounded-xl flex items-center justify-center hover:bg-accent/50 transition-all duration-200 group relative",
            expanded ? "w-full px-3 py-2 gap-2 border border-dashed border-border/60" : "w-10 h-10"
          )}
          title="Nueva conversación"
        >
          <Plus className="w-4 h-4 text-muted-foreground shrink-0" />
          {expanded && <span className="text-sm text-muted-foreground">Nueva conversación</span>}
          {!expanded && (
            <div className="absolute left-full ml-2 px-2 py-1 bg-popover border border-border rounded-lg text-xs opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 shadow-lg pointer-events-none whitespace-nowrap">
              Nueva conversación
            </div>
          )}
        </button>
      </div>

      {/* Conversation list */}
      <div className={cn(
        "flex-1 overflow-y-auto mt-2",
        expanded ? "px-2 space-y-1" : "flex flex-col items-center gap-1 px-2",
      )} style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
        {conversations.length === 0 && expanded && (
          <p className="text-xs text-muted-foreground/50 text-center py-8">Sin conversaciones</p>
        )}
        {conversations.map((conv) => (
          <div key={conv.id} className="w-full">
            {expanded ? (
              <div
                onClick={() => onSwitchConversation?.(conv.id)}
                className={cn(
                  "group flex items-center gap-2 rounded-xl px-3 py-2 cursor-pointer transition-colors",
                  conv.id === currentConversationId
                    ? "bg-sidebar-primary/30 border border-sidebar-border"
                    : "hover:bg-accent/50"
                )}
              >
                <MessageSquare className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="flex-1 text-sm truncate">{conv.title}</span>
                {onDeleteConversation && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); onDeleteConversation(conv.id) }}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); onDeleteConversation(conv.id) } }}
                    className="text-red-400 hover:text-red-500 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </span>
                )}
              </div>
            ) : (
              <button
                onClick={() => onSwitchConversation?.(conv.id)}
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 shrink-0 relative group",
                  conv.id === currentConversationId
                    ? "bg-sidebar-primary/30 border border-sidebar-border"
                    : "hover:bg-accent/50"
                )}
              >
                <MessageSquare className="w-4 h-4 text-muted-foreground" />
                <div className="absolute left-full ml-2 px-2 py-1 bg-popover border border-border rounded-lg text-xs opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 shadow-lg pointer-events-none whitespace-nowrap flex items-center gap-2">
                  <span className="font-medium text-foreground max-w-[200px] truncate">{conv.title}</span>
                  {onDeleteConversation && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); onDeleteConversation(conv.id) }}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); onDeleteConversation(conv.id) } }}
                      className="text-red-400 hover:text-red-500 cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3 h-3" />
                    </span>
                  )}
                </div>
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Expand/Collapse toggle */}
      <div className={cn("py-3", expanded ? "border-t border-border/50 px-3" : "flex justify-center")}>
        <button
          onClick={() => setExpanded((v) => !v)}
          className={cn(
            "rounded-xl flex items-center justify-center hover:bg-accent/50 transition-all duration-200 group relative",
            expanded ? "w-full px-3 py-2 gap-2" : "w-8 h-8"
          )}
          title={expanded ? "Colapsar" : "Expandir"}
        >
          {expanded ? (
            <>
              <ChevronLeft className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-sm text-muted-foreground">Colapsar</span>
            </>
          ) : (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
              <div className="absolute left-full ml-2 px-2 py-1 bg-popover border border-border rounded-lg text-xs opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 shadow-lg pointer-events-none whitespace-nowrap">
                Expandir
              </div>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
