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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Weight,
  Download,
  Plus,
  Users,
  TrendingUp,
  Sparkles,
} from "lucide-react";
import type { Client, CycleSettings, Lift } from "@/lib/types";
import { Lifts } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { graduateTeamAction } from "@/app/actions";
import { useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "./ui/alert-dialog";

type SettingsSidebarProps = {
  lift: Lift;
  onLiftChange: (lift: Lift) => void;
  currentWeek: string;
  onWeekChange: (week: string) => void;
  cycleSettings: CycleSettings;
  clients: Client[];
  onAddClient: () => void;
  onExport: () => void;
  onAiInsight: (client: Client) => void;
};

export function SettingsSidebar({
  lift,
  onLiftChange,
  currentWeek,
  onWeekChange,
  cycleSettings,
  clients,
  onAddClient,
  onExport,
  onAiInsight,
}: SettingsSidebarProps) {
    const { toast } = useToast();
    const [isGraduating, setIsGraduating] = useState(false);

    const handleGraduateTeam = async () => {
        setIsGraduating(true);
        const result = await graduateTeamAction();
        if (result.success) {
            toast({
                title: "Success!",
                description: result.message,
            });
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
    <Sidebar
      variant="sidebar"
      collapsible="icon"
      className="border-r"
      side="left"
    >
      <SidebarContent>
        <SidebarHeader>
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
          <div className="space-y-1">
            <Label>Cycle Week</Label>
            <Tabs
              value={currentWeek}
              onValueChange={onWeekChange}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-3 h-auto">
                {Object.keys(cycleSettings).map((weekKey) => (
                  <TabsTrigger key={weekKey} value={weekKey} className="text-xs">
                    {cycleSettings[weekKey].name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </SidebarHeader>

        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center">
            <Users className="mr-2" />
            Client Roster ({clients.length})
          </SidebarGroupLabel>
          <SidebarMenu>
            {clients.map((client) => (
              <SidebarMenuItem key={client.id}>
                <SidebarMenuButton
                  className="justify-start w-full"
                  size="sm"
                  variant="ghost"
                  onClick={() => onAiInsight(client)}
                  tooltip={{
                    children: `Get AI Insights for ${client.name}`,
                    side: "right",
                    align: "center",
                  }}
                >
                  <Sparkles className="text-primary" />
                  <span>{client.name}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
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
            <SidebarMenuButton onClick={onExport} variant="outline" tooltip="Export as CSV">
              <Download /> <span>Export Workout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
