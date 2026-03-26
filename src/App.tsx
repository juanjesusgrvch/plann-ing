import React, { useState, useEffect, useMemo } from "react";
import {
  Calendar,
  List,
  Inbox,
  BarChart2,
  PlusCircle,
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  MoreVertical,
  Copy,
  Edit2,
  Trash2,
  GripVertical,
  Printer,
  Sparkles,
  Loader2,
  Mic,
} from "lucide-react";
import { User } from "firebase/auth";
import { LoginModal } from "./LoginModal";
import { UserProfile } from "./UserProfile";
import {
  onAuthStateChange,
  subscribeToUserTasks,
  addTaskToFirebase,
  updateTaskInFirebase,
  deleteTaskFromFirebase,
} from "./firebase";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Extender types de Window
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
    html2pdf: any;
  }
  interface ImportMeta {
    env: {
      VITE_GEMINI_API_KEY?: string;
      VITE_GEMINI_MODEL?: string;
      [key: string]: string | undefined;
    };
  }
}

// Tipos de datos
interface Task {
  id: string;
  title: string;
  description: string;
  date: string;
  priority: "Alta" | "Media" | "Baja";
  completed: boolean;
  userId?: string;
  createdAt?: number;
  updatedAt?: number;
}

// --- UTILIDADES DE FECHA ---
const today = new Date();

const getDaysInMonth = (month: number, year: number): number =>
  new Date(year, month + 1, 0).getDate();

const getFirstDayOfMonth = (month: number, year: number): number =>
  new Date(year, month, 1).getDay();

const formatDate = (dateString: string): string => {
  if (!dateString) return "";
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
  };
  return new Date(dateString).toLocaleDateString("es-AR", options);
};

const isOverdue = (dateString: string, completed: boolean): boolean => {
  if (!dateString || completed) return false;
  const taskDate = new Date(dateString);
  taskDate.setHours(0, 0, 0, 0);
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  return taskDate < todayDate;
};

// --- API DE GEMINI ---
const callGeminiAPI = async (prompt: string): Promise<string> => {
  const apiKey = (import.meta.env as any).VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "API key de Gemini no configurada. Por favor, configura VITE_GEMINI_API_KEY en tu archivo .env.local",
    );
  }

  // Usar el modelo configurado en .env.local o por defecto gemini-2.5-flash-latest
  const model =
    (import.meta.env as any).VITE_GEMINI_MODEL || "gemini-2.5-flash-latest";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    systemInstruction: {
      parts: [
        {
          text: "Eres un asistente experto en productividad corporativa y metodologías ágiles. Respondes siempre en español, de forma directa, altamente profesional y sin saludos innecesarios.",
        },
      ],
    },
  };

  let retries = 3;
  let delay = 2000; // Comenzar con 2 segundos

  while (retries > 0) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData?.error?.message || `Error ${response.status}`;
        throw new Error(`API de Gemini - ${errorMessage}`);
      }

      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } catch (error) {
      retries--;
      if (retries === 0) {
        const errorMsg =
          error instanceof Error ? error.message : "Error desconocido";
        throw new Error(
          `No se pudo conectar con Gemini (modelo: ${model}). ${errorMsg}. Intenta de nuevo más tarde.`,
        );
      }
      await new Promise((res) => setTimeout(res, delay));
      delay *= 2;
    }
  }
  return "";
};

// --- DATOS DE EJEMPLO ---
const initialTasks = [
  {
    id: "1",
    title: "FELIZ AÑO NUEVO",
    description: "Happy New Year",
    date: `01/01/2026`,
    priority: "Alta",
    completed: false,
  },
];

// --- COMPONENTES UI REUTILIZABLES ---
const Badge: React.FC<{ children: React.ReactNode; colorClass: string }> = ({
  children,
  colorClass,
}) => (
  <span
    className={`px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}
  >
    {children}
  </span>
);

const PriorityBadge: React.FC<{ priority: "Alta" | "Media" | "Baja" }> = ({
  priority,
}) => {
  const colors = {
    Alta: "bg-red-100 text-red-800 border border-red-200",
    Media: "bg-yellow-100 text-yellow-800 border border-yellow-200",
    Baja: "bg-blue-100 text-blue-800 border border-blue-200",
  };
  return (
    <Badge colorClass={colors[priority] || colors["Baja"]}>{priority}</Badge>
  );
};

const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = "",
}) => (
  <div
    className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden ${className}`}
  >
    {children}
  </div>
);

