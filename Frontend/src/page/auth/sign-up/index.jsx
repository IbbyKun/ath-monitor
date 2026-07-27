import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { signUp } from "./service";
import userBgIllustration from "@/assets/user-bg.png";
import "../admin-login/style.css";
import empLogo from "@/assets/emp.png";
import userIcon from "@/assets/user-setting.png";
// ── shadcn/ui components ──────────────────────────────────────────────────
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

// ── Lucide React icons ────────────────────────────────────────────────────
import { Eye, EyeOff, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

/* ========================================================================
   Sign Up — same glassmorphism card shell as the login pages, with a
   scrollable inner field list since it carries more fields than a login
   form (see nonadmin-login/index.jsx for the shared shell this mirrors).
   ======================================================================== */
export const SignUp = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError(t("auth_passwords_do_not_match"));
      return;
    }

    setLoading(true);
    try {
      const result = await signUp({ firstName, lastName, email, password });

      if (result.error) {
        setError(result.error);
        return;
      }

      if (result.code !== 200) {
        setError(result.message || t("auth_unexpected_error"));
        return;
      }

      setSubmitted(true);
    } catch (err) {
      setError(t("auth_unexpected_error"));
      // eslint-disable-next-line no-console
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="relative min-h-screen flex flex-col overflow-hidden"
      style={{
        backgroundImage: `url(${userBgIllustration})`,
        backgroundSize: "cover",
        backgroundPosition: "left center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Subtle tint overlay */}
      <div className="absolute inset-0 bg-sky-50/20 pointer-events-none z-0" />

      {/* ── Header ────────────────────────────────────────────────────── */}
      <header className="animate-fade-down relative z-10 flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-3">
          <img src={empLogo} alt="" className="w-40" />
        </div>
      </header>

      {/* ── Main ──────────────────────────────────────────────────────── */}
      <main className="relative z-10 flex flex-1 items-center justify-end px-6 sm:px-16 lg:px-24 pb-12 max-w-[1700px]">
        <div className="flex flex-col items-center justify-center max-w-[560px] w-full gap-4">
          <div
            className="animate-card-rise relative w-full rounded-[63px] overflow-hidden px-12 py-10"
            style={{
              background: "rgba(255,255,255,0.92)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              boxShadow:
                "0 0 0 1px rgba(92,225,253,0.14), 0 4px 24px rgba(32,121,253,0.1), 0 20px 60px rgba(32,121,253,0.14)",
            }}
          >
            {/* ── Avatar Icon ── */}
            <div className="flex justify-center mb-5">
              <img src={userIcon} alt="icon" className="w-10" />
            </div>

            {/* Title */}
            <div className="text-center mb-7">
              <h2 className="text-[20px] font-bold tracking-tight text-[#0f1e3a]">
                {t("auth_create_account")}
              </h2>
            </div>

            {submitted ? (
              /* ── Post-signup confirmation — no auto-login, nothing to log into yet ── */
              <div className="animate-fade-in flex flex-col items-center gap-4 text-center py-4">
                <CheckCircle2 size={40} className="text-green-500" />
                <p className="text-[14px] text-[#3a5a7a] leading-relaxed">
                  {t("auth_signup_pending_message")}
                </p>
                <Button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="login-btn w-full h-11 rounded-xl text-[15px] font-bold text-white border-none transition-all duration-300 bg-gradient-to-b from-[#5CE1FD] to-[#2079FD]"
                >
                  {t("auth_login")}
                </Button>
              </div>
            ) : (
              <>
                {/* ── Error banner ── */}
                {error && (
                  <div className="animate-fade-in flex items-center gap-2 mb-5 px-3.5 py-2.5 rounded-xl text-[13px] text-red-700 bg-red-50 border border-red-200 border-l-[3px] border-l-red-400">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Scrollable field list — the extra fields (vs. a login form)
                      can push the card taller than the viewport on short screens. */}
                  <div className="max-h-[52vh] overflow-y-auto pr-1 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="firstName" className="text-[13px] font-semibold text-[#3a5a7a]">
                          {t("auth_first_name")}
                        </Label>
                        <Input
                          id="firstName"
                          type="text"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          required
                          placeholder={t("auth_first_name")}
                          className="emp-input px-4 h-11 rounded-xl text-sm text-[#1a2a4a] bg-white/80 placeholder:text-[#aac4d8] border-[1.5px] border-[#e0eef5] transition-all duration-200"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="lastName" className="text-[13px] font-semibold text-[#3a5a7a]">
                          {t("auth_last_name")}
                        </Label>
                        <Input
                          id="lastName"
                          type="text"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          required
                          placeholder={t("auth_last_name")}
                          className="emp-input px-4 h-11 rounded-xl text-sm text-[#1a2a4a] bg-white/80 placeholder:text-[#aac4d8] border-[1.5px] border-[#e0eef5] transition-all duration-200"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="email" className="text-[13px] font-semibold text-[#3a5a7a]">
                        {t("auth_email_address")}
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        placeholder={t("auth_enter_email_address")}
                        className="emp-input px-4 h-11 rounded-xl text-sm text-[#1a2a4a] bg-white/80 placeholder:text-[#aac4d8] border-[1.5px] border-[#e0eef5] transition-all duration-200"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="password" className="text-[13px] font-semibold text-[#3a5a7a]">
                        {t("password")}
                      </Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          minLength={6}
                          placeholder={t("auth_enter_password")}
                          className="emp-input px-4 pr-11 h-11 rounded-xl text-sm text-[#1a2a4a] bg-white/80 placeholder:text-[#aac4d8] border-[1.5px] border-[#e0eef5] transition-all duration-200"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          tabIndex={-1}
                          aria-label={showPassword ? t("auth_hide_password") : t("auth_show_password")}
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-[#9bbdce] hover:text-[#2079FD] hover:bg-transparent transition-colors duration-200"
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="confirmPassword" className="text-[13px] font-semibold text-[#3a5a7a]">
                        {t("auth_confirm_password")}
                      </Label>
                      <Input
                        id="confirmPassword"
                        type={showPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        minLength={6}
                        placeholder={t("auth_confirm_password")}
                        className="emp-input px-4 h-11 rounded-xl text-sm text-[#1a2a4a] bg-white/80 placeholder:text-[#aac4d8] border-[1.5px] border-[#e0eef5] transition-all duration-200"
                      />
                    </div>
                  </div>

                  <div className="pt-1">
                    <Button
                      type="submit"
                      disabled={loading}
                      className="login-btn w-full h-11 rounded-xl text-[15px] font-bold text-white border-none transition-all duration-300 disabled:opacity-75 disabled:cursor-not-allowed bg-gradient-to-b from-[#5CE1FD] to-[#2079FD]"
                    >
                      {loading ? (
                        <span className="flex items-center gap-2">
                          <Loader2 size={17} className="animate-spin" />
                          {t("auth_signing_up")}
                        </span>
                      ) : (
                        t("auth_sign_up")
                      )}
                    </Button>
                  </div>
                </form>

                <div className="flex justify-center mt-4">
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-auto p-0 text-[13px] font-bold text-[#2079FD] hover:text-[#2079FD] hover:bg-transparent hover:underline"
                    onClick={() => navigate("/login")}
                  >
                    {t("auth_already_have_account")}
                  </Button>
                </div>
              </>
            )}
          </div>
          <span className="text-xs text-[#9bbdce]">© {new Date().getFullYear()} – EmpMonitor</span>
        </div>
      </main>
    </div>
  );
};
