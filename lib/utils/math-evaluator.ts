export class MathEvaluator {
  private static readonly MATH_PATTERNS = [
    /\d+\s*[+\-*/x×÷]\s*\d+/,
    /cuanto es (.*)\?/i,
    /calcula (.*)/i,
    /resultado de (.*)/i,
    /\d+\s*\^\s*\d+/,
  ]

  static containsMathExpression(text: string): boolean {
    return this.MATH_PATTERNS.some((pattern) => pattern.test(text))
  }

  static evaluateExpression(expr: string): string | null {
    try {
      const cleanExpr = expr
        .replace(/×/g, "*")
        .replace(/x/g, "*")
        .replace(/÷/g, "/")
        .replace(/\^/g, "**")
        .replace(/[^0-9+\-*/.() ]/g, "")

      if (cleanExpr) {
        const result = Function(`"use strict"; return (${cleanExpr})`)()
        if (typeof result === "number" && !isNaN(result)) {
          return Number.isInteger(result) ? result.toString() : result.toFixed(4)
        }
      }
    } catch {
      return null
    }
    return null
  }

  static extractMathExpression(text: string): string {
    const mathMatch = text.match(/(?:cuanto es|calcula|resultado de)\s*(.*?)\??$/i)
    return mathMatch ? mathMatch[1] : text
  }
}
