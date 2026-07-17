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

export default function AddressCard({ title, address }: Props) {
  if (!address) {
    return (
      <div className="rounded-[32px] border border-stone-200 bg-white/95 p-6 shadow-[0_24px_70px_-32px_rgba(15,23,42,0.14)] mt-6">
        <h2 className="text-xl font-semibold mb-4 text-slate-900">{title}</h2>
        <p className="text-slate-600">No address available.</p>
      </div>
    );
  }

  return (
    <div className="rounded-[32px] border border-stone-200 bg-white/95 p-6 shadow-[0_24px_70px_-32px_rgba(15,23,42,0.14)] mt-6">
      <div className="flex items-center justify-between gap-4 border-b border-stone-200 pb-5">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
          <p className="mt-2 text-sm text-slate-600">
            Comprehensive location details for this address type.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
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
