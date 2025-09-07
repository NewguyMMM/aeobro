export default ()=> (<section className='container py-16'><h1 className='text-4xl font-extrabold'>Terms</h1><p className='mt-6'>No ranking guarantees. No impersonation. Follow laws.</p></section>);// app/(marketing)/terms/page.tsx
import React from "react";

export default function Page() {
  return (
    <section className="container py-16">
      <h1 className="text-4xl font-extrabold mb-10">Terms of Service</h1>

      <div className="space-y-8">
        <div className="card">
          <h3 className="font-semibold">Cancellations & Billing Cycle</h3>
          <p className="text-gray-700 mt-2">
            Cancellations take effect at the end of the current billing cycle. When you cancel, you
            retain access to paid features until the end of your current billing period. After that
            date, your public profile becomes unavailable and editing is disabled.
          </p>
        </div>

        <div className="card">
          <h3 className="font-semibold">Data Retention After Cancellation</h3>
          <p className="text-gray-700 mt-2">
            We retain your profile data for <strong>90 days</strong> following the end of your
            billing period so you can reactivate. After 90 days without reactivation, data may be
            permanently deleted in accordance with our retention policy.
          </p>
        </div>

        <div className="card">
          <h3 className="font-semibold">Refunds</h3>
          <p className="text-gray-700 mt-2">
            AEOBRO does not provide refunds. If a profile is taken down or frozen for investigation,
            no refund will be issued. You may cancel at any time; cancellation stops renewals, and
            access continues until the end of the current billing period.
          </p>
        </div>
      </div>
    </section>
  );
}
