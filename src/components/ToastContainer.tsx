// src/components/ToastContainer.tsx
// ✅ Toast container - FIXED VERSION
// Displays all toast notifications as popups

import { useToast } from "../context/ToastContext";
import ToastItem from "./ToastItem";

export default function ToastContainer() {
  const { toasts } = useToast();

  return (
    <div
      style={{
        position: "fixed",
        top: "20px",
        right: "20px",
        zIndex: 9999,
        maxWidth: "400px",
        pointerEvents: "none",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}