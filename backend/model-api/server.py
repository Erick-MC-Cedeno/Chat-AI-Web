# -*- coding: utf-8 -*-
from flask import Flask, request, jsonify
from flask_cors import CORS  # <-- Importación añadida
import numpy as np
import tensorflow as tf
from tensorflow.keras.preprocessing.sequence import pad_sequences
import pickle
import json
import re
import spacy
import math
from collections import OrderedDict

# -------------------- CONFIG --------------------
MAX_LEN = 80
VOCAB_SIZE = 10000
OOV_TOKEN = "<OOV>"

# -------------------- CARGAR RECURSOS --------------------
with open("tokenizer.pkl", "rb") as f:
    tokenizer = pickle.load(f)

with open("response_map.json", "r", encoding="utf-8") as f:
    resp2idx = json.load(f)
    distinct_responses = [None] * len(resp2idx)
    for r, i in resp2idx.items():
        distinct_responses[int(i)] = r

with open("data.json", "r", encoding="utf-8") as f:
    data = json.load(f)["conversations"]

model = tf.keras.models.load_model("chatbot_model_final.keras")
nlp = spacy.load("es_core_news_sm")
oov_index = tokenizer.word_index.get(OOV_TOKEN, 1)
memory = OrderedDict()

# -------------------- FUNCIONES --------------------
def normalize_text(text):
    doc = nlp(text.lower())
    tokens = [t.lemma_ for t in doc if t.is_alpha]
    return ' '.join(tokens)

def contains_math_expression(text):
    patterns = [
        r'\d+\s*[\+\-\*/x×÷]\s*\d+',
        r'cuanto es (.*)\?',
        r'calcula (.*)',
        r'resultado de (.*)',
        r'\d+\s*\^\s*\d+',
        r'raiz cuadrada de \d+',
        r'\d+\s*!'
    ]
    return any(re.search(p, text.lower()) for p in patterns)

def evaluate_math_expression(expr):
    try:
        expr = expr.replace("×", "*").replace("x", "*").replace("÷", "/").replace("^", "**")
        expr = re.sub(r"[^0-9+\-*/.()^ ]", "", expr)
        result = eval(expr, {"__builtins__": None}, {"math": math})
        return float(result) if isinstance(result, (int, float)) else result
    except:
        return None

def generate_response(user_text):
    if contains_math_expression(user_text):
        expr = re.search(r'(?:cuanto es|calcula|resultado de)\s*(.*?)\??$', user_text.lower())
        math_expr = expr.group(1) if expr else user_text
        result = evaluate_math_expression(math_expr)
        if result is not None:
            result = int(result) if isinstance(result, float) and result.is_integer() else round(result, 4)
            return f"El resultado de {math_expr} es {result}"
        return "No pude calcular esa expresion matematica. Podrias formularla de otra manera?"

    normalized = normalize_text(user_text)
    seq = tokenizer.texts_to_sequences([normalized])[0]
    if not seq:
        return "Lo siento, no te entendi."

    oov_ratio = sum(1 for i in seq if i == oov_index) / len(seq)
    if oov_ratio > 0.4:
        return "No entendi bien. Podrias decirlo de otra forma?"

    padded = pad_sequences([seq], maxlen=MAX_LEN, padding='post')
    pred = model.predict(padded, verbose=0)[0]
    top_index = np.argmax(pred)
    top_response = distinct_responses[top_index]

    for conv in data:
        if conv['completion'] == top_response:
            if conv.get("intent") == "programacion":
                example = conv.get("examples", [])
                if example:
                    return f"{top_response}\nEjemplo:\n{example[0]}"
            break

    return top_response

# -------------------- FLASK --------------------
app = Flask(__name__)
CORS(app, origins=["https://solid-spork-v9g6vrvgqr9fpp54-3000.app.github.dev"])  # <-- CORS habilitado

@app.route("/chat", methods=["POST"])
def chat():
    data_json = request.get_json()
    user_input = data_json.get("message", "")
    response = generate_response(user_input)
    return jsonify({"response": response})

if __name__ == "__main__":
    app.run(debug=True, port=8000)
