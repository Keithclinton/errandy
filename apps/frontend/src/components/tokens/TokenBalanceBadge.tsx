import { Coins } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useTokenBalance } from "@/hooks/use-tokens";

export function TokenBalanceBadge() {
  const { data } = useTokenBalance();

  return (
    <Button asChild variant="ghost" size="sm" className="gap-1.5 px-2">
      <Link to="/tokens/buy" aria-label="Token balance">
        <Coins className="h-4 w-4 text-highlight" />
        <span className="text-sm font-medium">{data?.balance ?? "…"}</span>
      </Link>
    </Button>
  );
}
