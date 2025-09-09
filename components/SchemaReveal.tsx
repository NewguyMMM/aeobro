// components/SchemaReveal.tsx
"use client";

import { useState } from "react";

type Props = {
  /** The exact JSON-LD object you also embed via <script type="application/ld+json"> */
  schema: Record<string, any>;
  /** Absolute URL of the public profile page (used for Google Rich Results Test link) */
  profileUrl: string;
};

export default function SchemaReveal({ schema, profileUrl }: Props) {
  const [copied, setCopied] = useState(false);

  // Pretty-print for human viewing; React will escape HTML/JS safely in <code>{...}</code>
  const json = JSON.stringify(schema, null, 2);

  const richResultsUrl = `https://search.google.com/test/rich-results?url=${encodeURIComponent(
    profileUrl
  )}`;

  function onCopy() {
    navigator.clipboard.writeText(json).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <section className="mt-10 rounded-2xl border p-6 bg-white shadow-sm">
      {/* Badge + actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          <span className="text-green-700 text-sm font-medium">
            AI-Ready Schema Embedded
          </span>
        </div>

        <div className="flex items-center gap-3">
          <a
            href={richResultsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50"
            title="Open Google Rich Results Test with this page URL"
          >
            Test with Google Rich Results
          </a>
          <button
            onClick={onCopy}
            className="rounded-lg bg-black text-white px-3 py-1.5 text-sm hover:bg-gray-900"
            title="Copy JSON-LD to clipboard"
          >
            {copied ? "Copied!" : "Copy JSON-LD"}
          </button>
        </div>
      </div>

      {/* Collapsible schema viewer */}
      <details className="mt-5 group">
        <summary className="cursor-pointer select-none text-sm text-gray-700 hover:underline">
          View machine-readable schema
        </summary>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-gray-50 p-4 text-xs leading-relaxed text-gray-800">
          <code>{json}</code>
        </pre>

        {/* Best practices + disclaimer */}
        <div className="mt-4 rounded-lg border bg-gray-50 p-4">
          <h3 className="mb-2 text-sm font-semibold text-gray-800">
            Best Practices for Using Your JSON-LD Schema
          </h3>
          <ul className="list-disc pl-5 text-xs text-gray-700 space-y-1">
            <li>
              Embed your JSON-LD inside a{" "}
              <code className="rounded bg-white px-1 py-0.5">
                {"<script type=\"application/ld+json\">"}
              </code>{" "}
              tag in your page’s <em>head</em> or <em>body</em>.
            </li>
            <li>Do not paste the JSON directly into HTML without the script wrapper.</li>
            <li>Search engines and AI systems expect JSON-LD in a script block.</li>
            <li>
              Validate anytime with Google’s tool above to confirm rich result eligibility.
            </li>
          </ul>
          <p className="mt-3 text-[11px] leading-5 text-gray-500">
            <strong>Disclaimer:</strong> AEOBRO provides JSON-LD schema as-is. We are{" "}
            <strong>not responsible</strong> for how these files are used, embedded, or modified
            outside of <strong>aeobro.com</strong>. Improper usage may cause errors or security
            issues on your own site.
          </p>
        </div>
      </details>

      <p className="mt-3 text-[11px] text-gray-500">
        This is a human-visible copy for transparency. The same JSON-LD is embedded for crawlers via{" "}
        <code className="rounded bg-gray-100 px-1">{"<script type=\"application/ld+json\">"}</code>.
      </p>
    </section>
  );
}
