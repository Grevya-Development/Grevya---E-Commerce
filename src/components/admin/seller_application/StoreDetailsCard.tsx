interface Props {
  application: any;
}

function Detail({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="font-medium text-gray-900">{value || "-"}</p>
    </div>
  );
}

export default function StoreDetailsCard({ application }: Props) {
  return (
    <div className="rounded-[32px] border border-stone-200 bg-white/95 p-6 shadow-[0_24px_70px_-32px_rgba(15,23,42,0.14)] mt-6">
      <div className="flex flex-col gap-3 border-b border-stone-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            Store information
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Seller details and business credentials.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">
          {application.business_type || "Seller profile"}
        </span>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <Detail label="Store Name" value={application.store_name} />

        <Detail label="Owner" value={application.owner_full_name} />

        <Detail label="Email" value={application.email} />

        <Detail label="Phone" value={application.phone} />

        <Detail label="Business Type" value={application.business_type} />

        <Detail label="PAN Number" value={application.pan_number} />

        <Detail label="GSTIN" value={application.gstin} />

        <Detail
          label="AYUSH License"
          value={application.ayush_license_number}
        />

        <Detail
          label="FSSAI License"
          value={application.fssai_license_number}
        />

        <Detail
          label="Brand Authorization"
          value={application.brand_authorization_reference}
        />

        <Detail
          label="Categories"
          value={application.product_categories?.join(", ")}
        />

        <Detail
          label="Submitted"
          value={
            application.submitted_at
              ? new Date(application.submitted_at).toLocaleString()
              : "-"
          }
        />
      </div>
    </div>
  );
}
