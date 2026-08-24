import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { usePlaceBid } from "@/hooks/use-bids";
import { ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const schema = z.object({
  amount: z.coerce.number().positive("Enter an amount greater than 0"),
  message: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export function BidForm({ listingId }: { listingId: string }) {
  const placeBid = usePlaceBid(listingId);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    try {
      await placeBid.mutateAsync(values);
      toast.success("Offer sent!");
      reset();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't send your offer.");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="amount">Your offer (KES)</Label>
        <Input id="amount" type="number" step="1" min="0" {...register("amount")} />
        {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="message">Message (optional)</Label>
        <Textarea id="message" placeholder="A quick note about how you'll help…" {...register("message")} />
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Sending offer…" : "Make offer"}
      </Button>
    </form>
  );
}
