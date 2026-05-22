"use client"

const PHONETIC_WORDS: Record<string, string> = {
  // NATO / English
  alpha: "a", adam: "a", alfa: "a",
  bravo: "b", boy: "b", baker: "b",
  charlie: "c", charles: "c",
  delta: "d", david: "d", dog: "d",
  echo: "e", edward: "e",
  foxtrot: "f", frank: "f", fox: "f",
  golf: "g", george: "g",
  hotel: "h", henry: "h",
  india: "i", ida: "i", item: "i",
  juliet: "j", juliett: "j", john: "j",
  kilo: "k", king: "k",
  lima: "l", larry: "l", love: "l",
  mike: "m", mary: "m", mother: "m",
  november: "n", nancy: "n",
  oscar: "o", otto: "o",
  papa: "p", peter: "p",
  quebec: "q", queen: "q",
  romeo: "r", robert: "r",
  sierra: "s", sam: "s", sugar: "s",
  tango: "t", tom: "t", thomas: "t",
  uniform: "u", union: "u", uncle: "u",
  victor: "v",
  whiskey: "w", william: "w", whisky: "w",
  "x-ray": "x", xray: "x",
  yankee: "y", yellow: "y", york: "y",
  zulu: "z", zebra: "z",
  // Spanish
  antonio: "a", ana: "a",
  barcelona: "b", beatriz: "b",
  carmen: "c",
  dolores: "d", daniel: "d",
  españa: "e", enrique: "e",
  francia: "f", federico: "f",
  granada: "g",
  historia: "h",
  italia: "i",
  josé: "j", jose: "j",
  madrid: "m", maría: "m", maria: "m",
  navarra: "n",
  oso: "o",
  paris: "p",
  quito: "q",
  roma: "r", ramón: "r", ramon: "r",
  sabana: "s",
  toledo: "t",
  uruguay: "u", ulises: "u",
  valencia: "v",
  washington: "w",
  xilófono: "x", xilofono: "x",
  yegua: "y",
  zaragoza: "z",
}

const SEPARATORS = ["as in", "as", "for", "like", "de", "como"]

function buildPattern(): RegExp {
  const sep = SEPARATORS.map((s) => s.replace(/ /g, "\\s+")).join("|")
  const words = Object.keys(PHONETIC_WORDS).sort((a, b) => b.length - a.length).join("|")
  return new RegExp(`\\b([a-z])\\s+(${sep})\\s+(${words})\\b`, "gi")
}

const PHONETIC_PATTERN = buildPattern()

const COMMON_SPECIAL: [RegExp, string][] = [
  [/\b(?:arroba|at\s+the\s+rate)\b/gi, "@"],
  [/\bpunto\b/gi, "."],
  [/\b(?:guion|dash|hyphen)\b/gi, "-"],
  [/\b(?:guion\s+bajo|underscore)\b/gi, "_"],
  [/\b(?:barra\s+(?:baja|alta)?|slash)\b/gi, "/"],
  [/\bdoble\s+u\b/gi, "w"],
  [/\b(?:punto\s+com|dot\s+com)\b/gi, ".com"],
  [/\barroba\b/gi, "@"],
]

export function resolvePhonetic(text: string): string {
  let result = text

  // 1. Resolve phonetic alphabet references: "f as in frank" → "f"
  result = result.replace(PHONETIC_PATTERN, (_match, letter: string, _sep: string, word: string) => {
    const lowerWord = word.toLowerCase()
    const mapped = PHONETIC_WORDS[lowerWord]
    if (mapped === letter.toLowerCase()) {
      return letter.toLowerCase()
    }
    return _match
  })

  // 2. Resolve common special words: "arroba" → "@", "punto" → "."
  for (const [pattern, replacement] of COMMON_SPECIAL) {
    result = result.replace(pattern, replacement)
  }

  // 3. Collapse spaces between single letters (likely from phonetic resolution)
  result = result.replace(/\b([a-z])\s+(?=[a-z]\b)/g, "$1")

  return result
}
