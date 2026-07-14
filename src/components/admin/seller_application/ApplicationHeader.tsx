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
        return "bg-green-100 text-green-700";
      case "submitted":
        return "bg-blue-100 text-blue-700";
      case "under_review":
        return "bg-yellow-100 text-yellow-700";
      case "changes_requested":
        return "bg-orange-100 text-orange-700";
      case "rejected":
        return "bg-red-100 text-red-700";
      case "suspended":
        return "bg-red-200 text-red-800";
      default:
        return "bg-gray-100 text-gray-700";
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
    <div className="rounded-xl bg-white p-6 shadow">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{storeName}</h1>

          <p className="text-gray-600 mt-1">
            Owner: <strong>{ownerName}</strong>
          </p>
        </div>

        <div
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${getStatusColor()}`}
        >
          {getIcon()}
          {status.replace(/_/g, " ")}
        </div>
      </div>
    </div>
  );
}
