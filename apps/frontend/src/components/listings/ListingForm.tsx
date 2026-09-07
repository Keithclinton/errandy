import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { TASK_CATEGORIES } from "@/lib/categories";
import { ImageUploader } from "@/components/listings/ImageUploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const schema = z.object({
  title: z.string().min(3, "At least 3 characters"),
  description: z.string().min(10, "At least 10 characters"),
  category: z.string().min(1, "Category is required"),
  location: z.string().min(1, "Location is required"),
  budget: z.coerce.number().positive().optional().or(z.literal("").transform(() => undefined)),
});
type FormValues = z.infer<typeof schema>;

export interface ListingFormValues extends FormValues {
  imageUrls: string[];
}

export function ListingForm({
  defaultValues,
  onSubmit,
  submitLabel,
  submittingLabel,
  disableSubmit,
  disableSubmitReason,
}: {
  defaultValues?: Partial<ListingFormValues>;
  onSubmit: (values: ListingFormValues) => Promise<void>;
  submitLabel: string;
  submittingLabel: string;
  disableSubmit?: boolean;
  disableSubmitReason?: React.ReactNode;
}) {
  const [imageUrls, setImageUrls] = useState<string[]>(defaultValues?.imageUrls ?? []);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: defaultValues?.title,
      description: defaultValues?.description,
      category: defaultValues?.category,
      location: defaultValues?.location,
      budget: defaultValues?.budget,
    },
  });

  const submit = (values: FormValues) => onSubmit({ ...values, imageUrls });

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
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
          <Controller
            name="category"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {TASK_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
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
      {disableSubmit ? (
        disableSubmitReason
      ) : (
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? submittingLabel : submitLabel}
        </Button>
      )}
      <p className="text-center text-xs text-muted-foreground">Posting a task uses 1 token from your balance.</p>
    </form>
  );
}
