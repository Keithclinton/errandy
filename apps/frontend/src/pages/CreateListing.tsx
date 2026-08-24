import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useCreateListing } from "@/hooks/use-listings";
import { ApiError } from "@/lib/api-client";
import { VerifiedGate } from "@/components/layout/VerifiedGate";
import { ListingForm, type ListingFormValues } from "@/components/listings/ListingForm";

export default function CreateListing() {
  const navigate = useNavigate();
  const createListing = useCreateListing();

  const onSubmit = async (values: ListingFormValues) => {
    try {
      const listing = await createListing.mutateAsync(values);
      toast.success("Task posted!");
      navigate(`/listings/${listing.id}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't post your task.");
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Post a task</h1>
        <p className="text-sm text-muted-foreground">Describe what you need done, and offers will come to you.</p>
      </div>

      <VerifiedGate>
        <ListingForm onSubmit={onSubmit} submitLabel="Post task" submittingLabel="Posting…" />
      </VerifiedGate>
    </div>
  );
}
