"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type { Client, Lift } from "@/lib/types";
import { Lifts } from "@/lib/types";
import { addClientAction } from "@/app/actions";

const schema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  oneRepMaxes: z.object({
    Squat: z.coerce.number().positive("Must be a positive number."),
    Bench: z.coerce.number().positive("Must be a positive number."),
    Deadlift: z.coerce.number().positive("Must be a positive number."),
    Press: z.coerce.number().positive("Must be a positive number."),
  }),
});

type FormData = z.infer<typeof schema>;

type AddClientSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AddClientSheet({ open, onOpenChange }: AddClientSheetProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      oneRepMaxes: { Squat: 0, Bench: 0, Deadlift: 0, Press: 0 },
    },
  });

  const oneRepMaxes = watch("oneRepMaxes");

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    const newClient: Omit<Client, "id"> = {
      name: data.name,
      oneRepMaxes: data.oneRepMaxes,
      trainingMaxes: {
        Squat: Math.round(data.oneRepMaxes.Squat * 0.9),
        Bench: Math.round(data.oneRepMaxes.Bench * 0.9),
        Deadlift: Math.round(data.oneRepMaxes.Deadlift * 0.9),
        Press: Math.round(data.oneRepMaxes.Press * 0.9),
      },
    };

    const result = await addClientAction(newClient);
    
    if (result.success) {
      toast({
        title: "Client Added",
        description: `${data.name} has been added to the roster.`,
      });
      reset();
      onOpenChange(false);
    } else {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add client. Please try again.",
      });
    }
    setIsSubmitting(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit(onSubmit)}>
          <SheetHeader>
            <SheetTitle>Add New Client</SheetTitle>
            <SheetDescription>
              Enter the client's name and their current estimated 1-Rep Maxes (1RMs). The 90% Training Max (TM) will be calculated automatically.
            </SheetDescription>
          </SheetHeader>
          <div className="grid gap-4 py-6">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Controller
                name="name"
                control={control}
                render={({ field }) => <Input id="name" {...field} className="col-span-3" />}
              />
              {errors.name && <p className="col-span-4 text-right text-destructive text-sm">{errors.name.message}</p>}
            </div>
            {Lifts.map((lift: Lift) => (
              <div key={lift} className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor={lift} className="text-right pt-2">
                  {lift} 1RM
                </Label>
                <div className="col-span-3">
                  <Controller
                    name={`oneRepMaxes.${lift}`}
                    control={control}
                    render={({ field }) => (
                      <Input
                        id={lift}
                        type="number"
                        placeholder="e.g., 315"
                        {...field}
                      />
                    )}
                  />
                  {oneRepMaxes?.[lift] > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      90% Training Max:{" "}
                      <span className="font-bold text-primary">
                        {Math.round(oneRepMaxes[lift] * 0.9)} lbs
                      </span>
                    </p>
                  )}
                   {errors.oneRepMaxes?.[lift] && <p className="text-destructive text-sm mt-1">{errors.oneRepMaxes?.[lift]?.message}</p>}
                </div>
              </div>
            ))}
          </div>
          <SheetFooter>
            <SheetClose asChild>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </SheetClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Adding..." : "Add Client"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
