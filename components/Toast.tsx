// components/Toast.tsx
"use client";
import React from "react";
import { createPortal } from "react-dom";

type ToastItem = { id: number; message: string; tone?: "success"|"error"|"info" };

const ToastContext = React.createContext<(msg: string, tone?: ToastItem["tone"]) => void>(()=>{});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const counter = React.useRef(0);

  const push = React.useCallback((message: string, tone: ToastItem["tone"]="info") => {
    const id = ++counter.current;
    setItems((xs) => [...xs, { id, message, tone }]);
    setTimeout(() => setItems((xs) => xs.filter((t) => t.id !== id)), 2500);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      {createPortal(
        <div className="fixed z-50 bottom-4 right-4 space-y-2">
          {items.map((t) => (
            <div
              key={t.id}
              className={`rounded-xl px-4 py-3 shadow text-white ${
                t.tone === "success" ? "bg-green-600" :
                t.tone === "error" ? "bg-red-600" : "bg-gray-800"
              }`}
            >
              {t.message}
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return React.useContext(ToastContext);
}
