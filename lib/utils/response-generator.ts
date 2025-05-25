import { MathEvaluator } from "./math-evaluator"

export class ResponseGenerator {
  private static readonly RESPONSES = {
    greetings: [
      "¡Hola! Soy tu asistente inteligente. ¿En qué puedo ayudarte hoy?",
      "¡Hola! ¿Cómo estás? Estoy aquí para ayudarte.",
      "¡Saludos! ¿Qué te gustaría saber?",
    ],
    programming: [
      "Te puedo ayudar con programación. ¿Qué lenguaje o concepto te interesa? Puedo explicarte algoritmos, estructuras de datos, y mejores prácticas.",
      "La programación es fascinante. ¿Tienes alguna pregunta específica sobre código?",
      "Puedo explicarte conceptos de programación, algoritmos y estructuras de datos.",
    ],
    math: [
      "¡Perfecto! Puedo resolver operaciones matemáticas. Dime qué necesitas calcular.",
      "Las matemáticas son mi fuerte. ¿Qué operación quieres que resuelva?",
    ],
    default: [
      "Interesante pregunta. Basándome en mi entrenamiento, puedo ayudarte con programación, matemáticas y responder diversas consultas. ¿Podrías ser más específico?",
      "Esa es una buena pregunta. Te ayudo con eso.",
      "Entiendo lo que me preguntas. Aquí tienes mi respuesta:",
    ],
  }

  static async generateResponse(prompt: string): Promise<string> {
    // Simular delay de procesamiento
    await new Promise((resolve) => setTimeout(resolve, 1000))

    const lowerPrompt = prompt.toLowerCase()

    // Detectar expresiones matemáticas
    if (MathEvaluator.containsMathExpression(prompt)) {
      const mathExpr = MathEvaluator.extractMathExpression(prompt)
      const result = MathEvaluator.evaluateExpression(mathExpr)

      if (result !== null) {
        return `El resultado de ${mathExpr} es ${result}`
      }
      return "No pude calcular esa expresión matemática. ¿Podrías formularla de otra manera?"
    }

    // Detectar saludos
    if (lowerPrompt.includes("hola") || lowerPrompt.includes("buenos") || lowerPrompt.includes("saludos")) {
      return this.getRandomResponse("greetings")
    }

    // Detectar preguntas de programación
    if (this.isProgrammingQuery(lowerPrompt)) {
      return this.getRandomResponse("programming")
    }

    // Detectar preguntas matemáticas
    if (lowerPrompt.includes("matemática") || lowerPrompt.includes("calcular") || lowerPrompt.includes("número")) {
      return this.getRandomResponse("math")
    }

    // Respuesta por defecto
    return this.getRandomResponse("default")
  }

  private static isProgrammingQuery(text: string): boolean {
    const programmingKeywords = [
      "programar",
      "código",
      "javascript",
      "python",
      "react",
      "algoritmo",
      "función",
      "variable",
      "bucle",
      "array",
    ]
    return programmingKeywords.some((keyword) => text.includes(keyword))
  }

  private static getRandomResponse(category: keyof typeof ResponseGenerator.RESPONSES): string {
    const responses = this.RESPONSES[category]
    return responses[Math.floor(Math.random() * responses.length)]
  }
}
