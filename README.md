# Plann-ing — Dashboard y Planner de Tareas

Plann-ing es una aplicación moderna para gestionar tareas y tiempo, con sincronización en la nube y capacidades de IA (Gemini) para análisis y desgloses inteligentes.

## 🚀 Características principales

- 📅 Calendario interactivo con drag & drop
- 🎤 Entrada por voz para crear tareas rápidamente
- 🤖 Integración con Gemini para insights y generación de subtareas
- 📊 Dashboard con métricas y exportación a PDF
- ✅ Sincronización en tiempo real entre dispositivos vía Firebase

## 📦 Requisitos

- Node.js 18+
- npm o yarn

## Instalación rápida

1. Clona el repositorio y entra en la carpeta:

```bash
git clone https://github.com/juanjesusgrvch/plann-ing.git
cd plann-ing
```

2. Instala dependencias:

```bash
npm install
```

3. Configura las variables de entorno:

```bash
cp .env.example .env.local
# Edita .env.local y añade VITE_GEMINI_API_KEY y opcionalmente VITE_GEMINI_MODEL
```

4. Ejecuta en modo desarrollo:

```bash
npm run dev
```

La app estará disponible en `http://localhost:5173`.

## Configurar el modelo Gemini

En `.env.local` puedes definir el modelo con `VITE_GEMINI_MODEL`. Por defecto la app usa `gemini-2.5-flash-latest`.

Ejemplo:

```
VITE_GEMINI_API_KEY=tu_clave_aqui
VITE_GEMINI_MODEL=gemini-2.5-flash-latest
```

## Estructura del proyecto

```
plann-ing/
├─ src/
├─ public/
├─ dist/
├─ package.json
└─ README.md
```

## Comandos útiles

```bash
# Desarrollo
npm run dev

# Build producción
npm run build

# Vista previa
npm run preview
```

## Contribuciones

Las contribuciones son bienvenidas: abre issues o pull requests.

---

Creado por Juan Jesus con ❤️ — Plann-ing
