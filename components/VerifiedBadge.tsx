export default function VerifiedBadge({ status }: { status?: string | null }) {
  if (!status || status === "UNVERIFIED") return null;
  const label = status === "DOMAIN_VERIFIED" ? "Verified (Domain)" : "Verified";
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs bg-emerald-600 text-white">
      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
        <path d="M9 16.2 5.5 12.7l1.4-1.4L9 13.4 16.1 6.3l1.4 1.4z" fill="currentColor" />
      </svg>
      {label}
    </span>
  );
}
