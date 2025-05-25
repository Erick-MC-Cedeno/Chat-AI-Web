import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

interface ErrorAlertProps {
  error: string
}

export function ErrorAlert({ error }: ErrorAlertProps) {
  return (
    <Alert className="mb-4 border-red-200 bg-red-50">
      <AlertCircle className="h-4 w-4 text-red-600" />
      <AlertDescription className="text-red-800">{error}</AlertDescription>
    </Alert>
  )
}
