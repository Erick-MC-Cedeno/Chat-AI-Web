"use client"

import { Button } from "@/components/ui/button"
import { Brain, Calculator, Sparkles } from "lucide-react"

interface QuickActionsProps {
  onActionClick: (text: string) => void
  disabled: boolean
}

export function QuickActions({ onActionClick, disabled }: QuickActionsProps) {
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
    {
      icon: Sparkles,
      label: "Capacidades",
      text: "¿Qué puedes hacer?",
    },
  ]

  return (
    <div className="flex gap-2 mt-3">
      {actions.map((action) => (
        <Button
          key={action.label}
          variant="outline"
          size="sm"
          onClick={() => onActionClick(action.text)}
          disabled={disabled}
          className="text-xs"
        >
          <action.icon className="h-3 w-3 mr-1" />
          {action.label}
        </Button>
      ))}
    </div>
  )
}
