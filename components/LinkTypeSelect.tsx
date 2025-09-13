// app/components/LinkTypeSelect.tsx
"use client";

const PRESETS = [
  "Website",
  "Products",
  "Menu",
  "Reviews",
  "Booking",
  "Portfolio",
  "Pricing",
  "Support",
  "Press",
  "Other",
];

type Props = {
  onPick: (label: string) => void;
  className?: string;
};

export default function LinkTypeSelect({ onPick, className }: Props) {
  return (
    <select
      className={className ?? "border rounded px-2 py-2 text-sm"}
      defaultValue=""
      onChange={(e) => {
        const v = e.target.value;
        if (v) onPick(v);
      }}
    >
      <option value="" disabled>
        Type…
      </option>
      {PRESETS.map((p) => (
        <option key={p} value={p}>
          {p}
        </option>
      ))}
    </select>
  );
}
