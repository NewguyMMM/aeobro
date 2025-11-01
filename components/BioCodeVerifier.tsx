"use client";

import * as React from "react";

type Props = {
  platform: "instagram" | "x" | "tiktok" | "substack" | "youtube" | "facebook" | "linkedin" | "github";
  initialProfileUrl?: string;
};

function platformNiceName(p: Props["platform"]) {
  switch (p) {
    case "x": return "X (Twitter)";
    case "tiktok": return "TikTok";
    case "substack": return "Substack";
    default: return p.charAt(0).toUpperCase() + p.slice(1);
  }
}

export default function BioCodeVerifier({ platform, initialProfileUrl = "" }: Props) {
  const [profileUrl, setProfileUrl] = React.useState(initialProfileUrl);
  const [code, setCode] = React.useState<string>("");
  const [expiresAt, setExpiresAt] = React.useState<string>("");
  const [status, setStatus] = React.useState<null | "idle" | "gen" | "check" | "ok" | "fail" | "error">(null);
  const [msg, setMsg] = React.useState<string>("");

  async function onGenerate() {
    try {
      setStatus("gen"); setMsg("");
      const res = await fetch("/api/verify/bio-code/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, profileUrl }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Failed to generate code");
      setCode(json.code);
      setExpiresAt(json.expiresAt);
      setStatus("idle");
      setMsg("Code generated. Paste it into your bio, then click Check.");
    } catch (e: any) {
      setStatus("error");
      setMsg(e?.message || "Error generating code");
    }
  }

  async function onCheck() {
    try {
      setStatus("check"); setMsg("");
      const res = await fetch("/api/verify/bio-code/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, profileUrl }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        setStatus("fail");
        setMsg(json?.status === "NOT_FOUND"
          ? "We didn’t find the code in your bio yet. Save changes on the platform and try again."
          : (json?.error || "Verification not found"));
        return;
      }
      setStatus("ok");
      setMsg("Verified! This account is now marked as platform-verified via Code-in-Bio.");
    } catch (e: any) {
      setStatus("error");
      setMsg(e?.message || "Error checking code");
    }
  }

  const disabled = status === "gen" || status === "check";

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="font-semibold">{platformNiceName(platform)}</div>
        {status === "ok" && (
          <div className="rounded-full bg-green-100 text-green-700 text-xs px-2 py-1">Verified</div>
        )}
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Profile URL</label>
        <input
          className="w-full rounded-xl border px-3 py-2 text-sm"
          placeholder={placeholderForPlatform(platform)}
          value={profileUrl}
          onChange={(e) => setProfileUrl(e.target.value)}
        />
        <p className="text-xs text-neutral-600">
          Paste your public profile URL (e.g., your @{platform} page). We’ll fetch your bio to check for the code.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          disabled={!profileUrl || disabled}
          onClick={onGenerate}
          className="rounded-xl bg-blue-600 px-4 py-2 text-white text-sm disabled:opacity-50"
        >
          {status === "gen" ? "Generating…" : "Generate Code"}
        </button>
        <button
          disabled={!profileUrl || disabled}
          onClick={onCheck}
          className="rounded-xl border px-4 py-2 text-sm disabled:opacity-50"
        >
          {status === "check" ? "Checking…" : "Check Now"}
        </button>
      </div>

      {code && (
        <div className="rounded-xl bg-neutral-50 p-3 text-sm">
          <div className="font-medium">Your code:</div>
          <code className="block break-all">{code}</code>
          {expiresAt && (
            <div className="text-xs text-neutral-600 mt-1">Expires: {new Date(expiresAt).toLocaleString()}</div>
          )}
          <ul className="list-disc pl-5 mt-2 text-xs text-neutral-700 space-y-1">
            <li>Copy the code exactly as shown.</li>
            <li>Open your {platformNiceName(platform)} profile settings and paste it into your bio/about section.</li>
            <li>Make sure your profile is public, then click <strong>Check Now</strong>.</li>
          </ul>
        </div>
      )}

      {!!msg && (
        <div
          className={
            "text-sm " +
            (status === "ok"
              ? "text-green-700"
              : status === "fail" || status === "error"
                ? "text-red-700"
                : "text-neutral-700")
          }
        >
          {msg}
        </div>
      )}
    </div>
  );
}

function placeholderForPlatform(platform: Props["platform"]) {
  switch (platform) {
    case "instagram": return "https://www.instagram.com/your_handle/";
    case "x":         return "https://x.com/your_handle";
    case "tiktok":    return "https://www.tiktok.com/@your_handle";
    case "substack":  return "https://yourname.substack.com/";
    case "youtube":   return "https://www.youtube.com/@your_handle";
    case "facebook":  return "https://www.facebook.com/your.profile";
    case "linkedin":  return "https://www.linkedin.com/in/your-handle/";
    case "github":    return "https://github.com/yourname";
    default:          return "";
  }
}
