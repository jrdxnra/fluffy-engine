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
import { mround } from "@/lib/utils";
import { addClientAction } from "@/app/actions";

const schema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  oneRepMaxes: z.object({
    Squat: z.coerce.number().min(0, "Must be 0 or higher."),
    Bench: z.coerce.number().min(0, "Must be 0 or higher."),
    Deadlift: z.coerce.number().min(0, "Must be 0 or higher."),
    Press: z.coerce.number().min(0, "Must be 0 or higher."),
  }),
});

type FormData = z.infer<typeof schema>;

type AddClientSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClientAdded?: (client: Client) => void;
  liftDisplayNames?: Partial<Record<Lift, string>>;
  globalMovementOptions?: string[];
};

export function AddClientSheet({
  open,
  onOpenChange,
  onClientAdded,
  liftDisplayNames,
  globalMovementOptions = [],
}: AddClientSheetProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customMovementInputs, setCustomMovementInputs] = useState<Record<string, string>>({});
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
  const mappedMovementNames = new Set(
    Lifts.map((lift) => (liftDisplayNames?.[lift] || lift).trim().toLowerCase()).filter(Boolean)
  );
  const unmappedMovementOptions = globalMovementOptions
    .map((name) => name.trim())
    .filter(Boolean)
    .filter((name) => !mappedMovementNames.has(name.toLowerCase()));

  const getLiftLabel = (lift: Lift) => {
    const display = (liftDisplayNames?.[lift] || lift).trim();
    if (!display || display.toLowerCase() === lift.toLowerCase()) {
      return `${lift} 1RM`;
    }
    return `${display} (${lift} slot) 1RM`;
  };

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const addClientPayload = {
        name: data.name.trim(),
        oneRepMaxes: {
          Squat: Number(data.oneRepMaxes.Squat),
          Bench: Number(data.oneRepMaxes.Bench),
          Deadlift: Number(data.oneRepMaxes.Deadlift),
          Press: Number(data.oneRepMaxes.Press),
        },
        movementOneRepMaxes: {
          ...Object.fromEntries(
            Object.entries(customMovementInputs)
              .map(([movement, value]) => [movement, Number(value)] as const)
              .filter(([, value]) => Number.isFinite(value) && value > 0)
          ),
          ...Object.fromEntries(
            Lifts.map((lift) => {
              const displayName = (liftDisplayNames?.[lift] || lift).trim();
              const value = Number(data.oneRepMaxes[lift]);
              return [displayName, value] as const;
            }).filter(([, value]) => Number.isFinite(value) && value > 0)
          ),
        },
      };

      const newClient: Omit<Client, "id"> = {
        name: data.name,
        oneRepMaxes: data.oneRepMaxes,
        movementOneRepMaxes: addClientPayload.movementOneRepMaxes,
        trainingMaxes: {
          Squat: mround(data.oneRepMaxes.Squat * 0.9),
          Bench: mround(data.oneRepMaxes.Bench * 0.9),
          Deadlift: mround(data.oneRepMaxes.Deadlift * 0.9),
          Press: mround(data.oneRepMaxes.Press * 0.9),
        },
      };

      const result = await addClientAction(addClientPayload);

      if (result.success) {
        toast({
          title: "Client Added",
          description: `${data.name} has been added to the roster.`,
        });
        if (onClientAdded) {
          const addedClient: Client = (result as any).client || {
            id: `client-${Date.now()}`,
            ...newClient,
          };
          onClientAdded(addedClient);
        }
        reset();
        setCustomMovementInputs({});
        onOpenChange(false);
        return;
      }

      toast({
        variant: "destructive",
        title: "Error",
        description: result.message || "Failed to add client. Please try again.",
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : "Unexpected error while adding client.";

      toast({
        variant: "destructive",
        title: "Add Client Failed",
        description: message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <form onSubmit={handleSubmit(onSubmit)}>
          <SheetHeader>
            <SheetTitle>Add New Client</SheetTitle>
            <SheetDescription>
              Enter the client's name and their current estimated 1-Rep Maxes (1RMs). The 90% Training Max (TM) will be calculated automatically.
            </SheetDescription>
          </SheetHeader>
          <div className="grid gap-5 py-6">
            <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
              <Label htmlFor="name" className="text-left sm:text-right">
                Name
              </Label>
              <Controller
                name="name"
                control={control}
                render={({ field }) => <Input id="name" {...field} className="col-span-3" />}
              />
              {errors.name && <p className="col-span-4 text-left text-destructive text-sm sm:text-right">{errors.name.message}</p>}
            </div>
            {Lifts.map((lift: Lift) => (
              <div key={lift} className="grid grid-cols-1 items-start gap-2 sm:grid-cols-4 sm:gap-4">
                <Label htmlFor={lift} className="pt-0 text-left sm:pt-2 sm:text-right">
                  {getLiftLabel(lift)}
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
                        {mround(oneRepMaxes[lift] * 0.9)} lbs
                      </span>
                    </p>
                  )}
                   {errors.oneRepMaxes?.[lift] && <p className="text-destructive text-sm mt-1">{errors.oneRepMaxes?.[lift]?.message}</p>}
                </div>
              </div>
            ))}
            {unmappedMovementOptions.map((movementName) => {
              const value = customMovementInputs[movementName] || "";
              const parsed = Number(value);
              return (
                <div key={`custom-movement-${movementName}`} className="grid grid-cols-1 items-start gap-2 sm:grid-cols-4 sm:gap-4">
                  <Label className="pt-0 text-left sm:pt-2 sm:text-right">{movementName} 1RM</Label>
                  <div className="col-span-3">
                    <Input
                      type="number"
                      placeholder="e.g., 185"
                      value={value}
                      onChange={(e) => {
                        const next = e.target.value;
                        setCustomMovementInputs((prev) => ({
                          ...prev,
                          [movementName]: next,
                        }));
                      }}
                    />
                    {Number.isFinite(parsed) && parsed > 0 ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        90% Training Max: <span className="font-bold text-primary">{mround(parsed * 0.9)} lbs</span>
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
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
