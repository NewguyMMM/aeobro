"use client";

import * as React from "react";

export default function MobileMenu() {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="relative sm:hidden">
      <button
        type="button"
        className="btn transition-colors duration-200"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        Menu
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-56 rounded-lg border bg-white shadow-lg z-50"
          role="menu"
        >
          <a
            href="/pricing"
            className="block px-4 py-3 text-sm hover:bg-gray-50"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            Pricing
          </a>
          <a
            href="/faq"
            className="block px-4 py-3 text-sm hover:bg-gray-50"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            FAQ
          </a>
          <a
            href="/audit"
            className="block px-4 py-3 text-sm hover:bg-gray-50"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            Check AI Visibility
          </a>
        </div>
      )}
    </div>
  );
}
