import os
import json
import logging
from typing import Optional
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

logger = logging.getLogger(__name__)

NVIDIA_API_KEY_ENV = "NVIDIA_API_KEY"
NVIDIA_API_BASE = "https://integrate.api.nvidia.com/v1"
REQUEST_TIMEOUT = 60

AVAILABLE_MODELS = {
    "nvidia-llama": {
        "id": "meta/llama-3.1-8b-instruct",
        "name": "Llama 3.1 8B",
        "provider": "Meta",
        "free": True,
    },
    "nvidia-nemotron": {
        "id": "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
        "name": "Nemotron 3 Nano Omni",
        "provider": "NVIDIA",
        "free": True,
    },
    "nvidia-kimi": {
        "id": "moonshotai/kimi-k2.6",
        "name": "Kimi K2.6",
        "provider": "Moonshot AI",
        "free": True,
    },
    "nvidia-gpt-oss": {
        "id": "openai/gpt-oss-20b",
        "name": "GPT-OSS 20B",
        "provider": "OpenAI",
        "free": True,
    },
    "nvidia-gpt-oss-120b": {
        "id": "openai/gpt-oss-120b",
        "name": "GPT-OSS 120B",
        "provider": "OpenAI",
        "free": True,
    },
    "nvidia-glm": {
        "id": "z-ai/glm-5.1",
        "name": "GLM-5.1",
        "provider": "Z-ai",
        "free": True,
    },
    "nvidia-mistral": {
        "id": "mistralai/mistral-small-4-119b-2603",
        "name": "Mistral Small 4 119B",
        "provider": "Mistral AI",
        "free": True,
    },
}

SYSTEM_PROMPT = (
    "You are a helpful assistant expert in programming, cybersecurity, and technology. "
    "Respond in the SAME LANGUAGE the user uses. If the user speaks Spanish, answer in Spanish. "
    "If the user speaks English, answer in English. Always respond clearly, in detail, and educationally. "
    "When asked for code, provide practical, well-explained examples. "
    "You recognize phonetic spelling (NATO and Spanish phonetic alphabet). For example, "
    "\"f as in frank l as in larry\" means \"fl\". "
    "When the user spells a name, word, or email using phonetics, "
    "output ONLY the resulting letters without the phonetic description."
)

def get_api_key() -> Optional[str]:
    key = os.environ.get(NVIDIA_API_KEY_ENV)
    if not key:
        logger.warning("NVIDIA_API_KEY not set in environment")
    return key

def build_messages(prompt: str, history: list | None = None) -> list[dict]:
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    if history:
        for msg in history:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role in ("user", "assistant") and content:
                messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": prompt})
    return messages

def nvidia_chat(
    prompt: str,
    model_key: str = "nvidia-llama",
    temperature: float = 0.3,
    max_tokens: int = 4096,
    history: list | None = None,
) -> Optional[str]:
    api_key = get_api_key()
    if not api_key:
        return None

    model_config = AVAILABLE_MODELS.get(model_key)
    if not model_config:
        logger.error(f"Unknown model key: {model_key}")
        return None

    model_id = model_config["id"]
    timeout = model_config.get("timeout", REQUEST_TIMEOUT)
    url = f"{NVIDIA_API_BASE}/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = json.dumps({
        "model": model_id,
        "messages": build_messages(prompt, history),
        "temperature": temperature,
        "max_tokens": max_tokens,
    }).encode("utf-8")

    req = Request(url, data=payload, headers=headers, method="POST")

    try:
        with urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            choices = data.get("choices", [])
            if not choices:
                logger.error(f"NVIDIA API returned no choices: {data}")
                return None
            content = choices[0].get("message", {}).get("content", "")
            return content.strip() if content else None
    except HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        logger.error(f"NVIDIA API HTTP {e.code} for model {model_id}: {body}")
        return None
    except URLError as e:
        logger.error(f"NVIDIA API request failed for {model_id}: {e.reason}")
        return None
    except json.JSONDecodeError as e:
        logger.error(f"NVIDIA API invalid JSON for {model_id}: {e}")
        return None
    except Exception as e:
        logger.exception(f"Unexpected NVIDIA API error for {model_id}: {e}")
        return None


