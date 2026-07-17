"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, LogOut } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function LeaveTeamCard() {
  const { isOwner, account, refreshProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  if (isOwner) return null;

  async function handleLeave() {
    setLeaving(true);
    try {
      const res = await fetch("/api/account/leave", { method: "POST" });
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) {
        toast.error(payload.error || "Could not leave team");
        setLeaving(false);
        return;
      }
      toast.success("You left the team");
      setOpen(false);
      await refreshProfile();
      window.location.href = "/dashboard";
    } catch {
      toast.error("Could not reach the server");
      setLeaving(false);
    }
  }

  return (
    <>
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <LogOut className="size-5 text-amber-400" />
            Leave team
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            You are a member of{" "}
            <span className="text-foreground">{account?.name ?? "this team"}</span>.
            Leave before accepting an invitation to another team. You will return
            to an empty personal workspace and use the team WhatsApp number only
            while you remain a member.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            className="border-amber-600/40 text-amber-300 hover:bg-amber-950/40"
            onClick={() => setOpen(true)}
          >
            Leave team
          </Button>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Leave this team?</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              You will lose access to {account?.name ?? "this team"}&apos;s inbox,
              contacts, and shared WhatsApp configuration. Your lead assignments
              on this team will be cleared. You can accept another team invite
              after leaving.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="bg-card border-border">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={leaving}
              className="border-border text-foreground/80"
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleLeave()}
              disabled={leaving}
              className="bg-amber-600 text-foreground hover:bg-amber-700"
            >
              {leaving && <Loader2 className="size-4 animate-spin" />}
              Leave team
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
