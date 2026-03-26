import React, { useState } from "react";
import { signInWithGoogle } from "./firebase";
import { Loader2, Sparkles } from "lucide-react";

interface LoginModalProps {
  onLoginSuccess: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onLoginSuccess }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError("");
    try {
      await signInWithGoogle();
      onLoginSuccess();
    } catch (err: any) {
      setError(err.message || "Error al iniciar sesión con Google");
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-blue-900/90 via-purple-900/90 to-gray-900/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-in fade-in zoom-in duration-300">
        {/* Card principal */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header con gradiente */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-8 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full -mr-16 -mt-16"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/20 rounded-full -ml-12 -mb-12"></div>

            <div className="relative z-10">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Sparkles className="w-6 h-6 text-white" />
                <h1 className="text-3xl font-bold text-white tracking-tight">
                  Strategic Planner
                </h1>
              </div>
              <p className="text-blue-100 text-sm font-medium">
                TIME-BLOCKING & AI-POWERED PRODUCTIVITY
              </p>
            </div>
          </div>

          {/* Contenido */}
          <div className="px-6 py-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Bienvenido
              </h2>
              <p className="text-gray-600 text-sm leading-relaxed">
                Organiza tus tareas con inteligencia artificial, reconocimiento
                de voz y sincronización en tiempo real.
              </p>
            </div>

            {/* Features */}
            <div className="space-y-3 mb-8 bg-gray-50 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0"></div>
                <p className="text-sm text-gray-700">
                  📅 Calendario inteligente con drag & drop
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-purple-600 flex-shrink-0"></div>
                <p className="text-sm text-gray-700">
                  🎤 Crea tareas por voz (Español)
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0"></div>
                <p className="text-sm text-gray-700">
                  🤖 Análisis AI de productividad
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-purple-600 flex-shrink-0"></div>
                <p className="text-sm text-gray-700">
                  ☁️ Sincronización en la nube
                </p>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-xs text-red-700 font-medium">{error}</p>
              </div>
            )}

            {/* Botón Google Sign-In */}
            <button
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 group"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Iniciando sesión...</span>
                </>
              ) : (
                <>
                  {/* Google Icon SVG */}
                  <svg
                    className="w-5 h-5"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  <span>Iniciar con Google</span>
                </>
              )}
            </button>

            {/* Footer */}
            <p className="text-center text-xs text-gray-500 mt-6">
              Tus datos están 100% privados y seguros en la nube de Google.
            </p>
          </div>
        </div>

        {/* Decoración de fondo */}
        <div className="mt-8 text-center text-white/40 text-xs font-medium">
          Strategic Planner v1.0
        </div>
      </div>
    </div>
  );
};
