import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  applicationId: string;
  status: string;
  onRefresh: () => void;
}

export default function ActionButtons({
  applicationId,
  status,
  onRefresh,
}: Props) {
  const [loading, setLoading] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<"changes" | "reject" | null>(
    null,
  );
  const [reason, setReason] = useState("");

  const canApprove = status === "submitted" || status === "under_review";

  const canRequestChanges = status === "submitted" || status === "under_review";

  const canReject = status === "submitted" || status === "under_review";

  const runAction = async (rpc: string, reason?: string) => {
    setLoading(true);

    try {
      const payload: any = {
        p_application_id: applicationId,
      };

      if (reason) {
        payload.p_remarks = reason;
      }

      const { error } = await supabase.rpc(rpc, payload);

      if (error) throw error;

      setDialogOpen(false);
      setReason("");

      await onRefresh();
    } catch (err) {
      console.error(err);
      alert("Operation failed. Please check the console.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-[32px] border border-stone-200 bg-white/95 p-6 shadow-[0_24px_70px_-32px_rgba(15,23,42,0.15)] mt-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            Admin actions
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Review this application and select the appropriate path for
            onboarding.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            disabled={loading || !canApprove}
            onClick={() => runAction("approve_seller_application")}
            className="px-5 py-2.5"
          >
            Approve
          </Button>

          <Button
            variant="secondary"
            disabled={loading || !canRequestChanges}
            onClick={() => {
              setDialogType("changes");
              setReason("");
              setDialogOpen(true);
            }}
            className="px-5 py-2.5"
          >
            Request Changes
          </Button>

          <Button
            variant="destructive"
            disabled={loading || !canReject}
            onClick={() => {
              setDialogType("reject");
              setReason("");
              setDialogOpen(true);
            }}
            className="px-5 py-2.5"
          >
            Reject
          </Button>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {dialogType === "changes"
                ? "Request Changes"
                : "Reject Seller Application"}
            </DialogTitle>
          </DialogHeader>

          <Textarea
            placeholder={
              dialogType === "changes"
                ? "Describe what the seller needs to correct..."
                : "Enter the rejection reason..."
            }
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={6}
          />

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                setReason("");
              }}
            >
              Cancel
            </Button>

            <Button
              variant={dialogType === "reject" ? "destructive" : "default"}
              disabled={!reason.trim() || loading}
              onClick={async () => {
                if (dialogType === "changes") {
                  await runAction("request_seller_changes", reason.trim());
                } else {
                  await runAction("reject_seller_application", reason.trim());
                }
              }}
            >
              {loading
                ? "Processing..."
                : dialogType === "changes"
                  ? "Request Changes"
                  : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
