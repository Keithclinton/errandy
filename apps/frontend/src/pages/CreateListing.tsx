import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useCreateListing } from "@/hooks/use-listings";
import { useTokenBalance } from "@/hooks/use-tokens";
import { useDraftGatedSubmit } from "@/hooks/use-draft-gated-submit";
import { useAuth } from "@/context/auth-context";
import { ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { ListingForm, type ListingFormValues } from "@/components/listings/ListingForm";

export default function CreateListing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const createListing = useCreateListing();
  const { data: tokenData } = useTokenBalance();

  const realSubmit = async (values: ListingFormValues) => {
    try {
      const listing = await createListing.mutateAsync(values);
      toast.success("Task posted!");
      navigate(`/listings/${listing.id}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't post your task.");
    }
  };

  const { draft, submit } = useDraftGatedSubmit<ListingFormValues>({
    draftKey: "listing",
    resumePath: "/listings/new",
    onSubmit: realSubmit,
  });

  // Only block once actually verified and out of tokens — an unverified user always shows
  // balance 0 (they haven't received their free tokens yet), and submitting is exactly what
  // routes them to verification, so this must not short-circuit that for them.
  const insufficientBalance = user?.kycStatus === "verified" && tokenData?.balance === 0;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Post a task</h1>
        <p className="text-sm text-muted-foreground">Describe what you need done, and offers will come to you.</p>
      </div>

      <ListingForm
        defaultValues={draft ?? undefined}
        onSubmit={submit}
        submitLabel="Post task"
        submittingLabel="Posting…"
        disableSubmit={insufficientBalance}
        disableSubmitReason={
          <Button asChild className="w-full">
            <Link to="/tokens/buy">Buy tokens to post</Link>
          </Button>
        }
      />
    </div>
  );
}
