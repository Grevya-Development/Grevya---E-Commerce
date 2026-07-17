import { BadgeCheck, Clock, XCircle, AlertTriangle } from "lucide-react";

interface Props {
  storeName: string;
  ownerName: string;
  status: string;
}

export default function ApplicationHeader({
  storeName,
  ownerName,
  status,
}: Props) {
  const getStatusColor = () => {
    switch (status) {
      case "approved":
        return "bg-emerald-100 text-emerald-700";
      case "submitted":
        return "bg-sky-100 text-sky-700";
      case "under_review":
        return "bg-amber-100 text-amber-700";
      case "changes_requested":
        return "bg-orange-100 text-orange-700";
      case "rejected":
        return "bg-red-100 text-red-700";
      case "suspended":
        return "bg-rose-100 text-rose-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  const getIcon = () => {
    switch (status) {
      case "approved":
        return <BadgeCheck size={18} />;
      case "rejected":
        return <XCircle size={18} />;
      case "changes_requested":
        return <AlertTriangle size={18} />;
      default:
        return <Clock size={18} />;
    }
  };

  return (
    <div className="rounded-[32px] border border-stone-200 bg-white/95 p-6 shadow-[0_24px_70px_-30px_rgba(15,23,42,0.15)]">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500">
            Seller application
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
            {storeName}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Owned by{" "}
            <span className="font-medium text-slate-900">{ownerName}</span>
          </p>
        </div>

        <div
          className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold ${getStatusColor()}`}
        >
          {getIcon()}
          <span className="capitalize">{status.replace(/_/g, " ")}</span>
        </div>
      </div>
    </div>
  );
}
