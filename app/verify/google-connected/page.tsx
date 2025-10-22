"use client";
import { useEffect, useState } from "react";

export default function GoogleConnected() {
  const [msg, setMsg] = useState("Finishing verification…");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/verify/platform/google", { method: "POST" });
        const data = await res.json();
        if (data?.ok) setMsg("✅ Platform verified!");
        else setMsg(`❌ ${data?.error || "Verification failed"}`);
      } catch (e) {
        setMsg("❌ Network error");
      }
    })();
  }, []);

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-semibold">Google / YouTube Verification</h1>
      <p className="mt-4">{msg}</p>
    </main>
  );
}
