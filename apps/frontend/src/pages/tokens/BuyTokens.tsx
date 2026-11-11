import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Coins, Check, Clock, Smartphone, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/auth-context";
import { useInitiatePurchase, usePurchaseStatus, useTokenPacks, useTokenTransactions } from "@/hooks/use-tokens";
import { ApiError } from "@/lib/api-client";
import { formatMoney, formatRelativeTime } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const TRANSACTION_LABELS: Record<string, string> = {
  signup_grant: "Welcome bonus",
  listing_post: "Posted a task",
  bid_accept_deduction: "Offer accepted",
  purchase: "Bought tokens",
};

// Simulated payments (local dev) succeed instantly. Holding the "check your phone" screen
// for at least this long keeps that close to the real experience instead of flashing past.
const MIN_WAIT_MS = 2500;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// The M-Pesa prompt itself expires after about a minute. Past this, stop promising an
// answer and explain that the tokens will arrive on their own if the payment went through.
const SLOW_AFTER_MS = 90_000;

// M-Pesa result codes a payer can do something about.
const FAILURE_MESSAGES: Record<number, string> = {
  1: "Your M-Pesa balance wasn't enough for this payment.",
  1001: "Another M-Pesa payment was already in progress on that phone. Wait a minute and try again.",
  1019: "The M-Pesa prompt expired before it was answered.",
  1032: "You cancelled the M-Pesa prompt.",
  1037: "We couldn't reach that phone. Make sure it's on and has signal, then try again.",
  2001: "The M-Pesa PIN entered was wrong.",
};
const DEFAULT_FAILURE = "The payment wasn't completed. You can try again below.";

export default function BuyTokens() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: packs, isLoading: packsLoading } = useTokenPacks();
  const { data: transactions } = useTokenTransactions();
  const initiatePurchase = useInitiatePurchase();
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [status, setStatus] = useState<"idle" | "waiting" | "failed">("idle");
  const [purchaseId, setPurchaseId] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);
  const [failureMessage, setFailureMessage] = useState(DEFAULT_FAILURE);

  const { data: purchase } = usePurchaseStatus(purchaseId ?? undefined, { enabled: status === "waiting" });

  const selectedPack = packs?.find((p) => p.id === selectedPackId);

  const succeed = () => {
    toast.success("Tokens added to your balance!");
    setSelectedPackId(null);
    setPurchaseId(null);
    setStatus("idle");
  };

  const fail = (message: string) => {
    setFailureMessage(message);
    setPurchaseId(null);
    setStatus("failed");
  };

  const backToPacks = () => {
    setPurchaseId(null);
    setStatus("idle");
  };

  // A real payment comes back "pending" from initiate; poll until M-Pesa reports the outcome.
  useEffect(() => {
    if (status !== "waiting" || !purchase || purchase.id !== purchaseId) return;
    if (purchase.status === "completed") {
      queryClient.invalidateQueries({ queryKey: ["tokens", "balance"] });
      queryClient.invalidateQueries({ queryKey: ["tokens", "transactions"] });
      toast.success("Tokens added to your balance!");
      setSelectedPackId(null);
      setPurchaseId(null);
      setStatus("idle");
    } else if (purchase.status === "failed") {
      setFailureMessage(FAILURE_MESSAGES[purchase.resultCode ?? -1] ?? DEFAULT_FAILURE);
      setPurchaseId(null);
      setStatus("failed");
    }
  }, [status, purchase, purchaseId, queryClient]);

  useEffect(() => {
    setSlow(false);
    if (status !== "waiting" || !purchaseId) return;
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, [status, purchaseId]);

  const handleBuy = async () => {
    if (!selectedPackId || !phone.trim()) return;
    setPurchaseId(null);
    setStatus("waiting");
    try {
      const [result] = await Promise.all([
        initiatePurchase.mutateAsync({ packId: selectedPackId, phone: phone.trim() }),
        sleep(MIN_WAIT_MS),
      ]);
      if (result.status === "completed") {
        succeed();
      } else {
        setPurchaseId(result.purchaseId);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        fail("Too many attempts. Wait a minute and try again.");
      } else {
        fail(err instanceof ApiError ? err.message : "Couldn't start that payment.");
      }
    }
  };

  if (status === "waiting") {
    return (
      <div className="mx-auto max-w-lg">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            {slow ? (
              <>
                <Clock className="h-8 w-8 text-muted-foreground" />
                <p className="font-medium">Still waiting for M-Pesa</p>
                <p className="max-w-xs text-sm text-muted-foreground">
                  We haven't had confirmation yet. If you entered your PIN, your tokens will be added as soon as
                  M-Pesa confirms, and you'll get a notification.
                </p>
              </>
            ) : (
              <>
                <span className="relative flex h-14 w-14 items-center justify-center">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/30" />
                  <Smartphone className="relative h-8 w-8 text-primary" />
                </span>
                <p className="font-medium">Check your phone</p>
                <p className="max-w-xs text-sm text-muted-foreground">
                  We've sent an M-Pesa prompt to <span className="font-medium text-foreground">{phone.trim()}</span>.
                  Enter your PIN to complete the payment.
                </p>
              </>
            )}
            {purchaseId && (
              <Button variant={slow ? "default" : "ghost"} size="sm" className="mt-2" onClick={backToPacks}>
                {slow ? "Done" : "Back"}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Buy tokens</h1>
        <p className="text-sm text-muted-foreground">
          Posting a task uses 1 token. A token is only spent from your balance once someone accepts your offer.
        </p>
      </div>

      {status === "failed" && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{failureMessage}</p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Choose a pack</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {packsLoading && <Skeleton className="h-32" />}
          <div className="grid grid-cols-3 gap-2">
            {packs?.map((pack) => (
              <button
                key={pack.id}
                type="button"
                onClick={() => setSelectedPackId(pack.id)}
                className={cn(
                  "relative flex flex-col items-center gap-1 rounded-lg border p-3 text-center transition-colors",
                  selectedPackId === pack.id ? "border-primary bg-secondary" : "hover:border-primary/50",
                )}
              >
                {selectedPackId === pack.id && (
                  <Check className="absolute right-1.5 top-1.5 h-3.5 w-3.5 text-primary" />
                )}
                <Coins className="h-5 w-5 text-highlight" />
                <span className="font-semibold">{pack.tokens}</span>
                <span className="text-xs text-muted-foreground">{formatMoney(pack.amountKes)}</span>
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="mpesa-phone">M-Pesa phone number</Label>
            <Input
              id="mpesa-phone"
              type="tel"
              placeholder="0712345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <Button className="w-full" disabled={!selectedPackId || !phone.trim()} onClick={handleBuy}>
            {selectedPack ? `Pay ${formatMoney(selectedPack.amountKes)} with M-Pesa` : "Pay with M-Pesa"}
          </Button>
        </CardContent>
      </Card>

      {transactions && transactions.items.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-medium">Recent activity</h2>
          <div className="space-y-2">
            {transactions.items.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                <div>
                  <p className="font-medium">{TRANSACTION_LABELS[tx.type] ?? tx.type}</p>
                  <p className="text-xs text-muted-foreground">{formatRelativeTime(tx.createdAt)}</p>
                </div>
                <span className={cn("font-semibold", tx.amount > 0 ? "text-primary" : "text-muted-foreground")}>
                  {tx.amount > 0 ? "+" : ""}
                  {tx.amount}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
