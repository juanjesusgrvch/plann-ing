import React, { useState } from "react";
import { LogOut, Edit2, Loader2, Check, X } from "lucide-react";
import { signOutUser, updateUserProfile } from "./firebase";

interface UserProfileProps {
  user: {
    displayName: string | null;
    photoURL: string | null;
    email: string | null;
  };
  onLogout: () => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({ user, onLogout }) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [newName, setNewName] = useState(user.displayName || "");
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState("");

  const handleLogout = async () => {
    try {
      await signOutUser();
      onLogout();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleUpdateName = async () => {
    if (!newName.trim()) {
      setError("El nombre no puede estar vacío");
      return;
    }

    setIsUpdating(true);
    setError("");

    try {
      await updateUserProfile(newName.trim());
      setShowEditModal(false);
      setShowMenu(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const initials = user.displayName
    ? user.displayName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : "U";

  return (
    <>
      {/* Botón Usuario */}
      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors group"
          title={user.email || "Usuario"}
        >
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName || "Usuario"}
              className="w-8 h-8 rounded-full border-2 border-blue-600"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
              {initials}
            </div>
          )}
          <span className="hidden sm:inline text-sm font-medium text-gray-700 group-hover:text-gray-900">
            {user.displayName || "Usuario"}
          </span>
        </button>

        {/* Dropdown Menu */}
        {showMenu && (
          <div className="absolute right-0 top-12 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-30 py-2">
            {/* Info del usuario */}
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-900">
                {user.displayName || "Usuario"}
              </p>
              <p className="text-xs text-gray-500 mt-1 truncate">
                {user.email}
              </p>
            </div>

            {/* Opciones */}
            <button
              onClick={() => {
                setShowEditModal(true);
                setShowMenu(false);
              }}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <Edit2 className="w-4 h-4 text-blue-600" />
              <span>Editar perfil</span>
            </button>

            <div className="border-t border-gray-100"></div>

            <button
              onClick={handleLogout}
              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              <span>Cerrar sesión</span>
            </button>
          </div>
        )}
      </div>

      {/* Modal de Editar Perfil */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">
                Editar Perfil
              </h3>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setError("");
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido */}
            <div className="px-6 py-4">
              {/* Error */}
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-xs text-red-700">{error}</p>
                </div>
              )}

              {/* Input Nombre */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ej. María García"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  disabled={isUpdating}
                />
              </div>

              {/* Info */}
              <p className="text-xs text-gray-500 mt-3">
                Este nombre aparecerá en tu perfil y en tus tareas compartidas.
              </p>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setError("");
                }}
                disabled={isUpdating}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleUpdateName}
                disabled={isUpdating}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Guardar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
