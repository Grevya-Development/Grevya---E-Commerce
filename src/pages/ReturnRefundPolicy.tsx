import React from 'react';
import PolicyLayout from '@/components/PolicyLayout';
import { ShieldCheck, Truck, RotateCcw, HelpCircle, AlertTriangle, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';

const ReturnRefundPolicy = () => {
  return (
    <PolicyLayout title="Return & Refund Policy" updated="June 2026">
      
      {/* Intro Editorial section */}
      <div className="space-y-4 mb-10">
        <p className="text-base md:text-lg text-neutral-600 leading-relaxed font-serif italic border-l-2 border-[#A68D65]/40 pl-4 py-1">
          "At Grevya Naturals, each formulation is a fresh, botanical composition handcrafted in small, active batches. To preserve the purity, clinical hygiene, and freshness of our organic lifestyle goods, we maintain a refined, rigorous policy regarding returns and fulfillment."
        </p>
      </div>

      {/* SECTION 1 */}
      <section className="space-y-4">
        <h2 className="font-serif text-2xl font-bold text-[#33381C]">1. The Purity & Hygiene Directive</h2>
        <div className="grid md:grid-cols-[auto_1fr] gap-4 p-5 rounded-2xl bg-[#FBF7F1] border border-[#A68D65]/10 items-start">
          <ShieldCheck className="w-8 h-8 text-[#A68D65] mt-1 shrink-0" />
          <div className="space-y-2">
            <p className="font-semibold text-neutral-800 text-sm">Why all sales are final</p>
            <p className="text-neutral-600 text-xs leading-relaxed">
              Because our skincare, wellness, and lifestyle preparations are organic, chemical-preservative-free, and highly sensitive to environmental factors, we do not allow returns or refunds for any products once they have left our controlled-temperature fulfillment center. This policy guarantees that every patron receives a guaranteed untouched, untampered, and fresh product.
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 2 */}
      <section className="space-y-4 mt-8">
        <h2 className="font-serif text-2xl font-bold text-[#33381C]">2. Transit & Damage Indemnity</h2>
        <p className="text-neutral-600 text-sm leading-relaxed">
          While all items are final sale, we insure every shipment to ensure peace of mind. If your package encounters misfortune during transit, we take complete responsibility for resolving the issue immediately.
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-5 rounded-2xl border border-red-100 bg-red-50/20 space-y-2">
            <div className="flex items-center gap-2 text-red-800 font-bold text-xs uppercase tracking-wide">
              <AlertTriangle className="w-4 h-4 text-red-600" /> Damaged Shipments
            </div>
            <p className="text-neutral-600 text-xs leading-relaxed">
              If a glass jar, botanical vial, or packaging arrives compromised, leaked, or broken, please notify our concierge within 48 hours of receipt. We will process a complimentary replacement or refund.
            </p>
          </div>
          <div className="p-5 rounded-2xl border border-emerald-100 bg-emerald-50/20 space-y-2">
            <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs uppercase tracking-wide">
              <Truck className="w-4 h-4 text-emerald-600" /> Delivery Discrepancies
            </div>
            <p className="text-neutral-600 text-xs leading-relaxed">
              Should our logistics partners report your order as delivered, but it has not arrived, or if a shipment is lost in transit, please contact us immediately to initiate a trace and coordinate a resolution.
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 3 */}
      <section className="space-y-4 mt-8">
        <h2 className="font-serif text-2xl font-bold text-[#33381C]">3. Fulfillment & Accuracy</h2>
        <div className="p-5 rounded-2xl bg-[#FBF7F1] border border-[#A68D65]/10 space-y-3">
          <div className="flex items-center gap-2 font-bold text-[#33381C] text-sm">
            <RotateCcw className="w-4 h-4 text-[#A68D65]" /> Incorrect Items Dispatched
          </div>
          <p className="text-neutral-600 text-xs leading-relaxed">
            In the rare event that our artisan packaging team dispatches an incorrect blend, size, or product, we will immediately ship the correct item to you at zero cost. To preserve your convenience, we do not require you to ship the incorrect item back to us.
          </p>
        </div>
      </section>

      {/* SECTION 4 */}
      <section className="space-y-4 mt-8">
        <h2 className="font-serif text-2xl font-bold text-[#33381C]">4. Resolution Blueprint</h2>
        <p className="text-neutral-600 text-sm leading-relaxed font-medium">
          If you need to submit a claim for a transit-damaged or incorrect shipment, follow our three-step resolution pathway:
        </p>

        <div className="grid md:grid-cols-3 gap-4 pt-2">
          {[
            {
              step: 'Step 01',
              title: 'Document & Verify',
              desc: 'Take a clear photograph or brief video of the damaged item and the shipping label on the box.',
            },
            {
              step: 'Step 02',
              title: 'Connect with Concierge',
              desc: 'Email info@grevya.com within 48 hours of delivery. Include your Order ID and attach your documentation.',
            },
            {
              step: 'Step 03',
              title: 'Dispatch & Resolve',
              desc: 'Our support team will verify the claim and dispatch a replacement package or process a refund within 24 hours.',
            },
          ].map((item, idx) => (
            <div 
              key={idx} 
              className="p-5 rounded-2xl border border-[#A68D65]/12 bg-white flex flex-col justify-between shadow-2xs hover:shadow-sm transition-all"
            >
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#A68D65] block mb-2">{item.step}</span>
                <h4 className="font-serif font-bold text-base text-[#33381C] mb-2">{item.title}</h4>
                <p className="text-neutral-500 text-xs leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ CTA */}
      <div className="mt-12 p-6 rounded-[2rem] bg-[#33381C] text-white flex flex-col sm:flex-row items-center justify-between gap-4 border border-[#A68D65]/30">
        <div className="space-y-1 text-center sm:text-left">
          <h4 className="font-serif font-bold text-lg text-[#F7EEE4] flex items-center justify-center sm:justify-start gap-2">
            <HelpCircle className="w-5 h-5 text-[#A68D65]" /> Have any questions?
          </h4>
          <p className="text-white/60 text-xs">Our customer support concierge is ready to assist you at all times.</p>
        </div>
        <a 
          href="mailto:info@grevya.com" 
          className="bg-[#F7EEE4] hover:bg-[#EAE2D5] text-[#33381C] font-extrabold uppercase tracking-wide text-xs py-3 px-6 rounded-xl transition-all shadow-md hover:-translate-y-0.5 shrink-0"
        >
          Email Support
        </a>
      </div>

    </PolicyLayout>
  );
};

export default ReturnRefundPolicy;
