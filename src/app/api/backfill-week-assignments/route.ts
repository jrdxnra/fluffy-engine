import { getClients, updateClient } from "@/lib/data";
import { isMaintenanceRouteEnabled, maintenanceRouteDisabledResponse } from "@/lib/maintenance-routes";

export async function POST() {
  if (!isMaintenanceRouteEnabled()) {
    return maintenanceRouteDisabledResponse();
  }

  try {
    const clients = await getClients();
    const updated: string[] = [];

    for (const client of clients) {
      const currentCycle = client.currentCycleNumber || 1;
      const existing = (client.weekAssignmentsByCycle || {}) as Record<number, Record<string, string>>;

      if (!existing[currentCycle]) {
        const next = {
          ...existing,
          [currentCycle]: {},
        };

        await updateClient(client.id, {
          weekAssignmentsByCycle: next,
        });

        updated.push(client.name);
      }
    }

    return Response.json({
      success: true,
      updatedCount: updated.length,
      updatedClients: updated,
      message: `Backfilled missing weekAssignmentsByCycle for ${updated.length} client(s).`,
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: String(error),
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return Response.json(
    {
      success: false,
      message: "Use POST to run assignment backfill.",
    },
    { status: 405 }
  );
}
