// components/EntityTypeHelp.tsx
// 📅 Updated: 2025-11-26 09:45 ET
"use client";

import * as React from "react";

export default function EntityTypeHelp() {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative inline-block align-middle ml-1"
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-gray-200 text-[10px] font-semibold text-gray-700 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label="Help choosing an entity type"
        aria-expanded={open}
        aria-haspopup="true"
      >
        i
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-80 rounded-md border border-gray-200 bg-white p-3 text-xs text-gray-700 shadow-lg z-20">
          <p className="font-semibold mb-2">Choosing an entity type</p>
          <ul className="list-disc pl-4 space-y-1">
            <li>
              <span className="font-semibold">Business</span> — general company;
              e.g., <code className="bg-gray-100 px-0.5 rounded">Organization</code>{" "}
              or <code className="bg-gray-100 px-0.5 rounded">LocalBusiness</code>.
            </li>
            <li>
              <span className="font-semibold">Local Service</span> — local
              providers (clinics, plumbers, salons); includes medical practices
              and other service businesses with a physical service area.
            </li>
            <li>
              <span className="font-semibold">Organization</span> — non-profits,
              associations, schools, hospitals, and other institutions.
            </li>
            <li>
              <span className="font-semibold">Creator / Person</span> — an
              individual; e.g., consultant, influencer, author, or solo
              professional.
            </li>
            <li>
              <span className="font-semibold">Product</span> — a single product
              or software app where the product itself is the main thing AI
              should recognize (e.g., a SaaS tool, mobile app, or flagship
              physical product).
            </li>
          </ul>
          <p className="mt-2 text-[11px] text-gray-500">
            You can change this later. AEOBRO maps your choice to the closest
            matching schema.org type for AI and search engines.
          </p>
        </div>
      )}
    </div>
  );
}
