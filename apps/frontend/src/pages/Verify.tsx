import { useState } from "react";
import { CheckCircle2, ShieldCheck, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { useKycStatus, useStartVerification } from "@/hooks/use-kyc";
import { ApiError } from "@/lib/api-client";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";

export default function Verify() {
  const { data, isLoading } = useKycStatus();
  const startVerification = useStartVerification();
  const [consent, setConsent] = useState(false);

  if (isLoading) return <Skeleton className="h-64" />;

  const status = data?.kycStatus ?? "none";

  const handleStart = async () => {
    try {
      await startVerification.mutateAsync();
      toast.success("Verification started.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't start verification.");
    }
  };

  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <CardHeader className="items-center text-center">
          <ShieldCheck className="mb-2 h-10 w-10 text-primary" />
          <CardTitle>Identity verification</CardTitle>
          <CardDescription>
            A one-time government ID + selfie check keeps everyone on Errandspot accountable.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "verified" && (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <CheckCircle2 className="h-10 w-10 text-primary" />
              <p className="font-medium">You're verified</p>
              <p className="text-sm text-muted-foreground">You can post errands and place bids.</p>
              <Button asChild className="mt-2">
                <Link to="/browse">Back to home</Link>
              </Button>
            </div>
          )}

          {status === "pending" && (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <Clock className="h-10 w-10 animate-pulse text-primary" />
              <p className="font-medium">Verification in progress</p>
              <p className="text-sm text-muted-foreground">
                This page will update automatically once it's reviewed — usually within a few minutes.
              </p>
            </div>
          )}

          {status === "rejected" && (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <XCircle className="h-10 w-10 text-destructive" />
              <p className="font-medium">Verification wasn't approved</p>
              <p className="text-sm text-muted-foreground">Double-check your details and try again.</p>
            </div>
          )}

          {(status === "none" || status === "rejected") && (
            <>
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                The ID + selfie capture step will appear here once verification starts. It's handled by our
                verification partner — Errandspot never stores your raw ID images.
              </div>
              <div className="flex items-start gap-2">
                <Checkbox id="consent" checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />
                <Label htmlFor="consent" className="text-sm font-normal leading-snug">
                  I consent to my government ID and a selfie being processed by Errandspot's verification
                  partner for the purpose of identity verification.
                </Label>
              </div>
              <Button className="w-full" disabled={!consent || startVerification.isPending} onClick={handleStart}>
                {startVerification.isPending ? "Starting…" : "Start verification"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
