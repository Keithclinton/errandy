import { useState } from "react";
import { Coins, Check } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/auth-context";
import { useInitiatePurchase, useTokenPacks, useTokenTransactions } from "@/hooks/use-tokens";
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

export default function BuyTokens() {
  const { user } = useAuth();
  const { data: packs, isLoading: packsLoading } = useTokenPacks();
  const { data: transactions } = useTokenTransactions();
  const initiatePurchase = useInitiatePurchase();
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);
  const [phone, setPhone] = useState(user?.phone ?? "");

  const handleBuy = async () => {
    if (!selectedPackId || !phone.trim()) return;
    try {
      await initiatePurchase.mutateAsync({ packId: selectedPackId, phone: phone.trim() });
      toast.success("Tokens added to your balance!");
      setSelectedPackId(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't complete that purchase.");
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Buy tokens</h1>
        <p className="text-sm text-muted-foreground">
          Posting a task uses 1 token. A token is only spent from your balance once someone accepts your offer.
        </p>
      </div>

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

          <Button
            className="w-full"
            disabled={!selectedPackId || !phone.trim() || initiatePurchase.isPending}
            onClick={handleBuy}
          >
            {initiatePurchase.isPending ? "Processing…" : "Pay with M-Pesa"}
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
