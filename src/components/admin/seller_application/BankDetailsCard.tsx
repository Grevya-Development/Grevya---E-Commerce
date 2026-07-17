interface Props {
  bank: any;
}

function Detail({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="font-medium">{value || "-"}</p>
    </div>
  );
}

export default function BankDetailsCard({ bank }: Props) {
  if (!bank) {
    return (
      <div className="rounded-[32px] border border-stone-200 bg-white/95 p-6 shadow-[0_24px_70px_-32px_rgba(15,23,42,0.14)] mt-6">
        <h2 className="text-xl font-semibold mb-4 text-slate-900">
          Payout account
        </h2>

        <p className="text-slate-600">No bank details submitted.</p>
      </div>
    );
  }

  return (
    <div className="rounded-[32px] border border-stone-200 bg-white/95 p-6 shadow-[0_24px_70px_-32px_rgba(15,23,42,0.14)] mt-6">
      <div className="flex items-center justify-between gap-4 border-b border-stone-200 pb-5">
        <h2 className="text-xl font-semibold text-slate-900">Payout account</h2>
        <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">
          {bank.is_verified ? "Verified" : "Pending verification"}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Detail label="Account Holder" value={bank.account_holder_name} />

        <Detail label="Bank Name" value={bank.bank_name} />

        <Detail label="Account Number" value={bank.account_number} />

        <Detail label="IFSC Code" value={bank.ifsc_code} />

        <Detail label="Verified" value={bank.is_verified ? "Yes" : "No"} />

        <Detail
          label="Verified At"
          value={
            bank.verified_at ? new Date(bank.verified_at).toLocaleString() : "-"
          }
        />
      </div>
    </div>
  );
}
