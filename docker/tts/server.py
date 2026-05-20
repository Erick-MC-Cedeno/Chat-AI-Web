import asyncio
import io
import json
import logging
import os
import re
import tempfile
import traceback
import unicodedata

import edge_tts
from flask import Flask, Response, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("tts-server")

VOICE_MAP = {
    "multilingual": "en-US-JennyNeural",
    "es": "es-ES-ElviraNeural",
    "es-ES": "es-ES-ElviraNeural",
    "es-MX": "es-MX-DaliaNeural",
    "en": "en-US-JennyNeural",
    "en-US": "en-US-JennyNeural",
    "en-GB": "en-GB-SoniaNeural",
    "female": "en-US-JennyNeural",
    "male": "en-US-GuyNeural",
    "spanish": "es-ES-ElviraNeural",
    "english": "en-US-JennyNeural",
}

DEFAULT_VOICE = "en-US-JennyNeural"


def resolve_voice(voice: str | None) -> str:
    if not voice:
        return DEFAULT_VOICE
    lower = voice.lower().strip()
    if lower in VOICE_MAP:
        return VOICE_MAP[lower]
    return voice


def number_to_spanish(s: str) -> str:
    unidades = [
        "cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete",
        "ocho", "nueve", "diez", "once", "doce", "trece", "catorce",
        "quince", "dieciseis", "diecisiete", "dieciocho", "diecinueve", "veinte",
    ]
    decenas = ["", "", "veinte", "treinta", "cuarenta", "cincuenta",
               "sesenta", "setenta", "ochenta", "noventa"]
    centenas = ["", "ciento", "doscientos", "trescientos", "cuatrocientos",
                "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"]

    def to_words(n: int) -> str:
        if n < 0:
            return f"menos {to_words(abs(n))}"
        if n <= 20:
            return unidades[n]
        if n < 30:
            return f"veinti{unidades[n - 20]}"
        if n < 100:
            d = n // 10
            u = n % 10
            return decenas[d] if u == 0 else f"{decenas[d]} y {unidades[u]}"
        if n == 100:
            return "cien"
        if n < 1000:
            c = n // 100
            r = n % 100
            return centenas[c] if r == 0 else f"{centenas[c]} {to_words(r)}"
        if n < 1_000_000:
            m = n // 1000
            r = n % 1000
            mt = "mil" if m == 1 else f"{to_words(m)} mil"
            return mt if r == 0 else f"{mt} {to_words(r)}"
        if n < 1_000_000_000_000:
            m = n // 1_000_000
            r = n % 1_000_000
            mt = "un millón" if m == 1 else f"{to_words(m)} millones"
            return mt if r == 0 else f"{mt} {to_words(r)}"
        return str(n)

    def replace_currency(t: str) -> str:
        return re.sub(
            r"\$\s?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?)",
            lambda m: _currency_to_words(m.group(1)),
            t,
        )

    def _currency_to_words(num: str) -> str:
        clean = num.replace(",", "")
        if "." in clean:
            parts = clean.split(".")
            whole = int(parts[0])
            cents = (parts[1] + "00")[:2]
            return f"{to_words(whole)} dólares con {to_words(int(cents))} centavos"
        return f"{to_words(int(clean))} dólares"

    out = re.sub(r"\b\d{1,12}\b", lambda m: to_words(int(m.group(0))), s)
    out = replace_currency(out)
    out = re.sub(
        r"\b(\d+)[.,](\d+)\b",
        lambda m: f"{to_words(int(m.group(1)))} con {to_words(int((m.group(2) + '00')[:2]))}",
        out,
    )
    return out


def preprocess_text(text: str, lang: str | None = None) -> str:
    out = str(text or "").strip()
    out = unicodedata.normalize("NFC", out)
    out = re.sub(r"\s+", " ", out)
    if not re.search(r"[.!?…]$", out):
        out += "."
    if lang and lang.lower().startswith("es"):
        out = number_to_spanish(out)
    return out


async def synthesize(voice: str, text: str) -> bytes:
    communicate = edge_tts.Communicate(text, voice)
    audio_data = b""
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio_data += chunk["data"]
    return audio_data


def get_lang_hint(text: str, voice: str) -> str | None:
    if voice.startswith("es"):
        return "es"
    return None


@app.route("/api/tts", methods=["POST"])
def tts_post():
    try:
        data = request.get_json(silent=True) or {}
        raw_text = data.get("text") or data.get("message") or ""
        if not raw_text:
            return Response(json.dumps({"error": "'text' is required"}), status=400, content_type="application/json")

        voice = resolve_voice(data.get("voice"))
        model = data.get("model")

        lang_hint = get_lang_hint(raw_text, voice)
        if model and model.lower() in VOICE_MAP:
            voice = resolve_voice(model)

        processed = preprocess_text(raw_text, lang_hint)
        use_ssml = data.get("use_ssml", False)
        ssml_text = data.get("ssml", "")

        final_text = ssml_text if use_ssml and ssml_text else processed

        audio_bytes = asyncio.run(synthesize(voice, final_text))

        return Response(audio_bytes, mimetype="audio/mpeg", headers={
            "Access-Control-Allow-Origin": "*",
        })

    except Exception as e:
        logger.error("TTS error: %s\n%s", e, traceback.format_exc())
        return Response(
            json.dumps({"error": str(e)}),
            status=500,
            content_type="application/json",
        )


@app.route("/api/voices", methods=["GET"])
def list_voices():
    return Response(
        json.dumps({"voices": list(VOICE_MAP.keys())}, ensure_ascii=False),
        content_type="application/json",
    )


@app.route("/health", methods=["GET"])
def health():
    return Response(json.dumps({"status": "ok"}), content_type="application/json")


if __name__ == "__main__":
    port = int(os.environ.get("TTS_PORT", "5002"))
    logger.info("Starting TTS server on port %d", port)
    app.run(host="0.0.0.0", port=port, debug=False)
