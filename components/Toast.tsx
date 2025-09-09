// components/Toast.tsx
"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

type Variant = "info" | "success" | "error";
type ToastItem = { id: number; message: string; variant: Variant };

type ToastFn = (message: string, variant?: Variant) => void;

const ToastContext = createContext<ToastFn | null>(null);

export function useToast(): ToastFn {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // No throw; just no-op for safety in edge cases
    return () => {};
  }
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const timeouts = useRef<number[]>([]);

  useEffect(() => {
    setMounted(true); // ✅ only after this is true do we touch document
    return () => {
      // cleanup any pending dismiss timers
      timeouts.current.forEach((t) => window.clearTimeout(t));
      timeouts.current = [];
    };
  }, []);

  const push: ToastFn = useCallback((message, variant = "info") => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((ts) => [...ts, { id, message, variant }]);
    const t = window.setTimeout(() => {
      setToasts((ts) => ts.filter((x) => x.id !== id));
    }, 3000);
    timeouts.current.push(t);
  }, []);

  const value = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* ✅ Guard: don't reference document until mounted */}
      {mounted
        ? createPortal(
            <div
              className="fixed z-[1000] bottom-4 right-4 flex flex-col gap-2"
              aria-live="polite"
              aria-atomic="true"
            >
              {toasts.map((t) => (
                <div
                  key={t.id}
                  className={
                    "rounded-lg px-3 py-2 shadow-md text-sm text-white " +
                    (t.variant === "success"
                      ? "bg-green-600"
                      : t.variant === "error"
                      ? "bg-red-600"
                      : "bg-gray-800")
                  }
                >
                  {t.message}
                </div>
              ))}
            </div>,
            document.body
          )
        : null}
    </ToastContext.Provider>
  );
}
