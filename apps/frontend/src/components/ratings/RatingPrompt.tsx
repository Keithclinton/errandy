import { useState } from "react";
import { toast } from "sonner";
import { useSubmitRating } from "@/hooks/use-ratings";
import { ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { StarRating } from "./StarRating";

export function RatingPrompt({ listingId }: { listingId: string }) {
  const [open, setOpen] = useState(false);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const submitRating = useSubmitRating(listingId);

  const onSubmit = async () => {
    if (stars === 0) {
      toast.error("Pick a star rating first.");
      return;
    }
    try {
      await submitRating.mutateAsync({ stars, comment: comment || undefined });
      toast.success("Thanks for rating!");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't submit your rating.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Rate your errand partner</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>How did it go?</DialogTitle>
          <DialogDescription>
            Your rating stays hidden until the other person rates too, or 7 days pass.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <StarRating value={stars} onChange={setStars} size="lg" />
          <Textarea
            placeholder="Optional comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button onClick={onSubmit} disabled={submitRating.isPending}>
            {submitRating.isPending ? "Submitting…" : "Submit rating"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
