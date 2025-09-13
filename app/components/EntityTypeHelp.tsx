// app/components/EntityTypeHelp.tsx
"use client";

import { useState } from "react";

export default function EntityTypeHelp() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setOpen(false)}
        className="ml-2 align-middle rounded-full border px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-50"
        aria-label="Entity type help"
        title="What does each option mean?"
      >
        ?
      </button>

      {open && (
        <div
          className="absolute z-20 mt-2 w-[22rem] max-w-sm rounded-xl border bg-white p-3 text-sm text-gray-700 shadow-lg"
          role="dialog"
        >
          <p className="mb-2 font-medium">Choosing an entity type</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Business</strong> — general company; maps to
              <code className="mx-1 rounded bg-gray-100 px-1">Organization</code> or broad
              <code className="mx-1 rounded bg-gray-100 px-1">LocalBusiness</code>.
            </li>
            <li>
              <strong>Local Service</strong> — local providers (clinics, plumbers, salons).
              Maps to <code className="mx-1 rounded bg-gray-100 px-1">LocalBusiness</code> and
              subtypes like <code className="mx-1 rounded bg-gray-100 px-1">MedicalBusiness</code>,
              <code className="mx-1 rounded bg-gray-100 px-1">ProfessionalService</code>.
            </li>
            <li>
              <strong>Organization</strong> — non-profits, associations, schools, hospitals.
            </li>
            <li>
              <strong>Creator / Person</strong> — an individual; maps to
              <code className="mx-1 rounded bg-gray-100 px-1">Person</code>.
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
