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

/**
 * One-time data-fix routes under src/app/api/** should be deleted once confirmed
 * successful, so they don't linger as dead code or get accidentally re-run against
 * different data. Call this only after inspecting the fix's own success/error output.
 *
 * This only removes files from the local working tree (dev machine) - it cannot run
 * against a deployed instance (Firebase App Hosting ships an immutable, read-only
 * bundle) and does not commit the removal to git. You still need to `git add -A`
 * and commit after calling this.
 */
export const deleteMaintenanceRouteAfterConfirmation = async (
  routeDirName: string
): Promise<{ deleted: boolean; message: string }> => {
  if (process.env.NODE_ENV === 'production') {
    return {
      deleted: false,
      message: 'Refusing to delete route files in production; delete the route directory locally and commit.',
    };
  }

  const { rm } = await import('fs/promises');
  const path = await import('path');
  const routeDir = path.join(process.cwd(), 'src', 'app', 'api', routeDirName);

  try {
    await rm(routeDir, { recursive: true, force: true });
    return {
      deleted: true,
      message: `Deleted ${routeDir}. Run "git add -A && git commit" to persist the removal.`,
    };
  } catch (error) {
    return {
      deleted: false,
      message: `Failed to delete ${routeDir}: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
};
