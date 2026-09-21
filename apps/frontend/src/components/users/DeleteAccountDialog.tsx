import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { useDeleteAccount } from "@/hooks/use-users";
import { ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";

export function DeleteAccountDialog() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const deleteAccount = useDeleteAccount();
  const navigate = useNavigate();

  if (!user) return null;

  const onDelete = async () => {
    try {
      await deleteAccount.mutateAsync();
      await logout();
      toast.success("Your account has been deleted");
      navigate("/", { replace: true });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't delete your account.");
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
          <DialogTitle>Delete your account?</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            This permanently deletes your account and every listing, offer, chat, and rating tied to it —
            including listings other people bid on. This cannot be undone.
          </p>
          <div className="space-y-2">
            <Label htmlFor="confirm-email">Type your email to confirm</Label>
            <Input id="confirm-email" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="destructive"
            disabled={confirmText !== user.email || deleteAccount.isPending}
            onClick={onDelete}
          >
            {deleteAccount.isPending ? "Deleting…" : "Permanently delete my account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
