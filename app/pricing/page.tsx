export default function PricingPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <h1 className="text-4xl font-bold mb-2">Pricing</h1>
      <p className="text-neutral-600 mb-8">Pick the plan that matches your identity type.</p>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Lite */}
        <div className="flex flex-col rounded-2xl border p-6 shadow-sm bg-white">
          <h3 className="text-xl font-semibold mb-2">Lite</h3>
          <p className="text-3xl font-bold">$3.99<span className="text-base font-normal">/mo</span></p>
          <ul className="list-disc pl-5 mt-4 space-y-1 text-sm">
            <li>For creators & individuals</li>
            <li>Verify via YouTube/Google/Instagram/TikTok</li>
            <li>Exports: <strong>Person/Creator</strong></li>
            <li>3 links · 1 logo</li>
          </ul>
          <a href="/api/checkout?plan=lite"
             className="mt-6 inline-flex items-center justify-center w-full bg-black text-white rounded-md px-4 py-2">
            Start Lite
          </a>
        </div>

        {/* Pro */}
        <div className="flex flex-col rounded-2xl border p-6 shadow-sm bg-white">
          <h3 className="text-xl font-semibold mb-2">Pro</h3>
          <p className="text-3xl font-bold">$49<span className="text-base font-normal">/mo</span></p>
          <ul className="list-disc pl-5 mt-4 space-y-1 text-sm">
            <li>For official businesses</li>
            <li>Domain verification (DNS or @domain email)</li>
            <li>Exports: <strong>Organization/LocalBusiness</strong></li>
            <li>FAQ & Service markup</li>
            <li>10 links + images · Change history</li>
          </ul>
          <a href="/api/checkout?plan=pro"
             className="mt-6 inline-flex items-center justify-center w-full bg-black text-white rounded-md px-4 py-2">
            Start Pro
          </a>
        </div>

        {/* Business */}
        <div className="flex flex-col rounded-2xl border p-6 shadow-sm bg-white">
          <h3 className="text-xl font-semibold mb-2">Business</h3>
          <p className="text-3xl font-bold">$199<span className="text-base font-normal">/mo</span></p>
          <ul className="list-disc pl-5 mt-4 space-y-1 text-sm">
            <li>All Pro features</li>
            <li>Multi-location (10) & team seats (3)</li>
            <li>Bulk import & webhooks</li>
            <li>Advanced analytics</li>
          </ul>
          <a href="/api/checkout?plan=business"
             className="mt-6 inline-flex items-center justify-center w-full bg-black text-white rounded-md px-4 py-2">
            Start Business
          </a>
        </div>
      </div>
    </div>
  );
}
