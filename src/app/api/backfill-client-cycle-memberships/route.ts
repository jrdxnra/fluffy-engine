import { getClients, updateClient } from "@/lib/data";
import { inferCycleMembershipFromHistoricalData } from "@/lib/cycle-membership";
import { isMaintenanceRouteEnabled, maintenanceRouteDisabledResponse } from "@/lib/maintenance-routes";

export async function POST() {
  if (!isMaintenanceRouteEnabled()) {
    return maintenanceRouteDisabledResponse();
  }

  try {
    const clients = await getClients();
    const updatedClients: string[] = [];

    for (const client of clients) {
      const explicitMembership = (client.cycleMembership || []).map(Number).filter((value) => Number.isFinite(value) && value > 0);
      if (explicitMembership.length > 0) {
        continue;
      }

      const inferredMembership = inferCycleMembershipFromHistoricalData(client);
      if (inferredMembership.length === 0) {
        continue;
      }

      await updateClient(client.id, {
        cycleMembership: inferredMembership,
        currentCycleNumber: inferredMembership[inferredMembership.length - 1],
      });
      updatedClients.push(client.name);
    }

    return Response.json({
      success: true,
      updatedCount: updatedClients.length,
      updatedClients,
      message: `Backfilled explicit cycle memberships for ${updatedClients.length} legacy client(s).`,
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
  return Response.json({
    description: "POST to backfill explicit cycleMembership from historical cycle data.",
  });
}