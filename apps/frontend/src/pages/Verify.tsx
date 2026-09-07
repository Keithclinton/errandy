import { useState } from "react";
import { CheckCircle2, ShieldCheck, XCircle, Clock, Phone } from "lucide-react";
import { toast } from "sonner";
import { useLocation, useNavigate } from "react-router-dom";
import { useKycStatus, useRequestOtp, useVerifyOtp } from "@/hooks/use-kyc";
import { useAuth } from "@/context/auth-context";
import { ApiError } from "@/lib/api-client";
import { peekResumePath, clearResumePath } from "@/lib/auth-resume";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

export default function Verify() {
  const location = useLocation();
  const navigate = useNavigate();
  const { refetchUser } = useAuth();
  const { data, isLoading } = useKycStatus();
  const requestOtp = useRequestOtp();
  const verifyOtp = useVerifyOtp();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");

  if (isLoading) return <Skeleton className="h-64" />;

  const status = data?.kycStatus ?? "none";

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await requestOtp.mutateAsync(phone);
      setStep("code");
      toast.success("Code sent! Check your SMS.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't send a code to that number.");
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await verifyOtp.mutateAsync({ phone, code });
      await refetchUser(); // kycStatus lives on the global auth user, not just the kyc-status query
      toast.success("Phone verified!");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "That code didn't work.");
    }
  };

  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <CardHeader className="items-center text-center">
          <ShieldCheck className="mb-2 h-10 w-10 text-primary" />
          <CardTitle>Identity verification</CardTitle>
          <CardDescription>
            A quick phone number check keeps everyone on Errandspot accountable.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "verified" && (() => {
            const from = (location.state as { from?: Location })?.from?.pathname ?? peekResumePath();
            return (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <CheckCircle2 className="h-10 w-10 text-primary" />
                <p className="font-medium">You're verified</p>
                <p className="text-sm text-muted-foreground">You can post tasks and make offers.</p>
                <Button
                  className="mt-2"
                  onClick={() => {
                    clearResumePath();
                    navigate(from ?? "/browse", { replace: true });
                  }}
                >
                  {from ? "Continue where you left off" : "Back to home"}
                </Button>
              </div>
            );
          })()}

          {status === "pending" && (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <Clock className="h-10 w-10 animate-pulse text-primary" />
              <p className="font-medium">Verification in progress</p>
              <p className="text-sm text-muted-foreground">This page will update automatically once it's reviewed.</p>
            </div>
          )}

          {status === "rejected" && (
            <div className="flex flex-col items-center gap-2 pb-2 pt-6 text-center">
              <XCircle className="h-10 w-10 text-destructive" />
              <p className="font-medium">Verification wasn't approved</p>
              <p className="text-sm text-muted-foreground">Double-check your number and try again below.</p>
            </div>
          )}

          {(status === "none" || status === "rejected") && step === "phone" && (
            <form onSubmit={handleSendCode} className="space-y-4">
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                We'll text you a 6-digit code to confirm this number is yours. Your phone number is
                never shown to other users.
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone number</Label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="0712345678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="pl-9"
                    required
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={requestOtp.isPending || !phone.trim()}>
                {requestOtp.isPending ? "Sending…" : "Send code"}
              </Button>
            </form>
          )}

          {(status === "none" || status === "rejected") && step === "code" && (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Enter the 6-digit code we sent to <span className="font-medium text-foreground">{phone}</span>.
              </p>
              <div className="space-y-2">
                <Label htmlFor="code">Verification code</Label>
                <Input
                  id="code"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  className="text-center text-lg tracking-[0.5em]"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={verifyOtp.isPending || code.length !== 6}>
                {verifyOtp.isPending ? "Verifying…" : "Verify"}
              </Button>
              <button
                type="button"
                onClick={() => setStep("phone")}
                className="w-full text-center text-sm text-muted-foreground hover:text-primary hover:underline"
              >
                Use a different number
              </button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
