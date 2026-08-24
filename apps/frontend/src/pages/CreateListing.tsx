import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useCreateListing } from "@/hooks/use-listings";
import { ApiError } from "@/lib/api-client";
import { VerifiedGate } from "@/components/layout/VerifiedGate";
import { ImageUploader } from "@/components/listings/ImageUploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const schema = z.object({
  title: z.string().min(3, "At least 3 characters"),
  description: z.string().min(10, "At least 10 characters"),
  category: z.string().min(1, "Category is required"),
  location: z.string().min(1, "Location is required"),
  budget: z.coerce.number().positive().optional().or(z.literal("").transform(() => undefined)),
});
type FormValues = z.infer<typeof schema>;

export default function CreateListing() {
  const navigate = useNavigate();
  const createListing = useCreateListing();
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    try {
      const listing = await createListing.mutateAsync({ ...values, imageUrls });
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
        <p className="text-sm text-muted-foreground">Describe what you need done — offers will come to you.</p>
      </div>

      <VerifiedGate>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" placeholder="e.g. Pick up groceries from the store" {...register("title")} />
            {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" rows={5} {...register("description")} />
            {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input id="category" placeholder="Errands, Moving, Delivery…" {...register("category")} />
              {errors.category && <p className="text-sm text-destructive">{errors.category.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input id="location" placeholder="Nairobi" {...register("location")} />
              {errors.location && <p className="text-sm text-destructive">{errors.location.message}</p>}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="budget">Budget in KES (optional)</Label>
            <Input id="budget" type="number" step="1" min="0" {...register("budget")} />
          </div>
          <div className="space-y-2">
            <Label>Photos (optional)</Label>
            <ImageUploader value={imageUrls} onChange={setImageUrls} />
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Posting…" : "Post task"}
          </Button>
        </form>
      </VerifiedGate>
    </div>
  );
}
