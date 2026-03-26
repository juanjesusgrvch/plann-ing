# Strategic Planner 📋

Una aplicación moderna de gestión de tareas con inteligencia artificial integrada, construida con React, TypeScript y Tailwind CSS.

## 🚀 Características

- **📅 Calendario Interactivo**: Visualiza y gestiona tareas en un calendario mensual
- **🎤 Entrada de Voz**: Dicta tareas directamente usando el reconocimiento de voz (soporte en Chrome/Edge)
- **🤖 IA Integrada (Gemini)**:
  - Análisis automático de productividad
  - Desglose inteligente de tareas
  - Extracción de tareas desde texto de voz
- **📊 Dashboard Estratégico**: Métricas y reportes en tiempo real
- **📁 Gestión de Backlog**: Tareas sin fecha asignada
- **📝 Lista Lineal**: Vista tabular de todas las tareas
- **⚡ Drag & Drop**: Arrastra tareas entre fechas
- **📄 Exportación a PDF**: Genera reportes del dashboard
- **🎯 Prioridades**: Clasifica tareas por Alta, Media o Baja
- **✅ Tracking de Completación**: Marca tareas como completadas

## 📦 Instalación

### Requisitos

- Node.js 18+
- npm o yarn

### Pasos de Configuración

1. **Clona o descarga el proyecto**

```bash
cd PLANNER
```

2. **Instala las dependencias**

```bash
npm install
```

3. **Configura la API de Gemini**
   - Copia `.env.example` a `.env.local`:

   ```bash
   cp .env.example .env.local
   ```

   - Obtén tu clave de API en [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Pega tu clave en `VITE_GEMINI_API_KEY` en el archivo `.env.local`

4. **Inicia el servidor de desarrollo**

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`

## 🏗️ Estructura del Proyecto

```
PLANNER/
├── src/
│   ├── App.tsx           # Componente principal
│   ├── main.tsx          # Punto de entrada
│   └── index.css         # Estilos globales
├── index.html            # HTML base
├── package.json          # Dependencias
├── tsconfig.json         # Configuración TypeScript
├── vite.config.ts        # Configuración Vite
├── tailwind.config.js    # Configuración Tailwind
├── postcss.config.js     # Configuración PostCSS
└── .env.example          # Variables de entorno (ejemplo)
```

## 🛠️ Desarrollo

### Comandos disponibles

```bash
# Inicia servidor de desarrollo
npm run dev

# Compila para producción
npm run build

# Vista previa de producción
npm run preview

# Lint del código
npm run lint
```

## 🔑 Configuración de Gemini API

La aplicación requiere una clave de API de Google Gemini para:

- Análisis de productividad
- Desglose automático de tareas
- Procesamiento de entrada de voz

### Cómo obtener la clave:

1. Ve a [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Haz clic en "Create API Key"
3. Copia la clave
4. Pégala en tu archivo `.env.local`

## 🎨 Tecnologías Utilizadas

- **React 18**: Biblioteca de UI
- **TypeScript**: Tipado estático
- **Tailwind CSS**: Estilos utilities
- **Vite**: Build tool moderno
- **Lucide React**: Iconos
- **html2pdf.js**: Exportación a PDF

## 📚 Uso

### Crear una Tarea

1. Haz clic en "Nueva Tarea" en el header
2. Completa el título (obligatorio)
3. Opcionalmente, agrega una descripción
4. Usa "✨ Desglosar con IA" para generar subtareas automáticamente
5. Asigna una fecha y prioridad
6. Haz clic en "Crear Tarea"

### Dictar Tareas con IA

1. Haz clic en "Dictar Tareas" (micrófono)
2. Habla claramente (en español)
3. La IA extrae automáticamente las tareas mencionadas
4. Las tareas se agregan al planificador

### Ver Dashboard

1. Navega a "Dashboard"
2. Visualiza tus métricas de productividad
3. Usa "Generar Análisis de Productividad" para obtener insights de IA
4. Exporta el dashboard a PDF

## ⚠️ Notas Importantes

- La función de entrada de voz funciona mejor en **Chrome** o **Edge**
- Se requiere una conexión a internet para usar las funciones de IA
- La API de Gemini tiene límites de uso según tu plan

## 📄 Licencia

Este proyecto es de código abierto. Úsalo libremente bajo los términos de la licencia MIT.

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Por favor, abre un issue o un pull request.

---

Desarrollado con ❤️ usando React + Tailwind + IA Gemini
