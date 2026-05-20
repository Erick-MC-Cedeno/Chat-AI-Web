"use client"

import { Languages, ArrowLeftRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const LANGUAGES = ["English", "Spanish"] as const

interface LanguageBarProps {
  sourceLang: string
  targetLang: string
  onSourceChange: (lang: string) => void
  onTargetChange: (lang: string) => void
  onSwap: () => void
}

export function LanguageBar({ sourceLang, targetLang, onSourceChange, onTargetChange, onSwap }: LanguageBarProps) {
  return (
    <div className="flex items-center justify-center gap-3 py-2.5 px-4 bg-card/20 border-b border-border/60">
      <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 mr-2">
        <Languages className="w-3.5 h-3.5 text-emerald-400" />
        <span className="text-[11px] font-medium text-emerald-400">Interpreter</span>
      </div>

      <div className="w-36">
        <Select value={sourceLang} onValueChange={onSourceChange}>
          <SelectTrigger className="h-8 text-xs bg-card/50 border-border/60 rounded-lg">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((lang) => (
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

      <div className="w-36">
        <Select value={targetLang} onValueChange={onTargetChange}>
          <SelectTrigger className="h-8 text-xs bg-card/50 border-border/60 rounded-lg">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((lang) => (
              <SelectItem key={lang} value={lang} className="text-xs">
                {lang}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
