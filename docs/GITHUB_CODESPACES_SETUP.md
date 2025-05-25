# Configuración para GitHub Codespaces

## 🚀 Configuración actual

La aplicación está configurada para conectarse con tu API Flask en GitHub Codespaces:

**URL de la API Flask:** `https://fictional-space-waddle-9rq7959q47v2954q-8000.app.github.dev`

## 📋 Pasos para verificar la conexión

### 1. Verificar que Flask esté ejecutándose
\`\`\`bash
# En tu terminal de Codespaces
python app.py
\`\`\`

### 2. Verificar que el puerto esté expuesto
- Ve a la pestaña "PORTS" en VS Code
- Asegúrate de que el puerto 8000 esté listado y sea público
- La URL debería ser: `https://fictional-space-waddle-9rq7959q47v2954q-8000.app.github.dev`

### 3. Probar la API directamente
\`\`\`bash
curl -X POST https://fictional-space-waddle-9rq7959q47v2954q-8000.app.github.dev/chat 
  -H "Content-Type: application/json" \
  -d '{"message": "Hola"}'
\`\`\`

### 4. Verificar CORS en Flask
Tu archivo Flask debería tener:
\`\`\`python
from flask_cors import CORS
app = Flask(__name__)
CORS(app, origins=["https://fictional-space-waddle-9rq7959q47v2954q-8000.app.github.dev"])
\`\`\`

## 🔧 Solución de problemas

### Error de CORS
Si ves errores de CORS, actualiza tu Flask app:
\`\`\`python
CORS(app, origins=["*"])  # Para desarrollo
\`\`\`

### Puerto no accesible
1. Ve a la pestaña "PORTS" en VS Code
2. Click derecho en el puerto 8000
3. Selecciona "Port Visibility" → "Public"

### API no responde
1. Verifica que Flask esté ejecutándose: `ps aux | grep python`
2. Verifica los logs de Flask en la terminal
3. Prueba acceder directamente a la URL en el navegador

## 📊 Estado de la conexión

La aplicación muestra el estado de conexión en tiempo real:
- 🟢 Verde: Conectado correctamente
- 🟡 Amarillo: Verificando conexión
- 🔴 Rojo: Error de conexión

## 🔄 Actualizar URL

Si tu URL de Codespaces cambia, actualiza:
1. `lib/services/chatbot-api.ts`
2. `app/api/model/route.ts`
3. `lib/config/api.ts`
