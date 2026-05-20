"use client"

import { cn } from "@/lib/utils"
import { AGENTS } from "@/types/chat"
import type { AgentType } from "@/types/chat"

interface AgentSidebarProps {
  selectedAgent: AgentType
  onSelectAgent: (agent: AgentType) => void
}

export function AgentSidebar({ selectedAgent, onSelectAgent }: AgentSidebarProps) {
  return (
    <div className="w-16 bg-sidebar/90 backdrop-blur-sm border-r border-border flex flex-col items-center py-4 gap-2 shrink-0">
      {AGENTS.map((agent) => {
        const isSelected = agent.id === selectedAgent
        return (
          <button
            key={agent.id}
            onClick={() => onSelectAgent(agent.id)}
            className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 relative group",
              isSelected
                ? `bg-gradient-to-br ${agent.gradient} shadow-lg`
                : "hover:bg-accent/50"
            )}
            title={agent.name}
          >
            <span className="text-xl">{agent.icon}</span>
            {isSelected && (
              <span className="absolute -right-0.5 -top-0.5 w-2.5 h-2.5 bg-primary rounded-full border-2 border-sidebar" />
            )}
            <div className="absolute left-full ml-2 px-2 py-1 bg-popover border border-border rounded-lg text-xs whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 shadow-lg pointer-events-none">
              <p className="font-medium text-foreground">{agent.name}</p>
              <p className="text-muted-foreground text-[10px]">{agent.description}</p>
            </div>
          </button>
        )
      })}
    </div>
  )
}
