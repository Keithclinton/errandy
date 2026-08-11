import { useState } from "react";
import { toast } from "sonner";
import { Flag } from "lucide-react";
import { useCreateReport } from "@/hooks/use-reports";
import { ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ReportReason, ReportTargetType } from "@/types/api";

const REASONS: { value: ReportReason; label: string }[] = [
  { value: "spam", label: "Spam" },
  { value: "scam", label: "Scam" },
  { value: "harassment", label: "Harassment" },
  { value: "inappropriate_content", label: "Inappropriate content" },
  { value: "no_show", label: "No-show" },
  { value: "other", label: "Other" },
];

export function ReportDialog({
  targetType,
  targetId,
  triggerLabel = "Report",
}: {
  targetType: ReportTargetType;
  targetId: string;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | "">("");
  const [details, setDetails] = useState("");
  const createReport = useCreateReport();

  const onSubmit = async () => {
    if (!reason) {
      toast.error("Choose a reason.");
      return;
    }
    try {
      await createReport.mutateAsync({ targetType, targetId, reason, details: details || undefined });
      toast.success("Report submitted. Thanks for helping keep Errandspot safe.");
      setOpen(false);
      setReason("");
      setDetails("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't submit your report.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <Flag className="mr-1.5 h-3.5 w-3.5" /> {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report {targetType}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Reason</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as ReportReason)}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Details (optional)</Label>
            <Textarea value={details} onChange={(e) => setDetails(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onSubmit} disabled={createReport.isPending}>
            {createReport.isPending ? "Submitting…" : "Submit report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
