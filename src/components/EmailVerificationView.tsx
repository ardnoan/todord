import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Mail,
  ExternalLink,
  RefreshCw,
  Copy,
  Check,
  ArrowRight,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import { supabase } from "../supabase";

interface EmailVerificationViewProps {
  email: string;
  onBackToLogin: () => void;
  onChangeEmail: () => void;
}

export function EmailVerificationView({
  email,
  onBackToLogin,
  onChangeEmail,
}: EmailVerificationViewProps) {
  const [resendCooldown, setResendCooldown] = useState(60);
  const [isResending, setIsResending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [resendNotice, setResendNotice] = useState("");
  const [resendError, setResendError] = useState("");

  // Cooldown countdown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleCopy = () => {
    navigator.clipboard.writeText(email);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleResend = async () => {
    if (!supabase || resendCooldown > 0 || isResending) return;
    setIsResending(true);
    setResendNotice("");
    setResendError("");

    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
      });
      if (error) throw error;
      setResendNotice("Email konfirmasi baru telah dikirim! Periksa kotak masukmu.");
      setResendCooldown(60);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setResendError(msg || "Gagal mengirim ulang email. Coba beberapa saat lagi.");
    } finally {
      setIsResending(false);
    }
  };

  // Determine webmail shortcut
  const domain = email.split("@")[1]?.toLowerCase() || "";
  const isGmail = domain.includes("gmail") || domain.includes("googlemail");
  const isOutlook =
    domain.includes("outlook") ||
    domain.includes("hotmail") ||
    domain.includes("live");

  return (
    <motion.div
      className="email-verify-view"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
    >
      {/* Animated Envelope Illustration */}
      <div className="email-verify-illustration">
        <div className="email-verify-pulse pulse-1" />
        <div className="email-verify-pulse pulse-2" />
        <div className="email-verify-icon-wrap">
          <Mail size={32} />
          <span className="email-sparkle-dot">
            <Sparkles size={14} />
          </span>
        </div>
      </div>

      <span className="eyebrow">LANGKAH TERAKHIR · KONFIRMASI AKUN</span>
      <h2>Periksa Kotak Masuk Emailmu</h2>
      <p className="email-verify-desc">
        Kami telah mengirimkan tautan konfirmasi pendaftaran. Buka email dan klik
        tautan tersebut untuk mengaktifkan akunmu.
      </p>

      {/* Email Display Badge with Copy */}
      <div className="email-verify-badge">
        <span className="email-address-text">{email}</span>
        <button
          type="button"
          className="email-copy-btn"
          onClick={handleCopy}
          title="Salin email"
        >
          {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
          <span>{copied ? "Tersalin" : "Salin"}</span>
        </button>
      </div>

      {resendNotice && (
        <div className="success-banner" role="status">
          {resendNotice}
        </div>
      )}
      {resendError && (
        <div className="error-banner" role="alert">
          {resendError}
        </div>
      )}

      {/* Helpful Instructions Box */}
      <div className="email-verify-tips">
        <div className="verify-step-row">
          <span className="step-num">1</span>
          <p>
            Buka aplikasi atau web emailmu di tab baru.
          </p>
        </div>
        <div className="verify-step-row">
          <span className="step-num">2</span>
          <p>
            Cari pesan dari <strong>ruang. / Supabase</strong>. Periksa juga folder <em>Spam</em> atau <em>Promosi</em> jika tidak langsung terlihat.
          </p>
        </div>
        <div className="verify-step-row">
          <span className="step-num">3</span>
          <p>
            Klik tombol <strong>Confirm your email</strong> di dalam pesan, lalu kembali ke sini untuk masuk.
          </p>
        </div>
      </div>

      {/* Webmail Shortcuts */}
      <div className="email-shortcuts-row">
        {isGmail ? (
          <a
            href="https://mail.google.com"
            target="_blank"
            rel="noreferrer"
            className="button-quiet webmail-link"
          >
            Buka Gmail <ExternalLink size={13} />
          </a>
        ) : isOutlook ? (
          <a
            href="https://outlook.live.com"
            target="_blank"
            rel="noreferrer"
            className="button-quiet webmail-link"
          >
            Buka Outlook <ExternalLink size={13} />
          </a>
        ) : (
          <a
            href={`https://${domain}`}
            target="_blank"
            rel="noreferrer"
            className="button-quiet webmail-link"
          >
            Buka Penyedia Email ({domain}) <ExternalLink size={13} />
          </a>
        )}

        {/* Resend Button with Cooldown */}
        <button
          type="button"
          className="button-quiet resend-email-btn"
          onClick={handleResend}
          disabled={resendCooldown > 0 || isResending}
        >
          <RefreshCw
            size={13}
            className={isResending ? "animate-spin" : ""}
          />
          <span>
            {isResending
              ? "Mengirim..."
              : resendCooldown > 0
              ? `Kirim ulang (${resendCooldown}s)`
              : "Kirim ulang email"}
          </span>
        </button>
      </div>

      {/* Action Buttons */}
      <div className="email-verify-actions">
        <button
          type="button"
          className="button-primary email-login-now-btn"
          onClick={onBackToLogin}
        >
          <span>Sudah Konfirmasi? Masuk</span>
          <ArrowRight size={15} />
        </button>

        <button
          type="button"
          className="email-change-btn"
          onClick={onChangeEmail}
        >
          <ArrowLeft size={13} />
          <span>Gunakan email lain</span>
        </button>
      </div>
    </motion.div>
  );
}
