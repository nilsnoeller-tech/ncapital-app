import React, { useState, useEffect } from "react";
import { BarChart3, Mail, Send, CheckCircle, AlertCircle, ArrowLeft } from "lucide-react";
import { requestMagicLink } from "../services/auth.js";

const C = {
  bg: "#0B0E11", card: "#141820", cardHover: "#1A1F2B",
  border: "#1E2433", borderLight: "#2A3144",
  text: "#E8ECF1", textMuted: "#8892A4", textDim: "#5A6478",
  accent: "#6C5CE7", accentLight: "#A29BFE",
  green: "#00D68F", red: "#FF6B6B",
};

export default function LoginPage({ onLogin }) {
  const [step, setStep] = useState("input"); // "input" | "sent"
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Cooldown timer for resend
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleSendLink = async (e) => {
    if (e) e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await requestMagicLink(email.trim());
      setStep("sent");
      setCooldown(30);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setError("");
    setLoading(true);
    try {
      await requestMagicLink(email.trim());
      setCooldown(30);
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
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      <div style={{ width: "100%", maxWidth: 380, animation: "fadeIn 0.4s ease-out" }}>
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
          {step === "input" ? (
            <>
              <div style={{
                display: "flex", alignItems: "center", gap: 10, marginBottom: 20,
              }}>
                <Mail size={18} color={C.accent} />
                <div style={{ fontSize: 15, fontWeight: 700 }}>Anmelden per Magic Link</div>
              </div>

              <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 20, lineHeight: 1.5 }}>
                Gib deine E-Mail-Adresse ein und wir senden dir einen Login-Link.
              </p>

              <form onSubmit={handleSendLink}>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 12, color: C.textMuted, fontWeight: 600, display: "block", marginBottom: 6 }}>
                    E-Mail-Adresse
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="name@beispiel.de"
                    autoComplete="email"
                    autoCapitalize="off"
                    autoFocus
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
                  disabled={loading || !email.trim()}
                  style={{
                    width: "100%", padding: "12px 0", borderRadius: 10, border: "none",
                    background: (loading || !email.trim()) ? C.textDim : `linear-gradient(135deg, ${C.accent}, ${C.accentLight})`,
                    color: "#fff", fontSize: 14, fontWeight: 700,
                    cursor: (loading || !email.trim()) ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    boxShadow: (loading || !email.trim()) ? "none" : `0 4px 16px ${C.accent}40`,
                    transition: "all 0.2s",
                  }}
                >
                  {loading ? (
                    <div style={{ width: 18, height: 18, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
                  ) : (
                    <><Send size={16} /> Magic Link senden</>
                  )}
                </button>
              </form>
            </>
          ) : (
            /* ── "sent" step ── */
            <div style={{ textAlign: "center" }}>
              <div style={{
                width: 56, height: 56, borderRadius: "50%", margin: "0 auto 16px",
                background: `${C.green}18`, border: `2px solid ${C.green}40`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <CheckCircle size={28} color={C.green} />
              </div>

              <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>
                Pruefe dein Postfach
              </div>

              <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.5, marginBottom: 4 }}>
                Wir haben einen Login-Link an
              </p>
              <p style={{ fontSize: 14, fontWeight: 600, color: C.accent, marginBottom: 16 }}>
                {email}
              </p>
              <p style={{ fontSize: 12, color: C.textDim, marginBottom: 24 }}>
                gesendet. Der Link ist 15 Minuten gueltig.
              </p>

              {error && (
                <div style={{
                  padding: "10px 14px", borderRadius: 10, marginBottom: 16,
                  background: `${C.red}12`, border: `1px solid ${C.red}30`,
                  fontSize: 13, color: C.red, display: "flex", alignItems: "center", gap: 8, justifyContent: "center",
                }}>
                  <AlertCircle size={15} />
                  {error}
                </div>
              )}

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => { setStep("input"); setError(""); }}
                  style={{
                    flex: 1, padding: "10px 0", borderRadius: 10,
                    border: `1px solid ${C.border}`, background: "transparent",
                    color: C.textMuted, fontSize: 13, fontWeight: 600, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  }}
                >
                  <ArrowLeft size={14} /> Andere E-Mail
                </button>

                <button
                  onClick={handleResend}
                  disabled={cooldown > 0 || loading}
                  style={{
                    flex: 1, padding: "10px 0", borderRadius: 10, border: "none",
                    background: (cooldown > 0 || loading) ? C.textDim : `linear-gradient(135deg, ${C.accent}, ${C.accentLight})`,
                    color: "#fff", fontSize: 13, fontWeight: 600,
                    cursor: (cooldown > 0 || loading) ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    transition: "all 0.2s",
                  }}
                >
                  {loading ? (
                    <div style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
                  ) : cooldown > 0 ? (
                    `Erneut senden (${cooldown}s)`
                  ) : (
                    <><Send size={14} /> Erneut senden</>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={{ textAlign: "center", marginTop: 20, fontSize: 11, color: C.textDim }}>
          Alle Daten werden verschluesselt uebertragen
        </div>
      </div>
    </div>
  );
}
