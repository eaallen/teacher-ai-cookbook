import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
  type User,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

interface AuthCtx {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (
    email: string,
    password: string,
    displayName: string
  ) => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

/**
 * Creates the teacher profile document when Firebase Auth has a new user.
 * @param {User} user - Firebase Auth user to mirror into Firestore.
 */
async function ensureUserDoc(user: User) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      email: user.email ?? "",
      displayName: user.displayName ?? user.email?.split("@")[0] ?? "Teacher",
      createdAt: serverTimestamp(),
    });
  }
}

/**
 * Determines whether Google sign-in should use popup for this environment.
 * Popup is only used in local dev when the Auth emulator is not enabled.
 */
function shouldUsePopupGoogleSignIn(): boolean {
  return import.meta.env.DEV && import.meta.env.VITE_USE_EMULATOR !== "1";
}

/**
 * Starts Google sign-in using environment-specific auth flow.
 */
async function signInWithGoogleByEnvironment() {
  const provider = new GoogleAuthProvider();
  if (shouldUsePopupGoogleSignIn()) {
    await signInWithPopup(auth, provider);
    return;
  }
  await signInWithRedirect(auth, provider);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setLoading(false);
      if (u && !u.isAnonymous) {
        try {
          await ensureUserDoc(u);
        } catch {
          // best-effort; rules will block if mis-shaped
        }
      }
    });
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({
      user,
      loading,
      async signInWithGoogle() {
        await signInWithGoogleByEnvironment();
      },
      async signInWithEmail(email, password) {
        await signInWithEmailAndPassword(auth, email, password);
      },
      async signUpWithEmail(email, password, displayName) {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, "users", cred.user.uid), {
          email,
          displayName,
          createdAt: serverTimestamp(),
        });
      },
      async signOut() {
        await fbSignOut(auth);
      },
    }),
    [user, loading]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
