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
  const [dialogType, setDialogType] = useState<
    "changes" | "reject" | null
  >(null);
  const [reason, setReason] = useState("");

  const canApprove =
    status === "submitted" || status === "under_review";

  const canRequestChanges =
    status === "submitted" || status === "under_review";

  const canReject =
    status === "submitted" || status === "under_review";

  const runAction = async (
    rpc: string,
    reason?: string
  ) => {
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
    <div className="rounded-xl bg-white shadow p-6 mt-6">
      <h2 className="text-xl font-semibold mb-4">
        Admin Actions
      </h2>

      <div className="flex gap-3">

        <Button
          disabled={loading || !canApprove}
          onClick={() =>
            runAction("approve_seller_application")
          }
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
        >
          Reject
        </Button>

      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      >
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
              variant={
                dialogType === "reject"
                  ? "destructive"
                  : "default"
              }
              disabled={!reason.trim() || loading}
              onClick={async () => {
                if (dialogType === "changes") {
                  await runAction(
                    "request_seller_changes",
                    reason.trim()
                  );
                } else {
                  await runAction(
                    "reject_seller_application",
                    reason.trim()
                  );
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