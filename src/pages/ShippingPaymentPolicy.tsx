import React from 'react';
import PolicyLayout from '@/components/PolicyLayout';

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

const Section = ({ title, children }: SectionProps) => (
  <section>
    <h2 className="text-lg font-serif font-semibold text-green-800 mb-2 uppercase tracking-wide">{title}</h2>
    <div className="space-y-2">{children}</div>
  </section>
);

const ShippingPaymentPolicy = () => {
  return (
    <PolicyLayout title="Shipping & Payment Policy">
      <p>
        We endeavour to dispatch all products ordered within 48 hours after the order has been placed and accepted
        by us. You will be given an indication of the expected delivery time when you place your order online.
        GREVYA NATURALS insures each order through transit up until it is delivered to you or is collected. You need
        to sign a confirmation of receipt of the products when the products are collected and by doing so, you
        accept the responsibility for the products ordered from that moment on. If the recipient or collector is not
        the original purchaser, or in case of delivery of a gift, then you accept this signature as evidence of
        delivery and fulfillment of your order.
      </p>

      <Section title="Delivery Charges">
        <p>(based on selection) All domestic orders are delivered for free of charge.</p>
      </Section>

      <Section title="Additional Charges">
        <p>There are no additional charges. The total payable amount is indicated on the individual items.</p>
      </Section>

      <Section title="Delivery Time">
        <p>
          This may vary depending on the delivery location and services of our logistics partner. However, we
          endeavour to deliver orders within 4 to 7 Business days (excludes public holidays).
        </p>
      </Section>

      <Section title="Delivery Areas">
        <p>
          We deliver PAN India. For further information please call us on{' '}
          <a href="tel:+919566966054" className="text-green-700 underline">95669 66054</a> 10 AM to 5 PM, Monday to
          Saturday on business days (excludes public holidays) or write to us at{' '}
          <a href="mailto:info@grevya.com" className="text-green-700 underline">info@grevya.com</a>.
        </p>
      </Section>

      <Section title="Payment Mode">
        <p>
          You can pay by Cash on Delivery (COD), Online through Internet banking, Visa, MasterCard, American
          Express, Maestro, Debit cards, IMPS.
        </p>
      </Section>
    </PolicyLayout>
  );
};

export default ShippingPaymentPolicy;
