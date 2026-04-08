"use client";

import { Eye, EyeOff, Settings, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";

type MobileActionBarProps = {
  showWarmups: boolean;
  onToggleWarmups: () => void;
  isAdmin?: boolean;
  onOpenConfig?: () => void;
};

export function MobileActionBar({
  showWarmups,
  onToggleWarmups,
  isAdmin,
  onOpenConfig,
}: MobileActionBarProps) {
  const { toggleSidebar } = useSidebar();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background/95 backdrop-blur-sm safe-area-inset-bottom">
      <div className="flex h-14 items-center justify-around px-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="flex h-10 min-w-[72px] flex-col items-center gap-0.5 px-2 py-1 text-[10px]"
          onClick={onToggleWarmups}
        >
          {showWarmups ? (
            <EyeOff className="h-5 w-5" />
          ) : (
            <Eye className="h-5 w-5" />
          )}
          <span>{showWarmups ? "Hide W/U" : "Show W/U"}</span>
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="flex h-10 min-w-[72px] flex-col items-center gap-0.5 px-2 py-1 text-[10px]"
          onClick={toggleSidebar}
        >
          <Users className="h-5 w-5" />
          <span>Roster</span>
        </Button>

        {isAdmin && onOpenConfig && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="flex h-10 min-w-[72px] flex-col items-center gap-0.5 px-2 py-1 text-[10px]"
            onClick={onOpenConfig}
          >
            <Settings className="h-5 w-5" />
            <span>Config</span>
          </Button>
        )}
      </div>
    </div>
  );
}