// --- APLICACIÓN PRINCIPAL ---
export default function App() {
  // Estado de Autenticación
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<string>("calendar");
  const [tasks, setTasks] = useState<Task[]>(initialTasks as Task[]);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [initialDateForNewTask, setInitialDateForNewTask] =
    useState<string>("");

  // Estado para Navegación de Meses en Calendario
  const [calendarMonth, setCalendarMonth] = useState<number>(today.getMonth());
  const [calendarYear, setCalendarYear] = useState<number>(today.getFullYear());

  // Estado para la Entrada de Voz
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState<boolean>(false);
  const [voiceFeedback, setVoiceFeedback] = useState<string>("");

  // Estado para Insights de IA (Dashboard)
  const [aiInsight, setAiInsight] = useState<string>("");
  const [isGeneratingInsight, setIsGeneratingInsight] =
    useState<boolean>(false);
  const [insightError, setInsightError] = useState<string>("");

  // Estado para el Modal de Día
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isDayModalOpen, setIsDayModalOpen] = useState<boolean>(false);

  // Monitorear cambios de autenticación y sincronizar tareas
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChange((user) => {
      setCurrentUser(user);
      setIsAuthLoading(false);

      // Si hay usuario, suscribirse a sus tareas en tiempo real
      if (user) {
        const unsubscribeTasks = subscribeToUserTasks(
          user.uid,
          (tasksFromDb) => {
            setTasks(tasksFromDb);
          },
        );

        // Cleanup: desuscribirse cuando el usuario se deslogea o cambia
        return () => {
          unsubscribeTasks();
        };
      } else {
        // Si no hay usuario, limpiar tareas
        setTasks([]);
      }
    });

    return unsubscribeAuth;
  }, []);

  // Funciones de manejo de tareas
  const addTask = async (
    newTask: Omit<Task, "id" | "userId" | "createdAt" | "updatedAt">,
  ) => {
    if (!currentUser) return;

    try {
      // Guardar en Firestore (retorna el ID)
      await addTaskToFirebase(newTask, currentUser.uid);
      // Las tareas se actualizarán automáticamente vía subscribeToUserTasks
      setActiveTab(newTask.date ? "calendar" : "inbox");
    } catch (error) {
      console.error("Error al crear tarea:", error);
      alert("Error al crear la tarea. Intenta nuevamente.");
    }
  };

  const updateTask = async (updatedTask: Task) => {
    if (!currentUser) {
      alert("Inicia sesión para actualizar tareas");
      return;
    }
    try {
      const { id, userId, createdAt, updatedAt, ...taskData } = updatedTask;
      await updateTaskInFirebase(id, taskData as any, currentUser.uid);
      // Las tareas se actualizarán automáticamente vía subscribeToUserTasks
    } catch (error) {
      console.error("Error al actualizar tarea:", error);
      alert("Error al actualizar la tarea. Intenta nuevamente.");
    }
  };

  const toggleTaskCompletion = async (taskId: string) => {
    if (!currentUser) {
      alert("Inicia sesión para cambiar el estado de tareas");
      return;
    }
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    try {
      await updateTaskInFirebase(
        taskId,
        { completed: !task.completed },
        currentUser.uid,
      );
    } catch (error) {
      console.error("Error al cambiar estado de tarea:", error);
    }
  };

  const deleteTask = async (taskId: string) => {
    if (!currentUser) {
      alert("Inicia sesión para eliminar tareas");
      return;
    }
    try {
      await deleteTaskFromFirebase(taskId, currentUser.uid);
    } catch (error) {
      console.error("Error al eliminar tarea:", error);
      alert("Error al eliminar la tarea. Intenta nuevamente.");
    }
  };

  const duplicateTask = async (task: Task) => {
    if (!currentUser) return;

    try {
      const newTask = {
        title: `${task.title} (Copia)`,
        description: task.description,
        date: task.date,
        priority: task.priority,
        completed: false,
      };
      await addTaskToFirebase(newTask, currentUser.uid);
    } catch (error) {
      console.error("Error al duplicar tarea:", error);
      alert("Error al duplicar la tarea. Intenta nuevamente.");
    }
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setActiveTab("add");
    setIsDayModalOpen(false);
  };

  // Drag & Drop Handlers
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, task: Task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDropToDate = (e: React.DragEvent, targetDateStr: string) => {
    e.preventDefault();
    if (draggedTask && draggedTask.date !== targetDateStr) {
      updateTask({ ...draggedTask, date: targetDateStr });
    }
    setDraggedTask(null);
  };

  const handleDropToBacklog = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedTask && draggedTask.date !== "") {
      updateTask({ ...draggedTask, date: "" });
    }
    setDraggedTask(null);
  };

  // --- LÓGICA DE RECONOCIMIENTO DE VOZ E IA ---
  const startListening = () => {
    const SpeechRecognition: any =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceFeedback(
        "Error: Tu navegador no soporta reconocimiento de voz (Usa Chrome/Edge).",
      );
      setTimeout(() => setVoiceFeedback(""), 4000);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "es-AR";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setVoiceFeedback("Escuchando... Habla ahora.");
    };

    recognition.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript;
      setIsListening(false);
      await processVoiceTranscript(transcript);
    };

    recognition.onerror = () => {
      setIsListening(false);
      setVoiceFeedback(`Error al escuchar: Intenta nuevamente.`);
      setTimeout(() => setVoiceFeedback(""), 3000);
    };

    recognition.start();
  };

  const processVoiceTranscript = async (transcript: string) => {
    setIsProcessingVoice(true);
    setVoiceFeedback(`Analizando: "${transcript}"...`);

    // Prompt estricto para extraer JSON
    const prompt = `Actúa como un asistente inteligente que extrae tareas de un texto dictado por voz.
    Hoy es ${today.toISOString().split("T")[0]}.
    Texto dictado por el usuario: "${transcript}"
    
    Extrae todas las tareas mencionadas y devuélvelas en un arreglo JSON estricto. 
    Ejemplo de salida esperada:
    [
      { "title": "Enviar reporte de ventas", "description": "Con los datos del último trimestre", "date": "2026-03-27", "priority": "Alta" }
    ]
    
    Reglas OBLIGATORIAS:
    1. 'title' debe ser el nombre de la acción a realizar.
    2. 'description' es opcional, úsalo para contexto adicional.
    3. 'date' debe ser en formato exacto "YYYY-MM-DD". Infiere la fecha usando la fecha de hoy como referencia (ej: si dice mañana, suma 1 día). Si no se menciona fecha explícita, usa un string vacío "".
    4. 'priority' debe ser exactamente "Alta", "Media" o "Baja". Infiérela por el tono o urgencia, por defecto usa "Media".
    5. Devuelve ÚNICAMENTE el texto JSON válido, sin bloques de markdown (\`\`\`json), sin saludos, solo el array [].`;

    try {
      const response = await callGeminiAPI(prompt);
      // Limpiamos posibles formatos markdown residuales que la IA pueda enviar
      const cleanJson = response
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();
      const newTasks = JSON.parse(cleanJson);

      if (Array.isArray(newTasks)) {
        const tasksToAdd = newTasks.map((t) => ({
          ...t,
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          completed: false,
        }));

        setTasks((prev) => [...prev, ...tasksToAdd]);
        setVoiceFeedback(
          `¡Genial! Se agregaron ${tasksToAdd.length} tareas al planificador.`,
        );
      } else {
        throw new Error("El formato devuelto no es un array.");
      }
    } catch (error) {
      console.error("Error procesando JSON de voz:", error);
      setVoiceFeedback(
        "No entendí bien las tareas. Por favor, intenta ser más directo.",
      );
    } finally {
      setTimeout(() => setVoiceFeedback(""), 4000);
      setIsProcessingVoice(false);
    }
  };

  // Componente de Tarjeta de Tarea Compartido
  const TaskItem: React.FC<{
    task: Task;
    isDraggable?: boolean;
    compact?: boolean;
  }> = ({ task, isDraggable = true, compact = false }) => {
    const [showMenu, setShowMenu] = useState<boolean>(false);
    const overdue = isOverdue(task.date, task.completed);

    return (
      <div
        draggable={isDraggable}
        onDragStart={(e) => handleDragStart(e, task)}
        className={`group relative flex flex-col gap-2 p-3 bg-white border ${overdue ? "border-red-300 bg-red-50/30" : "border-gray-200"} rounded-lg shadow-sm hover:shadow-md transition-all ${task.completed ? "opacity-60 bg-gray-50" : ""} ${isDraggable ? "cursor-grab active:cursor-grabbing" : ""}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            {isDraggable && (
              <GripVertical className="w-4 h-4 text-gray-400 mt-1 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            )}

            <button
              onClick={() => toggleTaskCompletion(task.id)}
              className="mt-0.5 shrink-0 text-gray-400 hover:text-green-600 transition-colors"
            >
              {task.completed ? (
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              ) : (
                <Circle className="w-5 h-5" />
              )}
            </button>

            <div className="flex flex-col min-w-0">
              <span
                className={`font-medium text-sm truncate text-gray-800 ${task.completed ? "line-through text-gray-500" : ""}`}
              >
                {task.title}
              </span>
              {!compact && task.description && (
                <span
                  className={`text-xs text-gray-500 line-clamp-2 mt-1 whitespace-pre-line ${task.completed ? "line-through" : ""}`}
                >
                  {task.description}
                </span>
              )}
            </div>
          </div>

          <div className="relative shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="p-1 text-gray-400 hover:text-gray-700 rounded-md hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-all"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showMenu && (
              <div
                className="absolute right-0 top-6 w-36 bg-white border border-gray-200 rounded-md shadow-lg z-20 py-1"
                onMouseLeave={() => setShowMenu(false)}
              >
                <button
                  onClick={() => {
                    duplicateTask(task);
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                >
                  <Copy className="w-4 h-4" /> Duplicar
                </button>
                <button
                  onClick={() => {
                    handleEditTask(task);
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                >
                  <Edit2 className="w-4 h-4" /> Editar
                </button>
                <button
                  onClick={() => {
                    deleteTask(task.id);
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" /> Eliminar
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between mt-1 pl-7">
          <PriorityBadge priority={task.priority} />
          {overdue && (
            <span className="flex items-center gap-1 text-xs text-red-600 font-medium bg-red-100 px-2 py-0.5 rounded-full">
              <AlertCircle className="w-3 h-3" /> Vencida
            </span>
          )}
        </div>
      </div>
    );
  };

  // --- VISTAS ---

  const goToPreviousMonth = () => {
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear(calendarYear - 1);
    } else {
      setCalendarMonth(calendarMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (calendarMonth === 11) {
      setCalendarMonth(0);
      setCalendarYear(calendarYear + 1);
    } else {
      setCalendarMonth(calendarMonth + 1);
    }
  };

  const goToToday = () => {
    setCalendarMonth(today.getMonth());
    setCalendarYear(today.getFullYear());
  };

  const CalendarView = () => {
    const daysInMonth = getDaysInMonth(calendarMonth, calendarYear);
    const firstDay = getFirstDayOfMonth(calendarMonth, calendarYear);
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const blanks = Array.from(
      { length: firstDay === 0 ? 6 : firstDay - 1 },
      (_, i) => i,
    );

    const monthName = new Date(calendarYear, calendarMonth).toLocaleString(
      "es-AR",
      { month: "long", year: "numeric" },
    );

    const isCurrentMonth =
      calendarMonth === today.getMonth() &&
      calendarYear === today.getFullYear();

    return (
      <div className="flex flex-col h-full">
        {/* Encabezado con navegación de meses */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex items-center justify-between">
            <button
              onClick={goToPreviousMonth}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600"
              aria-label="Mes anterior"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            <div className="flex-1 text-center">
              <h2 className="text-2xl md:text-3xl font-semibold text-gray-800 capitalize">
                {monthName}
              </h2>
            </div>

            <button
              onClick={goToNextMonth}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600"
              aria-label="Próximo mes"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          {!isCurrentMonth && (
            <div className="text-center">
              <button
                onClick={goToToday}
                className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                Volver a hoy
              </button>
            </div>
          )}
        </div>

        {/* Leyenda de prioridades - Responsiva */}
        <div className="hidden md:flex items-center gap-4 text-sm text-gray-500 mb-4">
          <span className="flex items-center gap-1">
            <Circle className="w-3 h-3 text-red-500 fill-red-500" /> Alta
            Prioridad
          </span>
          <span className="flex items-center gap-1">
            <Circle className="w-3 h-3 text-yellow-500 fill-yellow-500" /> Media
            Prioridad
          </span>
          <span className="flex items-center gap-1">
            <Circle className="w-3 h-3 text-blue-500 fill-blue-500" /> Baja
            Prioridad
          </span>
        </div>

        {/* Calendario - Responsivo */}
        <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg md:rounded-xl overflow-hidden shadow-sm flex-1 min-h-0">
          {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((day) => (
            <div
              key={day}
              className="bg-gray-50 py-1 md:py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              <span className="hidden md:inline">{day}</span>
              <span className="md:hidden">{day.substring(0, 1)}</span>
            </div>
          ))}

          {blanks.map((blank) => (
            <div
              key={`blank-${blank}`}
              className="bg-gray-50/50 min-h-[80px] md:min-h-[120px] p-1 md:p-2"
            />
          ))}

          {days.map((day) => {
            const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const dayTasks = tasks.filter((t) => t.date === dateStr);
            const isToday = dateStr === today.toISOString().split("T")[0];

            return (
              <div
                key={day}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDropToDate(e, dateStr)}
                onClick={() => {
                  setSelectedDate(dateStr);
                  setIsDayModalOpen(true);
                }}
                className={`bg-white min-h-[80px] md:min-h-[140px] p-1 md:p-2 border-t border-gray-100 transition-colors hover:bg-gray-50 cursor-pointer relative ${isToday ? "bg-blue-50/30" : ""}`}
              >
                <div className="flex justify-between items-start mb-1 md:mb-2">
                  <span
                    className={`text-xs md:text-sm font-medium w-6 h-6 md:w-7 md:h-7 flex items-center justify-center rounded-full ${isToday ? "bg-blue-600 text-white" : "text-gray-700"}`}
                  >
                    {day}
                  </span>
                  {dayTasks.length > 0 && (
                    <span className="text-xs text-gray-400 font-medium">
                      {dayTasks.length}
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-0.5 md:gap-1 overflow-y-auto max-h-[50px] md:max-h-[90px] no-scrollbar">
                  {dayTasks.slice(0, 2).map((task) => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => {
                        e.stopPropagation();
                        handleDragStart(e, task);
                      }}
                      className={`text-xs px-2 py-1 rounded truncate border ${
                        task.completed
                          ? "bg-gray-100 text-gray-500 line-through border-gray-200"
                          : task.priority === "Alta"
                            ? "bg-red-50 border-red-100 text-red-700"
                            : task.priority === "Media"
                              ? "bg-yellow-50 border-yellow-100 text-yellow-700"
                              : "bg-blue-50 border-blue-100 text-blue-700"
                      }`}
                    >
                      {task.title}
                    </div>
                  ))}
                  {dayTasks.length > 2 && (
                    <div className="text-xs text-gray-500 font-medium text-center py-0.5 md:py-1 bg-gray-50 rounded border border-gray-100">
                      +{dayTasks.length - 2} más
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal de Día */}
        {isDayModalOpen && (
          <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">
              <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <h3 className="text-lg font-semibold text-gray-800">
                  Tareas para el {selectedDate && formatDate(selectedDate)}
                </h3>
                <button
                  onClick={() => setIsDayModalOpen(false)}
                  className="text-gray-400 hover:text-gray-700 transition-colors"
                >
                  Cerrar
                </button>
              </div>
              <div className="p-6 overflow-y-auto flex-1 bg-gray-50/30">
                {tasks.filter((t) => t.date === selectedDate).length === 0 ? (
                  <div className="text-center py-8 text-gray-500 flex flex-col items-center">
                    <Clock className="w-12 h-12 text-gray-300 mb-3" />
                    <p>No hay tareas programadas para este día.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {tasks
                      .filter((t) => t.date === selectedDate)
                      .map((task) => (
                        <TaskItem key={task.id} task={task} />
                      ))}
                  </div>
                )}
              </div>
              <div className="p-4 border-t border-gray-100 bg-white">
                <button
                  onClick={() => {
                    setIsDayModalOpen(false);
                    setEditingTask(null);
                    setInitialDateForNewTask(selectedDate || "");
                    setActiveTab("add");
                  }}
                  className="w-full py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
                >
                  <PlusCircle className="w-4 h-4" /> Agregar Tarea Aquí
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const ListView = () => {
    const [filterPriority, setFilterPriority] = useState("All");
    const [filterStatus, setFilterStatus] = useState("All");

    const filteredTasks = tasks
      .filter((t) => {
        if (filterPriority !== "All" && t.priority !== filterPriority)
          return false;
        if (filterStatus === "Completed" && !t.completed) return false;
        if (filterStatus === "Pending" && t.completed) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        if (!a.date) return 1;
        if (!b.date) return -1;
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      });

    return (
      <div className="flex flex-col h-full">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold text-gray-800">
            Todas las Tareas
          </h2>
          <div className="flex gap-2">
            <select
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-gray-700 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
            >
              <option value="All">Prioridad: Todas</option>
              <option value="Alta">Alta</option>
              <option value="Media">Media</option>
              <option value="Baja">Baja</option>
            </select>
            <select
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-gray-700 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="All">Estado: Todos</option>
              <option value="Pending">Pendientes</option>
              <option value="Completed">Completadas</option>
            </select>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-gray-700 font-medium border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 w-12">Estado</th>
                <th className="px-6 py-3">Tarea</th>
                <th className="px-6 py-3 w-32">Fecha</th>
                <th className="px-6 py-3 w-32">Prioridad</th>
                <th className="px-6 py-3 w-16 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredTasks.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-gray-500"
                  >
                    No se encontraron tareas con estos filtros.
                  </td>
                </tr>
              ) : (
                filteredTasks.map((task) => {
                  const overdue = isOverdue(task.date, task.completed);
                  return (
                    <tr
                      key={task.id}
                      className={`hover:bg-gray-50/50 transition-colors ${task.completed ? "bg-gray-50" : ""}`}
                    >
                      <td className="px-6 py-4">
                        <button
                          onClick={() => toggleTaskCompletion(task.id)}
                          className="text-gray-400 hover:text-green-600 transition-colors"
                        >
                          {task.completed ? (
                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                          ) : (
                            <Circle className="w-5 h-5" />
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span
                            className={`font-medium text-gray-900 ${task.completed ? "line-through text-gray-500" : ""}`}
                          >
                            {task.title}
                          </span>
                          <span
                            className={`text-xs text-gray-500 line-clamp-1 mt-0.5 ${task.completed ? "line-through" : ""}`}
                          >
                            {task.description}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span
                            className={`font-medium ${task.completed ? "text-gray-400" : overdue ? "text-red-600" : "text-gray-700"}`}
                          >
                            {task.date ? (
                              formatDate(task.date)
                            ) : (
                              <span className="text-gray-400 italic">
                                Sin fecha
                              </span>
                            )}
                          </span>
                          {overdue && (
                            <span className="text-[10px] text-red-500 font-semibold uppercase tracking-wider mt-0.5">
                              Vencida
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <PriorityBadge priority={task.priority} />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEditTask(task)}
                            className="text-gray-400 hover:text-blue-600 p-1 rounded-md hover:bg-blue-50 transition-colors"
                            title="Editar Tarea"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteTask(task.id)}
                            className="text-gray-400 hover:text-red-600 p-1 rounded-md hover:bg-red-50 transition-colors"
                            title="Eliminar Tarea"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const BacklogView = () => {
    const backlogTasks = tasks.filter((t) => !t.date);

    return (
      <div className="flex flex-col h-full">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-semibold text-gray-800">
              Inbox / Backlog
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Tareas pendientes de asignación. Arrastra desde aquí al calendario
              (si estuviera en una vista dividida) o edita para asignar fecha.
            </p>
          </div>
          <Badge colorClass="bg-purple-100 text-purple-800 border border-purple-200 text-sm px-3 py-1">
            {backlogTasks.length} Tareas
          </Badge>
        </div>

        <div
          className="flex-1 bg-gray-50/50 border-2 border-dashed border-gray-200 rounded-xl p-6 overflow-y-auto"
          onDragOver={handleDragOver}
          onDrop={handleDropToBacklog}
        >
          {backlogTasks.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <Inbox className="w-16 h-16 mb-4 text-gray-300" />
              <p className="text-lg font-medium text-gray-600">
                El Backlog está vacío
              </p>
              <p className="text-sm mt-1">
                Todas tus tareas tienen una fecha asignada o no hay tareas
                nuevas.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {backlogTasks.map((task) => (
                <TaskItem key={task.id} task={task} />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const DashboardView = () => {
    const [isExporting, setIsExporting] = useState(false);

    const stats = useMemo(() => {
      const total = tasks.length;
      const completed = tasks.filter((t) => t.completed).length;
      const pending = total - completed;
      const overdueCount = tasks.filter((t) =>
        isOverdue(t.date, t.completed),
      ).length;
      const completionRate =
        total === 0 ? 0 : Math.round((completed / total) * 100);
      const highPriority = tasks.filter(
        (t) => t.priority === "Alta" && !t.completed,
      ).length;

      return {
        total,
        completed,
        pending,
        overdueCount,
        completionRate,
        highPriority,
      };
    }, [tasks]);

    const handleGenerateInsight = async () => {
      setIsGeneratingInsight(true);
      setInsightError("");

      const prompt = `Actúa como un analista de productividad corporativa de élite. 
      Aquí están mis métricas actuales: 
      - Total de tareas: ${stats.total}
      - Tareas completadas: ${stats.completed} (${stats.completionRate}%)
      - Tareas vencidas: ${stats.overdueCount}
      - Tareas de alta prioridad pendientes: ${stats.highPriority}
      
      Analiza brevemente esta situación y dame un (1) consejo estratégico conciso para optimizar mi tiempo y reducir cuellos de botella. 
      Escribe máximo 3 oraciones en un tono directo y motivador.`;

      try {
        const response = await callGeminiAPI(prompt);
        setAiInsight(response);
      } catch (err: any) {
        setInsightError(err.message);
      } finally {
        setIsGeneratingInsight(false);
      }
    };

    const handleExportPDF = async () => {
      setIsExporting(true);
      try {
        // Cargar dinámicamente el motor de PDF si no existe en la memoria
        if (!(window as any).html2pdf) {
          await new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src =
              "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
          });
        }

        const element = document.getElementById("dashboard-export-area");
        const opt = {
          margin: 0.3,
          filename: `Dashboard_Estrategico_${new Date().toISOString().split("T")[0]}.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: "in", format: "a4", orientation: "portrait" },
        };

        await (window as any).html2pdf().set(opt).from(element).save();
      } catch (error) {
        console.error("Error al generar PDF:", error);
      } finally {
        setIsExporting(false);
      }
    };

    return (
      <div
        className="flex flex-col h-full bg-[#F8F9FA]"
        id="dashboard-export-area"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold text-gray-800">
            Dashboard de Reportes Mensuales
          </h2>
          <button
            onClick={handleExportPDF}
            disabled={isExporting}
            data-html2canvas-ignore="true"
            className="print:hidden flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50"
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Printer className="w-4 h-4" />
            )}
            {isExporting ? "Generando PDF..." : "Exportar / Imprimir"}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="p-6 border-l-4 border-l-blue-500">
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-1">
              Total Tareas
            </p>
            <div className="flex items-end gap-3">
              <span className="text-4xl font-bold text-gray-900">
                {stats.total}
              </span>
              <span className="text-sm text-gray-500 mb-1">registradas</span>
            </div>
          </Card>

          <Card className="p-6 border-l-4 border-l-green-500">
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-1">
              Completadas
            </p>
            <div className="flex items-end justify-between">
              <div className="flex items-end gap-3">
                <span className="text-4xl font-bold text-gray-900">
                  {stats.completed}
                </span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-xl font-semibold text-green-600">
                  {stats.completionRate}%
                </span>
                <span className="text-xs text-gray-400">Tasa de éxito</span>
              </div>
            </div>
            {/* Barra de progreso visual */}
            <div className="w-full bg-gray-100 rounded-full h-1.5 mt-4 overflow-hidden">
              <div
                className="bg-green-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${stats.completionRate}%` }}
              ></div>
            </div>
          </Card>

          <Card
            className={`p-6 border-l-4 ${stats.overdueCount > 0 ? "border-l-red-500 bg-red-50/10" : "border-l-gray-300"}`}
          >
            <p
              className={`text-sm font-medium uppercase tracking-wider mb-1 ${stats.overdueCount > 0 ? "text-red-500" : "text-gray-500"}`}
            >
              Tareas Vencidas
            </p>
            <div className="flex items-center gap-3">
              <span
                className={`text-4xl font-bold ${stats.overdueCount > 0 ? "text-red-600" : "text-gray-900"}`}
              >
                {stats.overdueCount}
              </span>
              {stats.overdueCount > 0 && (
                <AlertCircle className="w-6 h-6 text-red-500" />
              )}
            </div>
            {stats.overdueCount > 0 && (
              <p className="text-xs text-red-600 mt-2 font-medium">
                Requieren atención inmediata.
              </p>
            )}
          </Card>

          <Card className="p-6 border-l-4 border-l-yellow-400">
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-1">
              Alta Prioridad
            </p>
            <div className="flex items-end gap-3">
              <span className="text-4xl font-bold text-gray-900">
                {stats.highPriority}
              </span>
              <span className="text-sm text-gray-500 mb-1">pendientes</span>
            </div>
          </Card>
        </div>

        {/* --- SECCIÓN DE GEMINI AI: INSIGHTS --- */}
        <div className="mb-8 print:hidden">
          <Card className="p-6 border border-purple-200 bg-gradient-to-r from-purple-50 to-white relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Sparkles className="w-24 h-24 text-purple-500" />
            </div>
            <div className="relative z-10 flex flex-col items-start gap-4">
              <h3 className="text-lg font-semibold text-purple-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" /> Análisis
                Estratégico (Gemini AI)
              </h3>

              {!aiInsight && !isGeneratingInsight && !insightError && (
                <button
                  onClick={handleGenerateInsight}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" /> Generar Análisis de
                  Productividad
                </button>
              )}

              {isGeneratingInsight && (
                <div className="flex items-center gap-3 text-purple-700">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm font-medium">
                    Analizando métricas con Gemini...
                  </span>
                </div>
              )}

              {insightError && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-100 flex items-center gap-2 w-full">
                  <AlertCircle className="w-4 h-4" /> {insightError}
                </div>
              )}

              {aiInsight && !isGeneratingInsight && (
                <div className="bg-white/80 p-4 rounded-lg border border-purple-100 shadow-sm w-full">
                  <p className="text-gray-800 text-sm leading-relaxed">
                    {aiInsight}
                  </p>
                  <button
                    onClick={handleGenerateInsight}
                    className="mt-3 text-xs font-medium text-purple-600 hover:text-purple-800 transition-colors flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" /> Actualizar Análisis
                  </button>
                </div>
              )}
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" /> Cuellos de
              Botella (Vencidas)
            </h3>
            <div className="flex flex-col gap-3">
              {tasks.filter((t) => isOverdue(t.date, t.completed)).length ===
              0 ? (
                <p className="text-sm text-gray-500 italic">
                  No hay tareas vencidas. ¡Excelente trabajo!
                </p>
              ) : (
                tasks
                  .filter((t) => isOverdue(t.date, t.completed))
                  .map((task) => (
                    <div
                      key={task.id}
                      className="flex justify-between items-center p-3 bg-red-50 rounded-lg border border-red-100"
                    >
                      <div>
                        <p className="text-sm font-medium text-red-800">
                          {task.title}
                        </p>
                        <p className="text-xs text-red-600/80 mt-0.5">
                          Debía entregarse: {formatDate(task.date)}
                        </p>
                      </div>
                      <button
                        onClick={() => toggleTaskCompletion(task.id)}
                        className="px-3 py-1 bg-white border border-red-200 text-red-700 text-xs font-medium rounded hover:bg-red-50 transition-colors shadow-sm"
                      >
                        Completar
                      </button>
                    </div>
                  ))
              )}
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" /> Actividad
              Reciente (Completadas)
            </h3>
            <div className="flex flex-col gap-3 overflow-y-auto max-h-[300px] pr-2">
              {tasks.filter((t) => t.completed).length === 0 ? (
                <p className="text-sm text-gray-500 italic">
                  Aún no has completado tareas este mes.
                </p>
              ) : (
                tasks
                  .filter((t) => t.completed)
                  .map((task) => (
                    <div
                      key={task.id}
                      className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100 opacity-80"
                    >
                      <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-700 line-through">
                          {task.title}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {task.date
                            ? `Para: ${formatDate(task.date)}`
                            : "Del Backlog"}
                        </p>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </Card>
        </div>
      </div>
    );
  };

  const TaskFormView = () => {
    const [title, setTitle] = useState<string>("");
    const [description, setDescription] = useState<string>("");
    const [date, setDate] = useState<string>("");
    const [priority, setPriority] = useState<"Alta" | "Media" | "Baja">(
      "Media",
    );
    const [error, setError] = useState<string>("");

    // Estado para la IA
    const [isGeneratingDesc, setIsGeneratingDesc] = useState<boolean>(false);

    useEffect(() => {
      if (editingTask) {
        setTitle(editingTask.title);
        setDescription(editingTask.description || "");
        setDate(editingTask.date || "");
        setPriority(editingTask.priority || "Media");
      } else {
        setTitle("");
        setDescription("");
        setDate(initialDateForNewTask || "");
        setPriority("Media");
      }
    }, [editingTask, initialDateForNewTask]);

    const handleGenerateDescription = async () => {
      if (!title.trim()) {
        setError(
          "Por favor, ingresa un título para que la IA sepa qué tarea desglosar.",
        );
        return;
      }

      setIsGeneratingDesc(true);
      setError("");

      const prompt = `Actúa como un project manager de primer nivel. 
      Tengo la siguiente tarea: "${title}".
      ${description ? `Contexto adicional provisto por el usuario: "${description}".` : ""}
      
      Por favor, genera un plan de acción breve. Quiero una descripción de una oración sobre el objetivo, seguido de una lista de 3 a 5 sub-tareas o pasos accionables para completarla con éxito.
      Usa guiones (-) para la lista. No uses formato markdown avanzado como negritas o asteriscos, mantenlo en texto plano estructurado.`;

      try {
        const response = await callGeminiAPI(prompt);
        setDescription(response);
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error ? err.message : "Error desconocido";
        setError(errorMessage);
      } finally {
        setIsGeneratingDesc(false);
      }
    };

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!title.trim()) {
        setError("El título de la tarea es obligatorio.");
        return;
      }

      try {
        if (editingTask) {
          await updateTask({
            ...editingTask,
            title,
            description,
            date,
            priority,
          });
          setEditingTask(null);
          setInitialDateForNewTask("");
          setActiveTab(date ? "calendar" : "inbox");
        } else {
          await addTask({
            title,
            description,
            date,
            priority,
            completed: false,
          });
          setInitialDateForNewTask("");
        }
      } catch (err) {
        setError("Error al guardar la tarea. Intenta nuevamente.");
      }
    };

    const handleCancel = () => {
      setEditingTask(null);
      setInitialDateForNewTask("");
      setActiveTab("calendar");
    };

    return (
      <div className="flex flex-col h-full max-w-2xl mx-auto w-full">
        <h2 className="text-2xl font-semibold text-gray-800 mb-6 flex items-center gap-2">
          {editingTask ? (
            <Edit2 className="w-6 h-6 text-blue-600" />
          ) : (
            <PlusCircle className="w-6 h-6 text-blue-600" />
          )}
          {editingTask ? "Editar Tarea Estratégica" : "Nueva Tarea Estratégica"}
        </h2>

        <Card className="p-8">
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" /> {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Título de la Tarea *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej. Consolidar Reporte de Ventas Q1"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-gray-400"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">
                  Detalle / Notas
                </label>
                <button
                  type="button"
                  onClick={handleGenerateDescription}
                  disabled={isGeneratingDesc || !title.trim()}
                  className="text-xs font-semibold text-purple-600 hover:text-purple-800 disabled:opacity-50 transition-colors flex items-center gap-1"
                >
                  {isGeneratingDesc ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Sparkles className="w-3 h-3" />
                  )}
                  ✨ Desglosar con IA
                </button>
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                placeholder="Agrega contexto, o presiona '✨ Desglosar con IA' para generar sub-tareas automáticamente..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-y placeholder:text-gray-400"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha Prevista
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-gray-700"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Déjalo en blanco para enviar al Backlog.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prioridad
                </label>
                <select
                  value={priority}
                  onChange={(e) =>
                    setPriority(e.target.value as "Alta" | "Media" | "Baja")
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white text-gray-700"
                >
                  <option value="Alta">Alta (Crítica)</option>
                  <option value="Media">Media (Normal)</option>
                  <option value="Baja">Baja (Opcional)</option>
                </select>
              </div>
            </div>

            <div className="pt-4 mt-2 border-t border-gray-100 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleCancel}
                className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors focus:ring-2 focus:ring-gray-200 outline-none"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 outline-none flex items-center gap-2"
              >
                {editingTask ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <PlusCircle className="w-4 h-4" />
                )}
                {editingTask ? "Guardar Cambios" : "Crear Tarea"}
              </button>
            </div>
          </form>
        </Card>
      </div>
    );
  };

  // Mostrar loader mientras carga la autenticación
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900/90 via-purple-900/90 to-gray-900/90 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-white/10 animate-spin">
            <Loader2 className="w-8 h-8 text-white" />
          </div>
          <p className="text-white font-medium">Cargando...</p>
        </div>
      </div>
    );
  }

  // Mostrar modal de login si no hay usuario
  if (!currentUser) {
    return <LoginModal onLoginSuccess={() => {}} />;
  }

  // Mostrar app completa si hay usuario autenticado
  return (
    <div className="min-h-screen bg-[#F8F9FA] text-gray-900 font-sans flex flex-col">
      {/* Header Corporativo */}
      <header className="bg-white border-b border-gray-200 px-3 md:px-6 py-2 md:py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm print:hidden">
        {/* Logo y Título */}
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <div className="bg-blue-600 p-1.5 md:p-2 rounded-lg flex-shrink-0">
            <Calendar className="w-4 md:w-5 h-4 md:h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg md:text-2xl font-black tracking-tight text-gray-900 leading-none italic">
              Plann-ing
            </h1>
            <p className="text-xs text-gray-500 mt-0.5 md:mt-1 font-semibold tracking-wide flex items-center gap-1 whitespace-nowrap overflow-hidden text-ellipsis">
              <span className="hidden sm:inline">Dashboard y Planner</span>
              <span className="sm:hidden">Planner</span>
              <Sparkles className="w-3 h-3 text-purple-500 flex-shrink-0" />
            </p>
          </div>
        </div>

        {/* Elementos del Centro y Derecha */}
        <div className="flex items-center gap-1 md:gap-4 ml-2 md:ml-4">
          {/* Indicador de progreso general - solo desktop */}
          <div className="hidden lg:flex items-center gap-2 text-sm">
            <span className="text-gray-500 font-medium">Progreso:</span>
            <div className="w-32 bg-gray-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                style={{
                  width: `${tasks.length ? Math.round((tasks.filter((t) => t.completed).length / tasks.length) * 100) : 0}%`,
                }}
              ></div>
            </div>
            <span className="font-semibold text-gray-700">
              {tasks.length
                ? Math.round(
                    (tasks.filter((t) => t.completed).length / tasks.length) *
                      100,
                  )
                : 0}
              %
            </span>
          </div>

          {/* Botón de Entrada por Voz - Mejorado para móvil */}
          <button
            onClick={startListening}
            disabled={isListening || isProcessingVoice}
            className={`border text-xs md:text-sm font-medium transition-colors shadow-sm flex items-center gap-2 px-2 md:px-4 py-2 rounded-lg print:hidden
              ${
                isListening
                  ? "border-red-500 text-red-600 bg-red-50 animate-pulse"
                  : isProcessingVoice
                    ? "border-purple-500 text-purple-600 bg-purple-50"
                    : "border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
              }`}
          >
            {isListening ? (
              <Mic className="w-4 h-4 md:w-5 md:h-5" />
            ) : isProcessingVoice ? (
              <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" />
            ) : (
              <Mic className="w-4 h-4 md:w-5 md:h-5" />
            )}
            <span className="hidden sm:inline">
              {isListening
                ? "Escuchando..."
                : isProcessingVoice
                  ? "IA..."
                  : "Dictar"}
            </span>
          </button>

          {currentUser && (
            <>
              {/* Botón Nueva Tarea - Mejorado para móvil */}
              <button
                onClick={() => {
                  setEditingTask(null);
                  setInitialDateForNewTask("");
                  setActiveTab("add");
                }}
                className="bg-gray-900 hover:bg-gray-800 text-white px-2 md:px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-colors shadow-sm flex items-center gap-1 md:gap-2 flex-shrink-0"
              >
                <PlusCircle className="w-4 h-4 md:w-5 md:h-5" />
                <span className="hidden md:inline">Nueva</span>
              </button>

              {/* Perfil de Usuario - Mejorado para móvil */}
              <div className="ml-1 md:ml-2 flex-shrink-0">
                <UserProfile
                  user={{
                    displayName: currentUser.displayName,
                    photoURL: currentUser.photoURL,
                    email: currentUser.email,
                  }}
                  onLogout={() => setCurrentUser(null)}
                />
              </div>
            </>
          )}
        </div>
      </header>

      {/* Navegación de Pestañas */}
      <nav className="bg-white border-b border-gray-200 px-6 overflow-x-auto print:hidden">
        <div className="flex space-x-1 min-w-max">
          {[
            { id: "calendar", label: "Calendario", icon: Calendar },
            { id: "list", label: "Lista Lineal", icon: List },
            {
              id: "inbox",
              label: "Backlog",
              icon: Inbox,
              count: tasks.filter((t) => !t.date).length,
            },
            { id: "dashboard", label: "Dashboard", icon: BarChart2 },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap outline-none
                ${
                  activeTab === tab.id
                    ? "border-blue-600 text-blue-600 bg-blue-50/50"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50 hover:border-gray-300"
                }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className={`ml-1.5 py-0.5 px-2 rounded-full text-[10px] leading-none font-bold ${activeTab === tab.id ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* Área de Contenido Principal */}
      <main className="flex-1 p-6 overflow-auto relative">
        <div className="max-w-7xl mx-auto h-full animate-in fade-in duration-300">
          {activeTab === "calendar" && <CalendarView />}
          {activeTab === "list" && <ListView />}
          {activeTab === "inbox" && <BacklogView />}
          {activeTab === "dashboard" && <DashboardView />}
          {activeTab === "add" && <TaskFormView />}
        </div>
      </main>

      {/* Notificación flotante para la entrada de voz */}
      {voiceFeedback && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300 print:hidden">
          <div
            className={`px-6 py-4 rounded-xl shadow-lg border flex items-center gap-3 max-w-sm
            ${
              isProcessingVoice
                ? "bg-purple-900 border-purple-700 text-white"
                : isListening
                  ? "bg-red-600 border-red-500 text-white"
                  : "bg-gray-900 border-gray-800 text-white"
            }`}
          >
            {isListening ? (
              <Mic className="w-5 h-5 animate-pulse" />
            ) : isProcessingVoice ? (
              <Sparkles className="w-5 h-5 animate-pulse" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-green-400" />
            )}
            <p className="text-sm font-medium">{voiceFeedback}</p>
          </div>
        </div>
      )}
    </div>
  );
}
