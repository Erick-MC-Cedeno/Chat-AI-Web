"use client"

import { Button } from "@/components/ui/button"
import { Brain, Calculator, Sparkles, Check, X } from "lucide-react"

interface QuickActionsProps {
  onActionClick: (text: string) => void
  disabled: boolean
  capabilityStates?: { [key: string]: boolean }
  onToggleCapability?: (label: string) => void
  ttsFemale?: boolean
  onToggleTts?: () => void
}

export function QuickActions({ onActionClick, disabled, capabilityStates = {}, onToggleCapability, ttsFemale = false, onToggleTts }: QuickActionsProps) {
  const actions = [
    {
      icon: Brain,
      label: "Programación",
      text: "¿Cómo puedo aprender programación?",
    },
    {
      icon: Calculator,
      label: "Matemáticas",
      text: "Calcula 25 * 4 + 10",
    },
  ]

  return (
    <div className="flex gap-2 mt-3 items-center">
      {actions.map((action) => (
        <div key={action.label} className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onActionClick(action.text)}
            disabled={disabled}
            className="text-xs flex items-center"
          >
            <action.icon className="h-3 w-3 mr-1" />
            {action.label}
          </Button>

          {/* Small toggle button to enable/disable capability */}
          <Button
            size="sm"
            onClick={() => onToggleCapability?.(action.label)}
            variant={capabilityStates[action.label] ? undefined : "ghost"}
            className={`h-7 w-7 p-0 flex items-center justify-center ${capabilityStates[action.label] ? "bg-primary/90" : "bg-muted"}`}
            aria-pressed={!!capabilityStates[action.label]}
            title={capabilityStates[action.label] ? `Desactivar ${action.label}` : `Activar ${action.label}`}
          >
            {capabilityStates[action.label] ? <Check className="h-3 w-3 text-white" /> : <X className="h-3 w-3 text-white" />}
          </Button>
        </div>
      ))}

      {/* TTS female toggle */}
      <div className="ml-2 flex items-center gap-2">
        <Button size="sm" variant="outline" className="text-xs" disabled>
          Voz
        </Button>
        <Button
          size="sm"
          onClick={() => onToggleTts?.()}
          className={`h-7 w-14 p-0 flex items-center justify-center ${ttsFemale ? "bg-blue-500 text-white" : "bg-muted text-white"}`}
          title={ttsFemale ? "Modo voz activado" : "Voz femenina desactivada"}
        >
          {ttsFemale ? (
            <span className="text-[11px] leading-tight">modo voz</span>
          ) : (
            "Off"
          )}
        </Button>
      </div>
    </div>
  )
}
