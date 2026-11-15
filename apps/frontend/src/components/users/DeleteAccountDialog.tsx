import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AlertTriangle, Trash2 } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { useDeleteAccount } from "@/hooks/use-users";
import { ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";

/** Matches DELETED_ACCOUNT_BLOCK_DAYS on the server. */
const SIGN_UP_BLOCK_DAYS = 90;

function signUpAgainDate(): string {
  const date = new Date(Date.now() + SIGN_UP_BLOCK_DAYS * 24 * 60 * 60 * 1000);
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

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

  const tokens = user.tokenBalance;

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
        <div className="space-y-4">
          <div className="space-y-2 text-sm">
            <p className="font-medium">You'll lose all your progress, for good:</p>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>
                {tokens > 0
                  ? `Your ${tokens} token${tokens === 1 ? "" : "s"}. They can't be refunded or moved to another account.`
                  : "Any tokens you'd have bought or been given."}
              </li>
              <li>Your reviews, rating and completed tasks.</li>
              <li>Your tasks, offers and chats, including tasks other people made offers on.</li>
              <li>Your phone and ID verification.</li>
            </ul>
          </div>
          <div className="flex gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
            <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" aria-hidden />
            <p>
              You won't be able to create a new account with this email, phone number or Google account for 3
              months, until {signUpAgainDate()}.
            </p>
          </div>
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
