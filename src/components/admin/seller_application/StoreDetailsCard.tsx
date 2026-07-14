
interface Props {
  application: any;
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: any;
}) {
  return (
    <div>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="font-medium text-gray-900">
        {value || "-"}
      </p>
    </div>
  );
}

export default function StoreDetailsCard({ application }: Props) {
  return (
    <div className="rounded-xl bg-white shadow p-6 mt-6">
      <h2 className="text-xl font-semibold mb-5">
        Store Information
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        <Detail
          label="Store Name"
          value={application.store_name}
        />

        <Detail
          label="Owner"
          value={application.owner_full_name}
        />

        <Detail
          label="Email"
          value={application.email}
        />

        <Detail
          label="Phone"
          value={application.phone}
        />

        <Detail
          label="Business Type"
          value={application.business_type}
        />

        <Detail
          label="PAN Number"
          value={application.pan_number}
        />

        <Detail
          label="GSTIN"
          value={application.gstin}
        />

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
          value={
            application.product_categories?.join(", ")
          }
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