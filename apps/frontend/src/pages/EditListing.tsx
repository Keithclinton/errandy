import { useParams, useNavigate, Navigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/context/auth-context";
import { useListing, useUpdateListing } from "@/hooks/use-listings";
import { ApiError } from "@/lib/api-client";
import { ListingForm, type ListingFormValues } from "@/components/listings/ListingForm";
import { Skeleton } from "@/components/ui/skeleton";

export default function EditListing() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: listing, isLoading } = useListing(id);
  const updateListing = useUpdateListing(id!);

  if (isLoading || !listing) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (listing.ownerId !== user?.id) return <Navigate to={`/listings/${listing.id}`} replace />;

  const onSubmit = async (values: ListingFormValues) => {
    try {
      await updateListing.mutateAsync(values);
      toast.success("Task updated!");
      navigate(`/listings/${listing.id}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't update your task.");
    }
  };

  if (listing.status !== "open") {
    return (
      <div className="mx-auto max-w-xl space-y-2">
        <h1 className="text-2xl font-semibold">Edit task</h1>
        <p className="text-sm text-muted-foreground">
          This task is {listing.status} and can no longer be edited.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Edit task</h1>
        <p className="text-sm text-muted-foreground">Update the details, offers will still come to the same post.</p>
      </div>

      <ListingForm
        defaultValues={{
          title: listing.title,
          description: listing.description,
          category: listing.category,
          location: listing.location,
          budget: listing.budget ? Number(listing.budget) : undefined,
          imageUrls: listing.imageUrls,
        }}
        onSubmit={onSubmit}
        submitLabel="Save changes"
        submittingLabel="Saving…"
      />
    </div>
  );
}
