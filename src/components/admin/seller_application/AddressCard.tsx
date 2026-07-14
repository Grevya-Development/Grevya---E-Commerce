interface Address {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
}

interface Props {
  title: string;
  address: Address | null;
}

export default function AddressCard({
  title,
  address,
}: Props) {
  if (!address) {
    return (
      <div className="rounded-xl bg-white shadow p-6 mt-6">
        <h2 className="text-xl font-semibold mb-4">{title}</h2>
        <p className="text-gray-500">No address available.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white shadow p-6 mt-6">
      <h2 className="text-xl font-semibold mb-5">
        {title}
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        <div>
          <p className="text-gray-500 text-sm">Address Line 1</p>
          <p>{address.line1 || "-"}</p>
        </div>

        <div>
          <p className="text-gray-500 text-sm">Address Line 2</p>
          <p>{address.line2 || "-"}</p>
        </div>

        <div>
          <p className="text-gray-500 text-sm">City</p>
          <p>{address.city || "-"}</p>
        </div>

        <div>
          <p className="text-gray-500 text-sm">State</p>
          <p>{address.state || "-"}</p>
        </div>

        <div>
          <p className="text-gray-500 text-sm">Pincode</p>
          <p>{address.pincode || "-"}</p>
        </div>

        <div>
          <p className="text-gray-500 text-sm">Country</p>
          <p>{address.country || "-"}</p>
        </div>

      </div>
    </div>
  );
}