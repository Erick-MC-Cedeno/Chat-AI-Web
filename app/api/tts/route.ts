import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const TTS_PROVIDER = (process.env.TTS_PROVIDER || "coqui").toLowerCase()
  const TTS_ENDPOINT = process.env.TTS_ENDPOINT || "http://localhost:5002/api/tts"
  const TTS_VOICE = process.env.TTS_VOICE || "multilingual"
  const TTS_MODEL = process.env.TTS_MODEL || process.env.TTS_VOICE_MODEL || null

  try {
    const body = await request.json().catch(() => ({}))
    const text = typeof body.text === "string" ? body.text : body?.message
    if (!text) return NextResponse.json({ error: "'text' is required" }, { status: 400 })

    if (TTS_PROVIDER === "coqui") {
      const langHint = (body.lang as string) || (body.locale as string) || null
      const voiceToUse = (body.voice as string) || (langHint === 'es' ? process.env.TTS_VOICE_ES || TTS_VOICE : TTS_VOICE)
      const modelToUse = (body.model as string) || TTS_MODEL

      const preprocessTextForTTS = (t: string, langHint?: string) => {
        let out = String(t || "").trim()
        out = out.normalize("NFC")
        out = out.replace(/\s+/g, " ")
        if (!/[.!?…]$/.test(out)) out = out + "."
        return out
      }

      const numberToSpanish = (function () {
        const unidades = ["cero","uno","dos","tres","cuatro","cinco","seis","siete","ocho","nueve","diez","once","doce","trece","catorce","quince","dieciseis","diecisiete","dieciocho","diecinueve","veinte"]
        const decenas = ["", "", "veinte", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"]
        const centenas = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"]

        function toWords(n: number): string {
          if (n < 0) return `menos ${toWords(Math.abs(n))}`
          if (n <= 20) return unidades[n]
          if (n < 30) return `veinti${unidades[n - 20]}`
          if (n < 100) {
            const d = Math.floor(n / 10)
            const u = n % 10
            return u === 0 ? decenas[d] : `${decenas[d]} y ${unidades[u]}`
          }
          if (n === 100) return "cien"
          if (n < 1000) {
            const c = Math.floor(n / 100)
            const rest = n % 100
            return rest === 0 ? centenas[c] : `${centenas[c]} ${toWords(rest)}`
          }
          if (n < 1000000) {
            const miles = Math.floor(n / 1000)
            const rest = n % 1000
            const milesText = miles === 1 ? "mil" : `${toWords(miles)} mil`
            return rest === 0 ? milesText : `${milesText} ${toWords(rest)}`
          }
          if (n < 1000000000000) {
            const millones = Math.floor(n / 1000000)
            const rest = n % 1000000
            const millonesText = millones === 1 ? "un millón" : `${toWords(millones)} millones`
            return rest === 0 ? millonesText : `${millonesText} ${toWords(rest)}`
          }
          return String(n)
        }

        return (s: string) => {
          const currencyReplacer = (str: string) => {
            return str.replace(/\$\s?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?)/g, (_, num) => {
              const clean = num.replace(/,/g, '')
              if (clean.includes('.') || clean.includes(',')) {
                const parts = clean.replace(/,/g, '.').split('.')
                const whole = parseInt(parts[0], 10)
                const cents = parts[1] ? parts[1].slice(0,2).padEnd(2,'0') : '00'
                return `${toWords(whole)} dólares con ${toWords(parseInt(cents,10))} centavos`
              }
              return `${toWords(parseInt(clean,10))} dólares`
            })
          }

          let out = s.replace(/\b\d{1,12}\b/g, (m) => {
            try { const n = parseInt(m, 10); return isNaN(n) ? m : toWords(n) } catch { return m }
          })
          out = currencyReplacer(out)
          out = out.replace(/\b(\d+)[.,](\d+)\b/g, (_, whole, frac) => {
            if (frac.length === 2) {
              try { return `${toWords(parseInt(whole,10))} con ${toWords(parseInt(frac.slice(0,2),10))}` } catch { return `${whole} coma ${frac}` }
            }
            return `${toWords(parseInt(whole,10))} coma ${frac.split('').map((d: string) => unidades[parseInt(d,10)]).join(' ')} `
          })
          return out
        }
      })()

      const preprocessed = preprocessTextForTTS(text, langHint || undefined)
      const preprocessedWithNumbers = (langHint && String(langHint).toLowerCase().startsWith("es")) ? numberToSpanish(preprocessed) : preprocessed

      const payload: any = { text: preprocessedWithNumbers, voice: voiceToUse }
      if (modelToUse) payload.model = modelToUse

      const wantsSSML = Boolean(body.ssml) || (langHint && String(langHint).toLowerCase().startsWith("es"))
      if (wantsSSML) {
        const len = preprocessedWithNumbers.length

        const preset = ((body.preset || body.style) && String(body.preset || body.style).toLowerCase()) || 'default'

        let rate = len < 80 ? '+95%' : (len < 240 ? '+98%' : '+100%')
        let pitch = '+0st'

        if (preset === 'natural') {
          rate = len < 80 ? '+92%' : (len < 240 ? '+96%' : '+98%')
          pitch = '+2st'
        } else if (preset === 'robotic') {
          rate = '+98%'
          pitch = '-3st'
        }

        if (body.rate && typeof body.rate === 'string') rate = body.rate
        if (body.pitch && typeof body.pitch === 'string') pitch = body.pitch

        payload.rate = rate
        payload.pitch = pitch
      }

      let res: Response
      const timeoutMs = Number(process.env.TTS_FETCH_TIMEOUT_MS || "5000")
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

      try {
        res = await fetch(TTS_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "audio/*" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        })
      } catch (fetchErr: any) {
        clearTimeout(timeoutId)

        const isAggregate = typeof AggregateError !== "undefined" && fetchErr instanceof AggregateError
        const innerErr = isAggregate && Array.isArray((fetchErr as any).errors) ? (fetchErr as any).errors[0] : null
        const code = fetchErr?.code || innerErr?.code || null
        const shortMessage = innerErr?.message || fetchErr?.message || String(fetchErr)

        if (process.env.TTS_DEBUG === "1") {
          console.warn(`/api/tts: fetch to ${TTS_ENDPOINT} failed`, code ? { code, message: shortMessage } : shortMessage)
        }

        return NextResponse.json({
          fallbackToClient: true,
          error: "Could not connect to TTS provider",
          detail: shortMessage,
          code,
          hint: `Ensure your TTS server is running and reachable at ${TTS_ENDPOINT}. If you intended to use a local Coqui/OpenTTS server, start it or set TTS_ENDPOINT to a reachable service.`,
        }, { status: 200 })
      } finally {
        try { clearTimeout(timeoutId) } catch (e) { }
      }

      if (!res.ok) {
        const ct = res.headers.get("content-type") || ""
        if (ct.includes("application/json")) {
          const err = await res.json().catch(() => null)
          return NextResponse.json({ fallbackToClient: true, error: "TTS provider error", detail: err }, { status: 200 })
        }
        const txt = await res.text().catch(() => "")
        return NextResponse.json({ fallbackToClient: true, error: `TTS provider error: ${res.status} ${txt}` }, { status: 200 })
      }

      const contentType = res.headers.get("content-type") || ""
      const arrayBuffer = await res.arrayBuffer()
      const base64 = Buffer.from(arrayBuffer).toString("base64")

      return NextResponse.json({ audioBase64: base64, contentType })
    }

    return NextResponse.json({ error: "Unsupported TTS_PROVIDER. Configure TTS_PROVIDER=coqui or implement another provider." }, { status: 501 })
  } catch (err: any) {
    console.error("/api/tts error", err)
    return NextResponse.json({ error: err?.message || "unknown" }, { status: 500 })
  }
}