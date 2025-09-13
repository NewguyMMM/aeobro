// components/EntityTypeHelp.tsx
"use client";

import { useState } from "react";

export default function EntityTypeHelp() {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label="What does each option mean?"
        title="What does each option mean?"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setOpen(false)}
        className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full border text-xs leading-none text-gray-600 hover:bg-gray-50"
      >
        ?
      </button>

      {open && (
        <div
          role="dialog"
          className="absolute z-20 mt-2 w-[24rem] max-w-sm rounded-xl border bg-white p-3 text-sm text-gray-700 shadow-lg"
        >
          <p className="mb-2 font-medium">Choosing an entity type</p>
          <ul className="list-disc space-y-1 pl-5 leading-5">
            <li>
              <strong>Business</strong> — general company; <em>i.e.</em> Organization or
              LocalBusiness.
            </li>
            <li>
              <strong>Local Service</strong> — local providers (clinics, plumbers, salons);
              <em> i.e.</em> LocalBusiness subtypes such as MedicalBusiness or ProfessionalService.
            </li>
            <li>
              <strong>Organization</strong> — non-profits, associations, schools, hospitals.
            </li>
            <li>
              <strong>Creator / Person</strong> — an individual; <em>i.e.</em> Person.
            </li>
          </ul>
        </div>
      )}
    </span>
  );
}
