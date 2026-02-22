"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Weight,
  Plus,
  Users,
  TrendingUp,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import type { Client, CycleSettings, Lift } from "@/lib/types";
import { Lifts } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { graduateTeamAction } from "@/app/actions";
import { useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "./ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WeekOptionsModal } from "@/components/WeekOptionsModal";

// Helper function to extract rep scheme from week settings
const getRepScheme = (workset3Reps: string | number | undefined): string => {
  if (workset3Reps === undefined) return '?';
  const repNum = typeof workset3Reps === 'string' 
    ? workset3Reps.replace(/\D/g, '') // Extract digits from "5+", "3+", "1+"
    : workset3Reps.toString();
  return repNum || '?';
};

type SettingsSidebarProps = {
  lift: Lift;
  onLiftChange: (lift: Lift) => void;
  showLiftSelector?: boolean;
  showCycleSelector?: boolean;
  topControls?: React.ReactNode;
  currentWeek: string;
  onWeekChange: (week: string) => void;
  cycleSettings: CycleSettings;
  clients: Client[];
  currentCycleNumber?: number;
  availableCycleNumbers?: number[];
  onCycleChange?: (cycleNumber: number) => void;
  onAddClient: () => void;
  onClientProfile: (client: Client) => void;
  onAiInsight: (client: Client) => void;
  onReorderClient: (clientId: string, direction: "up" | "down") => void;
  onDuplicateWeek: (weekKey: string) => Promise<void>;
  onDeleteWeek: (weekKey: string) => Promise<boolean>;
  onGraduateTeam?: (updatedClients: Client[], newCycleNumber: number) => void;
};

export function SettingsSidebar({
  lift,
  onLiftChange,
  showLiftSelector = true,
  showCycleSelector = true,
  topControls,
  currentWeek,
  onWeekChange,
  cycleSettings,
  clients,
  currentCycleNumber = 1,
  availableCycleNumbers = [],
  onCycleChange,
  onAddClient,
  onClientProfile,
  onAiInsight,
  onReorderClient,
  onDuplicateWeek,
  onDeleteWeek,
  onGraduateTeam,
}: SettingsSidebarProps) {
    const { toast } = useToast();
    const [isGraduating, setIsGraduating] = useState(false);
    const [isWeekOptionsOpen, setIsWeekOptionsOpen] = useState(false);
    const [selectedWeekForOptions, setSelectedWeekForOptions] = useState<string | null>(null);

    const sortedCycleNumbers = (availableCycleNumbers.length > 0
      ? [...availableCycleNumbers]
      : [1, ...clients.map(c => c.currentCycleNumber || 1)]
    )
      .filter((value, index, array) => array.indexOf(value) === index)
      .sort((a, b) => a - b);

    const currentCycleIndex = sortedCycleNumbers.indexOf(currentCycleNumber);
    const prevCycleNumber = currentCycleIndex > 0 ? sortedCycleNumbers[currentCycleIndex - 1] : null;
    const nextCycleNumber =
      currentCycleIndex >= 0 && currentCycleIndex < sortedCycleNumbers.length - 1
        ? sortedCycleNumbers[currentCycleIndex + 1]
        : null;

    const handleWeekClick = (weekKey: string) => {
      setSelectedWeekForOptions(weekKey);
      setIsWeekOptionsOpen(true);
    };

    const handleGraduateTeam = async () => {
        setIsGraduating(true);
        const result = await graduateTeamAction(clients);
        if (result.success) {
            toast({
                title: "Success!",
                description: result.message,
            });
            // Notify parent component to update cycle number
            if (onGraduateTeam && result.newCycleNumber) {
                onGraduateTeam(clients, result.newCycleNumber);
            }
        } else {
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to graduate team.",
            });
        }
        setIsGraduating(false);
    }

  return (
    <>
    <Sidebar
      variant="sidebar"
      collapsible="offcanvas"
      className="border-r"
      side="left"
    >
      <SidebarContent>
        <SidebarHeader>
          {topControls ? <div className="space-y-1">{topControls}</div> : null}
          {showLiftSelector ? (
            <div className="space-y-1">
              <Label>Main Lift</Label>
              <Select value={lift} onValueChange={(value) => onLiftChange(value as Lift)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a lift" />
                </SelectTrigger>
                <SelectContent>
                  {Lifts.map((l) => (
                    <SelectItem key={l} value={l}>
                      <div className="flex items-center gap-2">
                        <Weight className="h-4 w-4" /> {l}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          {showCycleSelector ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => prevCycleNumber && onCycleChange?.(prevCycleNumber)}
                  disabled={prevCycleNumber === null}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium">Cycle {currentCycleNumber}</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => nextCycleNumber && onCycleChange?.(nextCycleNumber)}
                  disabled={nextCycleNumber === null}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : null}
          <div className="space-y-1">
            <div className="mb-2 text-xs font-semibold text-primary">
              {cycleSettings[currentWeek]?.name}
            </div>
            <div className="mb-2 text-[10px] text-muted-foreground">
              Click to open week, double-click for options.
            </div>
            <div
              className={`grid w-full ${
                Object.keys(cycleSettings).length > 3 ? "grid-cols-4" : "grid-cols-3"
              } h-auto gap-0 border rounded-md overflow-hidden`}
            >
              {Object.keys(cycleSettings)
                .sort((a, b) => {
                  const aNum = parseInt(a.match(/\d+/)?.[0] || "0", 10);
                  const bNum = parseInt(b.match(/\d+/)?.[0] || "0", 10);
                  return aNum - bNum;
                })
                .map((weekKey) => (
                <div key={weekKey} className="flex-1 border-r last:border-r-0">
                  <button
                    onClick={() => onWeekChange(weekKey)}
                    onDoubleClick={() => handleWeekClick(weekKey)}
                    className={`w-full px-1 py-2 text-xs hover:bg-muted rounded-none text-center cursor-pointer transition-colors ${
                      currentWeek === weekKey ? 'bg-muted border-b-2 border-b-primary' : ''
                    }`}
                    title="Click to open week. Double-click for week options."
                  >
                    <div className="flex flex-col items-center leading-tight">
                      <span className="font-medium">{cycleSettings[weekKey].name}</span>
                      <span className="text-xxs text-muted-foreground">
                        ({getRepScheme(cycleSettings[weekKey].reps.workset3)})
                      </span>
                    </div>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </SidebarHeader>

        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center">
            <Users className="mr-2" />
            Client Roster ({clients.length})
          </SidebarGroupLabel>
          <SidebarMenu>
            {clients.map((client, index) => {
              return (
                <SidebarMenuItem key={client.id}>
                  <div className="flex items-center gap-1 w-full">
                    <SidebarMenuButton
                      className="justify-start flex-1 min-w-0"
                      size="sm"
                      onClick={() => onClientProfile(client)}
                      tooltip={{
                        children: `Edit profile for ${client.name}`,
                        side: "right",
                        align: "center",
                      }}
                    >
                      <Sparkles className="text-primary" />
                      <span>{client.name}</span>
                    </SidebarMenuButton>
                    <div className="flex flex-col">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4"
                        disabled={index === 0}
                        onClick={() => onReorderClient(client.id, "up")}
                      >
                        <ChevronUp className="h-3 w-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4"
                        disabled={index === clients.length - 1}
                        onClick={() => onReorderClient(client.id, "down")}
                      >
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={onAddClient} tooltip="Add New Client">
              <Plus /> <span>Add Client</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <SidebarMenuButton variant="outline" tooltip="Graduate Team" disabled={isGraduating}>
                  <TrendingUp /> <span>Graduate Team</span>
                </SidebarMenuButton>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently increase the Training Maxes for all clients on the roster (+5 lbs for Bench/Press, +10 lbs for Squat/Deadlift). This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleGraduateTeam} disabled={isGraduating}>
                    {isGraduating ? 'Graduating...' : 'Yes, Graduate Team'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <a
              href="/how-to.html"
              className="block w-full px-2 py-1 text-center text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              How To
            </a>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
    <WeekOptionsModal
      open={isWeekOptionsOpen}
      onOpenChange={setIsWeekOptionsOpen}
      weekKey={selectedWeekForOptions}
      cycleSettings={cycleSettings}
      onDuplicateWeek={onDuplicateWeek}
      onDeleteWeek={onDeleteWeek}
    />
    </>
  );
}
