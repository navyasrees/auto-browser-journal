import { useEffect, useState } from "react";
import TabList from "./components/TabList";
import DailyReport from "./components/DailyReport";
import Login from "./components/Login";
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, User, signOut } from "firebase/auth";
import "./App.css";

const firebaseConfig = {
  apiKey: "AIzaSyC6CprevDEOHfuPgvXeMsCzDlpshqydaA8",
  authDomain: "auto-browser-journal.firebaseapp.com",
  projectId: "auto-browser-journal",
  storageBucket: "auto-browser-journal.firebasestorage.app",
  messagingSenderId: "789718823228",
  appId: "1:789718823228:web:968bc2da23c9d245a2ee39",
  measurementId: "G-33D705NSJ7",
};

initializeApp(firebaseConfig);

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) return <div>Loading...</div>;

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  const handleLogout = async () => {
    const auth = getAuth();
    await signOut(auth);
    setUser(null);
  };

  return (
    <div className="app">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <h1 style={{ margin: 0 }}>Auto Browser Journal</h1>
        <button
          onClick={handleLogout}
          style={{
            padding: "7px 18px",
            borderRadius: 7,
            border: "none",
            background: "linear-gradient(90deg, #ef5350 0%, #ab47bc 100%)",
            color: "#fff",
            fontWeight: 600,
            fontSize: 15,
            cursor: "pointer",
            letterSpacing: 0.5,
          }}
        >
          Logout
        </button>
      </div>
      <TabList />
      <DailyReport />
    </div>
  );
}

export default App;
