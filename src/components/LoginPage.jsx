import React, { useState } from "react";
import { BarChart3, LogIn, UserPlus, Eye, EyeOff, AlertCircle } from "lucide-react";
import { login, register } from "../services/auth.js";

const C = {
  bg: "#0B0E11", card: "#141820", cardHover: "#1A1F2B",
  border: "#1E2433", borderLight: "#2A3144",
  text: "#E8ECF1", textMuted: "#8892A4", textDim: "#5A6478",
  accent: "#6C5CE7", accentLight: "#A29BFE",
  green: "#00D68F", red: "#FF6B6B",
};

export default function LoginPage({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        await login(username, password);
      } else {
        await register(username, password);
      }
      onLogin();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", color: C.text,
      padding: 16,
    }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input::placeholder { color: ${C.textDim}; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <div style={{
        width: "100%", maxWidth: 380, animation: "fadeIn 0.4s ease-out",
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, margin: "0 auto 16px",
            background: `linear-gradient(135deg, ${C.accent}, ${C.accentLight})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 8px 32px ${C.accent}40`,
          }}>
            <BarChart3 size={28} color="#fff" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.03em" }}>N-Capital</div>
          <div style={{ fontSize: 13, color: C.textDim, marginTop: 4 }}>Trading Journal</div>
        </div>

        {/* Card */}
        <div style={{
          background: C.card, borderRadius: 16, border: `1px solid ${C.border}`,
          padding: "28px 24px", boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        }}>
          {/* Tab toggle */}
          <div style={{
            display: "flex", gap: 4, marginBottom: 24, padding: 3, borderRadius: 10,
            background: C.bg, border: `1px solid ${C.border}`,
          }}>
            {["login", "register"].map(m => (
              <button key={m} onClick={() => { setMode(m); setError(""); }} style={{
                flex: 1, padding: "8px 0", border: "none", borderRadius: 8, cursor: "pointer",
                fontSize: 13, fontWeight: 600, transition: "all 0.2s",
                background: mode === m ? C.accent : "transparent",
                color: mode === m ? "#fff" : C.textMuted,
              }}>
                {m === "login" ? "Anmelden" : "Registrieren"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: C.textMuted, fontWeight: 600, display: "block", marginBottom: 6 }}>
                Benutzername
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="max.mustermann"
                autoComplete="username"
                autoCapitalize="off"
                required
                style={{
                  width: "100%", padding: "10px 14px", borderRadius: 10,
                  border: `1px solid ${C.border}`, background: C.bg, color: C.text,
                  fontSize: 14, outline: "none", transition: "border-color 0.2s",
                }}
                onFocus={e => e.target.style.borderColor = C.accent}
                onBlur={e => e.target.style.borderColor = C.border}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 12, color: C.textMuted, fontWeight: 600, display: "block", marginBottom: 6 }}>
                Passwort
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={mode === "register" ? "Mind. 6 Zeichen" : "Passwort"}
                  autoComplete={mode === "register" ? "new-password" : "current-password"}
                  required
                  style={{
                    width: "100%", padding: "10px 42px 10px 14px", borderRadius: 10,
                    border: `1px solid ${C.border}`, background: C.bg, color: C.text,
                    fontSize: 14, outline: "none", transition: "border-color 0.2s",
                  }}
                  onFocus={e => e.target.style.borderColor = C.accent}
                  onBlur={e => e.target.style.borderColor = C.border}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  style={{
                    position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", color: C.textDim, cursor: "pointer", padding: 4,
                  }}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div style={{
                padding: "10px 14px", borderRadius: 10, marginBottom: 16,
                background: `${C.red}12`, border: `1px solid ${C.red}30`,
                fontSize: 13, color: C.red, display: "flex", alignItems: "center", gap: 8,
              }}>
                <AlertCircle size={15} />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%", padding: "12px 0", borderRadius: 10, border: "none",
                background: loading ? C.textDim : `linear-gradient(135deg, ${C.accent}, ${C.accentLight})`,
                color: "#fff", fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                boxShadow: loading ? "none" : `0 4px 16px ${C.accent}40`,
                transition: "all 0.2s",
              }}
            >
              {loading ? (
                <div style={{ width: 18, height: 18, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
              ) : mode === "login" ? (
                <><LogIn size={16} /> Anmelden</>
              ) : (
                <><UserPlus size={16} /> Registrieren</>
              )}
            </button>
          </form>
        </div>

        <div style={{ textAlign: "center", marginTop: 20, fontSize: 11, color: C.textDim }}>
          Alle Daten werden verschluesselt uebertragen
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
