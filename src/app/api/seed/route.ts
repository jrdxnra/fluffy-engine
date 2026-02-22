import { seedDatabase } from '@/lib/seed';
import { isMaintenanceRouteEnabled, maintenanceRouteDisabledResponse } from '@/lib/maintenance-routes';

export async function GET() {
  if (!isMaintenanceRouteEnabled()) {
    return maintenanceRouteDisabledResponse();
  }

  const result = await seedDatabase();
  return Response.json(result);
}
