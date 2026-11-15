import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/auth-context";
import { useAdminIdCheck, useReviewIdCheck } from "@/hooks/use-admin";
import { ApiError } from "@/lib/api-client";
import { formatRelativeTime } from "@/lib/format";
import { ID_DOCUMENT_LABELS, type IdImageKind, type KycStatus } from "@/types/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

const IMAGE_LABELS: Record<IdImageKind, string> = {
  front: "Front of the document",
  back: "Back of the document",
  selfie: "Selfie",
};

const STATUS_LABELS: Record<KycStatus, string> = {
  none: "None",
  pending: "Waiting for review",
  verified: "Approved",
  rejected: "Rejected",
};

const QUICK_REASONS = [
  "The photos are blurry or too dark to read.",
  "The name doesn't match the one on the document.",
  "The selfie doesn't match the photo on the document.",
  "Part of the document is cut off or covered.",
];

export default function AdminIdCheckDetail() {
  const { id } = useParams<{ id: string }>();
  const { user: me } = useAuth();
  const { data: check, isLoading, isError } = useAdminIdCheck(id);
  const review = useReviewIdCheck();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  if (isError) return <p className="text-sm text-destructive">Couldn't load this ID check.</p>;
  if (isLoading || !check) return <Skeleton className="h-96" />;

  const isOwn = check.user.id === me?.id;

  const decide = async (decision: "approve" | "reject") => {
    try {
      await review.mutateAsync({ id: check.id, decision, reason: decision === "reject" ? reason.trim() : undefined });
      toast.success(decision === "approve" ? "ID approved. They now have the badge." : "ID check rejected.");
      setRejecting(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "That didn't work. Try again.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/admin/id-checks" className="text-sm text-primary hover:underline">
            Back to ID checks
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">ID check for {check.user.name}</h1>
          <p className="text-sm text-muted-foreground">
            <Link to={`/admin/users/${check.user.id}`} className="text-primary underline underline-offset-4">
              {check.user.email}
            </Link>{" "}
            · sent {formatRelativeTime(check.createdAt)}
          </p>
        </div>
        <Badge variant={check.status === "rejected" ? "destructive" : check.status === "verified" ? "default" : "secondary"}>
          {STATUS_LABELS[check.status]}
        </Badge>
      </div>

      {check.sameIdNumber.length > 0 && (
        <div className="flex gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" aria-hidden />
          <div>
            <p className="font-medium">This document number was also sent from another account</p>
            <ul className="mt-1 space-y-0.5">
              {check.sameIdNumber.map((other) => (
                <li key={other.id}>
                  <Link to={`/admin/users/${other.user.id}`} className="text-primary underline underline-offset-4">
                    {other.user.name} ({other.user.email})
                  </Link>{" "}
                  <span className="text-muted-foreground">
                    · {STATUS_LABELS[other.status].toLowerCase()}, {formatRelativeTime(other.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Name on the account</dt>
            <dd>{check.user.name}</dd>
            <dt className="text-muted-foreground">Name on the document</dt>
            <dd className="font-medium">{check.fullName}</dd>
            <dt className="text-muted-foreground">Document</dt>
            <dd>{ID_DOCUMENT_LABELS[check.documentType]}</dd>
            <dt className="text-muted-foreground">Number</dt>
            <dd className="font-mono">{check.idNumber}</dd>
            {check.reviewedAt && (
              <>
                <dt className="text-muted-foreground">Reviewed</dt>
                <dd>
                  {formatRelativeTime(check.reviewedAt)}
                  {check.reviewedBy && ` by ${check.reviewedBy.name}`}
                </dd>
              </>
            )}
            {check.rejectionReason && (
              <>
                <dt className="text-muted-foreground">Reason given</dt>
                <dd>{check.rejectionReason}</dd>
              </>
            )}
          </dl>
        </CardContent>
      </Card>

      {check.images.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-3">
          {check.images.map((image) => (
            <figure key={image.kind} className="space-y-2">
              <img
                src={image.dataUrl}
                alt={`${IMAGE_LABELS[image.kind]} sent by ${check.user.name}`}
                className="max-h-[28rem] w-full rounded-md border bg-muted object-contain"
              />
              <figcaption className="text-sm text-muted-foreground">{IMAGE_LABELS[image.kind]}</figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">The photos were deleted when this check was reviewed.</p>
      )}

      {check.status === "pending" &&
        (isOwn ? (
          <p className="text-sm text-muted-foreground">This is your own ID check, so another admin has to review it.</p>
        ) : rejecting ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Why isn't it approved?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {QUICK_REASONS.map((quick) => (
                  <Button key={quick} type="button" size="sm" variant="outline" onClick={() => setReason(quick)}>
                    {quick}
                  </Button>
                ))}
              </div>
              <div className="space-y-2">
                <Label htmlFor="reject-reason">Reason (the user sees this)</Label>
                <Textarea id="reject-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  disabled={reason.trim().length < 3 || review.isPending}
                  onClick={() => decide("reject")}
                >
                  <XCircle className="mr-1.5 h-4 w-4" aria-hidden /> Reject
                </Button>
                <Button variant="outline" onClick={() => setRejecting(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button disabled={review.isPending} onClick={() => decide("approve")}>
              <CheckCircle2 className="mr-1.5 h-4 w-4" aria-hidden /> Approve
            </Button>
            <Button variant="outline" disabled={review.isPending} onClick={() => setRejecting(true)}>
              <XCircle className="mr-1.5 h-4 w-4" aria-hidden /> Reject
            </Button>
          </div>
        ))}
    </div>
  );
}
