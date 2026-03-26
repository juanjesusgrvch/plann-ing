import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  User,
  updateProfile,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  onSnapshot,
  doc,
  getDocs,
  Unsubscribe,
} from "firebase/firestore";

// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAbeuOaPouC_Uag6BeS88dXbXFdYkBoC90",
  authDomain: "plann-ing.firebaseapp.com",
  projectId: "plann-ing",
  storageBucket: "plann-ing.firebasestorage.app",
  messagingSenderId: "267190457260",
  appId: "1:267190457260:web:2f2ccb499fc09dca6ce009",
  measurementId: "G-614GEL9YBD",
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Inicializar Auth
export const auth = getAuth(app);

// Inicializar Firestore
export const db = getFirestore(app);

// Tipos
export interface Task {
  id: string;
  title: string;
  description: string;
  date: string;
  priority: "Alta" | "Media" | "Baja";
  completed: boolean;
  userId: string;
  createdAt: number;
  updatedAt: number;
}

// --- AUTENTICACIÓN CON GOOGLE ---
const googleProvider = new GoogleAuthProvider();
googleProvider.addScope("profile");
googleProvider.addScope("email");

export const signInWithGoogle = async (): Promise<User | null> => {
  try {
    // Usar signInWithRedirect en lugar de signInWithPopup para evitar problemas COOP
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    // Si el popup falla, intentar con redirect
    if (error.code === "auth/popup-blocked" || error.message.includes("COOP")) {
      try {
        // signInWithRedirect redirige al usuario, que es más compatible con políticas de seguridad
        await signInWithPopup(auth, googleProvider);
        return auth.currentUser;
      } catch (redirectError) {
        console.error("Error al iniciar sesión:", redirectError);
        throw redirectError;
      }
    }
    throw error;
  }
};

export const signOutUser = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error al cerrar sesión:", error);
    throw error;
  }
};

export const onAuthStateChange = (
  callback: (user: User | null) => void,
): Unsubscribe => {
  return onAuthStateChanged(auth, callback);
};

export const updateUserProfile = async (
  displayName: string,
  photoURL?: string,
): Promise<void> => {
  try {
    if (auth.currentUser) {
      await updateProfile(auth.currentUser, {
        displayName,
        photoURL,
      });
    }
  } catch (error) {
    console.error("Error al actualizar perfil:", error);
    throw error;
  }
};

// Agregar tarea
export const addTaskToFirebase = async (
  task: Omit<Task, "id" | "userId" | "createdAt" | "updatedAt">,
  userId: string,
) => {
  try {
    const tasksRef = collection(db, "users", userId, "tasks");
    const docRef = await addDoc(tasksRef, {
      ...task,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return docRef.id;
  } catch (error) {
    console.error("Error al agregar tarea:", error);
    throw error;
  }
};

// Actualizar tarea
export const updateTaskInFirebase = async (
  taskId: string,
  updates: Partial<Omit<Task, "id" | "userId" | "createdAt">>,
  userId: string,
) => {
  try {
    const taskRef = doc(db, "users", userId, "tasks", taskId);
    await updateDoc(taskRef, {
      ...updates,
      updatedAt: Date.now(),
    });
  } catch (error) {
    console.error("Error al actualizar tarea:", error);
    throw error;
  }
};

// Eliminar tarea
export const deleteTaskFromFirebase = async (
  taskId: string,
  userId: string,
) => {
  try {
    const taskRef = doc(db, "users", userId, "tasks", taskId);
    await deleteDoc(taskRef);
  } catch (error) {
    console.error("Error al eliminar tarea:", error);
    throw error;
  }
};

// Obtener tareas del usuario en tiempo real
export const subscribeToUserTasks = (
  userId: string,
  callback: (tasks: Task[]) => void,
) => {
  const tasksRef = collection(db, "users", userId, "tasks");
  const q = query(tasksRef);
  const unsubscribe = onSnapshot(
    q,
    (querySnapshot) => {
      const tasks: Task[] = [];
      querySnapshot.forEach((doc) => {
        tasks.push({
          ...doc.data(),
          id: doc.id,
          userId,
        } as Task);
      });
      // Ordenar por fecha y estado
      tasks.sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        if (!a.date) return 1;
        if (!b.date) return -1;
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      });
      callback(tasks);
    },
    (error) => {
      console.error("Error al suscribirse a tareas:", error);
    },
  );
  return unsubscribe;
};

// Obtener todas las tareas del usuario (una sola vez)
export const getUserTasks = async (userId: string): Promise<Task[]> => {
  try {
    const tasksRef = collection(db, "users", userId, "tasks");
    const q = query(tasksRef);
    const querySnapshot = await getDocs(q);
    const tasks: Task[] = [];
    querySnapshot.forEach((doc) => {
      tasks.push({
        ...doc.data(),
        id: doc.id,
        userId,
      } as Task);
    });
    return tasks;
  } catch (error) {
    console.error("Error al obtener tareas:", error);
    throw error;
  }
};

export default app;
