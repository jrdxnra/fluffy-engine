"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

/** The walkthrough guide, opened in a window on top of the app instead of leaving the page. */
export function HowToDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="block w-full px-2 py-1 text-center text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
          How To
        </button>
      </DialogTrigger>
      <DialogContent className="flex h-[85vh] max-w-4xl flex-col gap-2 p-4">
        <DialogHeader>
          <DialogTitle>How To</DialogTitle>
        </DialogHeader>
        <iframe src="/how-to.html" title="App walkthrough" className="min-h-0 w-full flex-1 rounded-md border" />
      </DialogContent>
    </Dialog>
  );
}
