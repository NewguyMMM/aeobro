// app/(marketing)/pricing/page.tsx
import PricingClient from "./PricingClient";

export const revalidate = 3600; // ISR: cache for 1 hour

export default function PricingPage() {
  // Keep the page itself server-rendered so ISR applies,
  // and delegate interactivity to the client component.
  return <PricingClient />;
}
