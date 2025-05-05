import React, { useState } from "react";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  User,
  UserCredential,
} from "firebase/auth";

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const auth = getAuth();
    try {
      let userCredential: UserCredential;
      if (isRegister) {
        userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );
      } else {
        userCredential = await signInWithEmailAndPassword(
          auth,
          email,
          password
        );
      }
      onLogin(userCredential.user);
    } catch (err: unknown) {
      let msg = (err as Error).message;
      if (msg.includes("auth/invalid-credential")) {
        msg = "Invalid credentials";
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: 340,
        margin: "40px auto",
        background: "#fff",
        borderRadius: 12,
        boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
        padding: 32,
      }}
    >
      <h2 style={{ textAlign: "center", marginBottom: 18 }}>
        {isRegister ? "Register" : "Login"}
      </h2>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{
            width: "100%",
            padding: "10px 12px",
            marginBottom: 14,
            borderRadius: 6,
            border: "1px solid #ccc",
            fontSize: 15,
          }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{
            width: "100%",
            padding: "10px 12px",
            marginBottom: 14,
            borderRadius: 6,
            border: "1px solid #ccc",
            fontSize: 15,
          }}
        />
        {error && <div style={{ color: "red", marginBottom: 10 }}>{error}</div>}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "10px 0",
            borderRadius: 6,
            border: "none",
            background: "linear-gradient(90deg, #42a5f5 0%, #7e57c2 100%)",
            color: "#fff",
            fontWeight: 600,
            fontSize: 16,
            cursor: "pointer",
            marginBottom: 10,
          }}
        >
          {loading
            ? isRegister
              ? "Registering..."
              : "Logging in..."
            : isRegister
            ? "Register"
            : "Login"}
        </button>
      </form>
      <div style={{ textAlign: "center", marginTop: 10 }}>
        <span style={{ color: "#666", fontSize: 14 }}>
          {isRegister ? "Already have an account?" : "Don't have an account?"}
        </span>
        <button
          style={{
            marginLeft: 8,
            color: "#1976d2",
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 14,
            textDecoration: "underline",
          }}
          onClick={() => setIsRegister((v) => !v)}
        >
          {isRegister ? "Login" : "Register"}
        </button>
      </div>
    </div>
  );
};

export default Login;
