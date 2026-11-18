import { useEffect, useState } from "react";
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { auth } from "./firebase";
import { checkIsAdmin } from "./admin/adminActions";
import AdminDashboard from "./admin/AdminDashboard";

function signInError(error: unknown): string | null {
  const code = (error as { code?: string })?.code ?? "unknown";
  switch (code) {
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return null; // the person just closed the window
    case "auth/popup-blocked":
      return "Your browser blocked the sign-in window. Allow pop-ups for this site and try again.";
    case "auth/unauthorized-domain":
      return "This website's address isn't allowed yet. In Firebase Console open Authentication, then Settings, then Authorized domains, and add it.";
    case "auth/operation-not-allowed":
      return "Google sign-in is switched off. In Firebase Console open Authentication, then Sign-in method, and enable Google.";
    case "auth/network-request-failed":
      return "No connection. Check your internet and try again.";
    default:
      return `Couldn't sign in (${code}).`;
  }
}

export default function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [access, setAccess] = useState<"checking" | "yes" | "no">("checking");
  const [recheck, setRecheck] = useState(0);

  useEffect(() => onAuthStateChanged(auth, (u) => setUser(u)), []);

  useEffect(() => {
    setAccess("checking");
    if (!user) return;
    let dead = false;
    checkIsAdmin(user.uid).then((ok) => {
      if (!dead) setAccess(ok ? "yes" : "no");
    });
    return () => {
      dead = true;
    };
  }, [user, recheck]);

  const handleSignOut = () => signOut(auth).catch(() => undefined);

  if (user === undefined) return <Message>Loading…</Message>;
  if (!user) return <SignIn />;
  if (access === "checking") return <Message>Checking access…</Message>;
  if (access === "no") return <NoAccess user={user} onRecheck={() => setRecheck((n) => n + 1)} onSignOut={handleSignOut} />;
  return <AdminDashboard user={user} onSignOut={handleSignOut} />;
}

function Message({ children }: { children: React.ReactNode }) {
  return (
    <main className="page">
      <p className="center-msg">{children}</p>
    </main>
  );
}

function SignIn() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
    setBusy(true);
    setError(null);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (e) {
      setError(signInError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page">
      <div className="card">
        <h1 className="title">Bingo Admin</h1>
        <p className="hint">Sign in with the Google account that has been given access.</p>
        {error && <p className="error">{error}</p>}
        <button className="btn primary" onClick={handleSignIn} disabled={busy}>
          {busy ? "Opening Google…" : "Sign in with Google"}
        </button>
      </div>
    </main>
  );
}

function NoAccess({ user, onRecheck, onSignOut }: { user: User; onRecheck: () => void; onSignOut: () => void }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(user.uid);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  }

  return (
    <main className="page">
      <div className="card">
        <h2 className="title">This account doesn't have access yet</h2>
        <p className="hint">
          Signed in as {user.email}. To give this account access, add its ID to your database once:
        </p>
        <ol className="steps">
          <li>
            Copy your account ID: <span className="uid">{user.uid}</span>{" "}
            <button className="btn ghost small" onClick={copy}>
              {copied ? "Copied" : "Copy"}
            </button>
          </li>
          <li>Firebase Console, then Realtime Database, then the Data tab.</li>
          <li>
            Click the + next to your database name and add <strong>admins</strong>. Then click + next to admins, type
            your account ID as the name, and <strong>true</strong> as the value. Save.
          </li>
          <li>Come back here and press Check again.</li>
        </ol>
        <button className="btn primary" onClick={onRecheck}>
          Check again
        </button>
        <button className="btn ghost wide" onClick={onSignOut}>
          Sign out
        </button>
      </div>
    </main>
  );
}
