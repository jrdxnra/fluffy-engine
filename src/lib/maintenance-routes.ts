export const isMaintenanceRouteEnabled = (): boolean => {
  return process.env.ENABLE_MAINTENANCE_ROUTES === 'true';
};

export const maintenanceRouteDisabledResponse = () => {
  return Response.json(
    {
      success: false,
      message: 'Maintenance routes are disabled. Set ENABLE_MAINTENANCE_ROUTES=true to enable.',
    },
    { status: 403 }
  );
};
