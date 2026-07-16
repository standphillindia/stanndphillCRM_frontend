// src/components/ToastItem.tsx
// ✅ Toast item - FIXED VERSION
// Individual toast notification popup with animations

import { useState } from "react";
import { useToast, type Toast } from "../context/ToastContext";

interface ToastItemProps {
  toast: Toast;
}

export default function ToastItem({ toast }: ToastItemProps) {
  const { removeToast } = useToast();
  const [isExiting, setIsExiting] = useState(false);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      removeToast(toast.id);
    }, 300);
  };

  const typeStyles = {
    success: {
      bg: "#dcfce7",
      border: "#86efac",
      text: "#166534",
      icon: "✓",
      iconColor: "#16a34a",
    },
    error: {
      bg: "#fee2e2",
      border: "#fca5a5",
      text: "#991b1b",
      icon: "✕",
      iconColor: "#dc2626",
    },
    warning: {
      bg: "#fef3c7",
      border: "#fde68a",
      text: "#92400e",
      icon: "!",
      iconColor: "#f59e0b",
    },
    info: {
      bg: "#dbeafe",
      border: "#bfdbfe",
      text: "#0c4a6e",
      icon: "ℹ",
      iconColor: "#0284c7",
    },
  };

  const style = typeStyles[toast.type];

  return (
    <>
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(420px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes slideOut {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(420px);
            opacity: 0;
          }
        }
        .toast-item {
          animation: ${isExiting ? "slideOut" : "slideIn"} 0.3s ease-out forwards;
        }
      `}</style>

      <div
        className="toast-item"
        style={{
          background: style.bg,
          border: `1px solid ${style.border}`,
          borderRadius: "8px",
          padding: "16px",
          display: "flex",
          gap: "12px",
          pointerEvents: "auto",
          minWidth: "300px",
          maxWidth: "400px",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
        }}
      >
        {/* Icon */}
        <div
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            background: `${style.iconColor}20`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "18px",
            fontWeight: "bold",
            color: style.iconColor,
            flexShrink: 0,
          }}
        >
          {style.icon}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {toast.title && (
            <p
              style={{
                margin: "0 0 4px 0",
                fontSize: "14px",
                fontWeight: 600,
                color: style.text,
              }}
            >
              {toast.title}
            </p>
          )}
          <p
            style={{
              margin: 0,
              fontSize: "13px",
              color: style.text,
              opacity: 0.9,
              lineHeight: "1.4",
              wordBreak: "break-word",
            }}
          >
            {toast.message}
          </p>
        </div>

        {/* Close button */}
        <button
          onClick={handleDismiss}
          style={{
            background: "none",
            border: "none",
            fontSize: "18px",
            cursor: "pointer",
            color: style.text,
            opacity: 0.6,
            padding: "0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "24px",
            height: "24px",
            flexShrink: 0,
            transition: "opacity 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = "1";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = "0.6";
          }}
        >
          ✕
        </button>
      </div>
    </>
  );
}