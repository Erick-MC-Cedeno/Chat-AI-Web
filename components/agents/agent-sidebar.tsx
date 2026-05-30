"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Bot, BookOpenText, Plus, MessageSquare, Trash2, ChevronLeft, ChevronRight } from "lucide-react"
import { AGENTS } from "@/types/chat"
import type { AgentType, Conversation } from "@/types/chat"
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip"

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
    <TooltipProvider>
      <div className={cn(
        "bg-sidebar/90 backdrop-blur-sm border-r border-border flex flex-col shrink-0 transition-all duration-300",
        expanded ? "w-80" : "w-16"
      )}>
        {/* Agent buttons */}
        <div className={cn("flex gap-2 px-2 pt-4", expanded ? "flex-col" : "flex-col items-center")}>
          {(() => {
            const current = AGENTS.find((a) => a.id === selectedAgent)
            const other = AGENTS.find((a) => a.id !== selectedAgent)
            if (!current || !other) return null
            const CurrentIcon = ICON_MAP[current.icon]
            const OtherIcon = ICON_MAP[other.icon]
            return (
              <>
                {!expanded && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${current.gradient} shadow-lg relative shrink-0 flex items-center justify-center cursor-default`}>
                        <CurrentIcon className="w-5 h-5 text-white" />
                        <span className="absolute -right-0.5 -top-0.5 w-2.5 h-2.5 bg-primary rounded-full border-2 border-sidebar" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="shadow-lg max-w-[280px]">
                      <p className="font-semibold text-foreground text-sm">{current.name}</p>
                      <p className="text-muted-foreground text-xs mt-0.5">{current.description}</p>
                    </TooltipContent>
                  </Tooltip>
                )}

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => onSelectAgent(other.id)}
                      className={cn(
                        "rounded-xl flex items-center justify-center transition-all duration-200 shrink-0",
                        expanded
                          ? "w-full px-3 py-2 gap-2 border border-dashed border-border/40 hover:border-border hover:bg-accent/50"
                          : "w-12 h-12 hover:bg-accent/50"
                      )}
                    >
                      <OtherIcon className={cn("w-5 h-5 shrink-0 text-muted-foreground")} />
                      {expanded && <span className="text-sm truncate text-muted-foreground">{other.name}</span>}
                    </button>
                  </TooltipTrigger>
                  {!expanded && (
                    <TooltipContent side="right" className="shadow-lg">
                      <p className="font-semibold text-foreground text-sm">{other.name}</p>
                      <p className="text-muted-foreground text-xs mt-0.5">{other.description}</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </>
            )
          })()}
        </div>

        <div className={cn("h-px bg-border/50 my-3", expanded ? "mx-3" : "w-8 mx-auto")} />

        {/* New conversation button */}
        <div className={cn(expanded ? "px-3" : "flex justify-center")}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => onNewConversation?.()}
                className={cn(
                  "rounded-xl flex items-center justify-center hover:bg-accent/50 transition-all duration-200",
                  expanded ? "w-full px-3 py-2 gap-2 border border-dashed border-border/60" : "w-10 h-10"
                )}
              >
                <Plus className="w-4 h-4 text-muted-foreground shrink-0" />
                {expanded && <span className="text-sm text-muted-foreground">Nueva conversación</span>}
              </button>
            </TooltipTrigger>
            {!expanded && (
              <TooltipContent side="right" className="shadow-lg">
                Nueva conversación
              </TooltipContent>
            )}
          </Tooltip>
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
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => onSwitchConversation?.(conv.id)}
                      className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 shrink-0",
                        conv.id === currentConversationId
                          ? "bg-sidebar-primary/30 border border-sidebar-border"
                          : "hover:bg-accent/50"
                      )}
                    >
                      <MessageSquare className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="shadow-lg flex items-center gap-2">
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
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          ))}
        </div>

        {/* Expand/Collapse toggle */}
        <div className={cn("py-3", expanded ? "border-t border-border/50 px-3" : "flex justify-center")}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setExpanded((v) => !v)}
                className={cn(
                  "rounded-xl flex items-center justify-center hover:bg-accent/50 transition-all duration-200",
                  expanded ? "w-full px-3 py-2 gap-2" : "w-8 h-8"
                )}
              >
                {expanded ? (
                  <>
                    <ChevronLeft className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-sm text-muted-foreground">Colapsar</span>
                  </>
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                )}
              </button>
            </TooltipTrigger>
            {!expanded && (
              <TooltipContent side="right" className="shadow-lg">
                Expandir
              </TooltipContent>
            )}
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  )
}
