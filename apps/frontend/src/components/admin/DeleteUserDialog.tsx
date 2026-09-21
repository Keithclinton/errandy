import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { useDeleteUser } from "@/hooks/use-admin";
import { ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";

export function DeleteUserDialog({ userId, email }: { userId: string; email: string }) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const deleteUser = useDeleteUser();
  const navigate = useNavigate();

  const onDelete = async () => {
    try {
      await deleteUser.mutateAsync(userId);
      toast.success("Account deleted");
      setOpen(false);
      navigate("/admin/users");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't delete this account.");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setConfirmText("");
      }}
    >
      <DialogTrigger asChild>
        <Button variant="destructive">
          <Trash2 className="mr-1.5 h-4 w-4" /> Delete account
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this account?</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            This permanently deletes <span className="font-medium text-foreground">{email}</span> and every
            listing, offer, chat, and rating tied to them, including listings other people bid on. This
            cannot be undone.
          </p>
          <div className="space-y-2">
            <Label htmlFor="confirm-email">Type the email to confirm</Label>
            <Input id="confirm-email" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="destructive"
            disabled={confirmText !== email || deleteUser.isPending}
            onClick={onDelete}
          >
            {deleteUser.isPending ? "Deleting…" : "Permanently delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
