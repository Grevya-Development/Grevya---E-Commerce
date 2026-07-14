interface Props {
  bank: any;
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
      <p className="font-medium">{value || "-"}</p>
    </div>
  );
}

export default function BankDetailsCard({ bank }: Props) {
  if (!bank) {
    return (
      <div className="rounded-xl bg-white shadow p-6 mt-6">
        <h2 className="text-xl font-semibold mb-4">
          Bank Details
        </h2>

        <p className="text-gray-500">
          No bank details submitted.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white shadow p-6 mt-6">
      <h2 className="text-xl font-semibold mb-5">
        Payout Account
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        <Detail
          label="Account Holder"
          value={bank.account_holder_name}
        />

        <Detail
          label="Bank Name"
          value={bank.bank_name}
        />

        <Detail
          label="Account Number"
          value={bank.account_number}
        />

        <Detail
          label="IFSC Code"
          value={bank.ifsc_code}
        />

        <Detail
          label="Verified"
          value={bank.is_verified ? "Yes" : "No"}
        />

        <Detail
          label="Verified At"
          value={
            bank.verified_at
              ? new Date(bank.verified_at).toLocaleString()
              : "-"
          }
        />

      </div>
    </div>
  );
}