"use client"

import { MobileSidebarToggle } from "./mobile-sidebar-toggle"
import { ConnectionStatus } from "./connection-status"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Bot, Cpu, Sparkles, Languages, ArrowLeftRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MODEL_OPTIONS } from "@/types/chat"
import type { Conversation, ModelType } from "@/types/chat"

interface ChatHeaderProps {
  connectionError: string | null
  conversations: Conversation[]
  currentConversationId: string | null
  selectedModel: ModelType
  onModelChange: (model: ModelType) => void
  onNewConversation: (title?: string) => void
  onSwitchConversation: (id: string) => void
  onDeleteConversation: (id: string) => void
  onUpdateTitle: (id: string, title: string) => void
  showLanguageBar?: boolean
  sourceLang?: string
  targetLang?: string
  onSourceChange?: (lang: string) => void
  onTargetChange?: (lang: string) => void
  onSwap?: () => void
}

const modelIcons: Record<string, typeof Bot> = {
  local: Bot,
  "nvidia-llama": Cpu,
  "nvidia-nemotron": Cpu,
  "nvidia-kimi": Cpu,
  "nvidia-gpt-oss": Cpu,
  "nvidia-gpt-oss-120b": Cpu,
  "nvidia-glm": Cpu,
  "nvidia-mistral": Cpu,
}

const modelAccentColors: Record<string, string> = {
  local: "from-blue-500 to-purple-600",
  "nvidia-llama": "from-emerald-500 to-teal-600",
  "nvidia-nemotron": "from-cyan-500 to-blue-600",
  "nvidia-kimi": "from-fuchsia-500 to-purple-700",
  "nvidia-gpt-oss": "from-sky-500 to-indigo-600",
  "nvidia-gpt-oss-120b": "from-indigo-500 to-violet-700",
  "nvidia-glm": "from-amber-500 to-orange-600",
  "nvidia-mistral": "from-yellow-500 to-amber-600",
}

function ModelTrigger({ value }: { value: ModelType }) {
  const opt = MODEL_OPTIONS.find((o) => o.value === value)
  const Icon = modelIcons[value] || Bot
  const gradient = modelAccentColors[value] || "from-blue-500 to-purple-600"
  const isNvidia = value.startsWith("nvidia-")

  return (
    <div className="flex items-center gap-3 min-w-0">
      <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-sm shrink-0`}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <div className="flex flex-col leading-tight min-w-0 mr-auto">
        <span className="text-xs font-medium text-foreground truncate">{opt?.label || "Modelo"}</span>
        <span className="text-[10px] text-muted-foreground">{isNvidia ? "NVIDIA Cloud" : "Local"}</span>
      </div>
      {isNvidia && (
        <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-[10px] font-semibold text-emerald-500 border border-emerald-500/20 uppercase tracking-wider shrink-0 whitespace-nowrap">
          Gratis
        </span>
      )}
    </div>
  )
}

export function ChatHeader({
  connectionError,
  conversations,
  currentConversationId,
  selectedModel,
  onModelChange,
  onNewConversation,
  onSwitchConversation,
  onDeleteConversation,
  onUpdateTitle,
  showLanguageBar,
  sourceLang,
  targetLang,
  onSourceChange,
  onTargetChange,
  onSwap,
}: ChatHeaderProps) {
  return (
    <div className="flex items-center justify-between py-3 px-4 bg-popover/80 backdrop-blur-sm border-b border-border">
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <MobileSidebarToggle
          conversations={conversations}
          currentConversationId={currentConversationId}
          onNewConversation={onNewConversation}
          onSwitchConversation={onSwitchConversation}
          onDeleteConversation={onDeleteConversation}
          onUpdateTitle={onUpdateTitle}
        />

        {showLanguageBar && (
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <Languages className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px] font-medium text-emerald-400">Interpreter</span>
            </div>

            <div className="w-32">
              <Select value={sourceLang} onValueChange={(v) => onSourceChange?.(v)}>
                <SelectTrigger className="h-8 text-xs bg-card/50 border-border/60 rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["English", "Spanish"].map((lang) => (
                    <SelectItem key={lang} value={lang} className="text-xs">
                      {lang}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button variant="ghost" size="icon" onClick={onSwap} className="h-7 w-7 rounded-full shrink-0">
              <ArrowLeftRight className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>

            <div className="w-32">
              <Select value={targetLang} onValueChange={(v) => onTargetChange?.(v)}>
                <SelectTrigger className="h-8 text-xs bg-card/50 border-border/60 rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["English", "Spanish"].map((lang) => (
                    <SelectItem key={lang} value={lang} className="text-xs">
                      {lang}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Select value={selectedModel} onValueChange={(v) => onModelChange(v as ModelType)}>
          <SelectTrigger className="w-auto min-w-[200px] h-10 px-3 border-border/60 bg-card/50 hover:bg-card/80 hover:border-border transition-all duration-200 rounded-xl shadow-sm">
            <SelectValue>
              <ModelTrigger value={selectedModel} />
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="p-1.5 rounded-xl border-border/50 shadow-xl min-w-[220px]">
            {MODEL_OPTIONS.map((opt) => {
              const Icon = modelIcons[opt.value] || Bot
              const gradient = modelAccentColors[opt.value] || "from-blue-500 to-purple-600"
              const isNvidia = opt.value.startsWith("nvidia-")
              const isSelected = opt.value === selectedModel

              return (
                <SelectItem
                  key={opt.value}
                  value={opt.value}
                  className={`rounded-lg py-3 px-3 cursor-pointer transition-all duration-150 mb-0.5 last:mb-0 ${
                    isSelected
                      ? "bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 shadow-sm"
                      : "hover:bg-accent/50 border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-sm shrink-0`}>
                      <Icon className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground truncate">{opt.label}</span>
                        {isSelected && (
                          <Sparkles className="h-3 w-3 text-primary shrink-0" />
                        )}
                        {isNvidia && (
                          <span className="ml-auto px-2 py-0.5 rounded-full bg-emerald-500/10 text-[10px] font-semibold text-emerald-500 border border-emerald-500/20 uppercase tracking-wider shrink-0 whitespace-nowrap">
                            Gratis
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground truncate mt-0.5">{opt.description}</span>
                    </div>
                  </div>
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
        <ConnectionStatus connectionError={connectionError} />
      </div>
    </div>
  )
}
