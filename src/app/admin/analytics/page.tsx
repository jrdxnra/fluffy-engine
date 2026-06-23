import { AdminAnalyticsDashboard } from "@/components/AdminAnalyticsDashboard";
import { getClients, getHistoricalData, getAppSettings } from "@/lib/data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParamValue = string | string[] | undefined;

type AdminAnalyticsPageProps = {
  searchParams?: Promise<Record<string, SearchParamValue>>;
};

export default async function AdminAnalyticsPage({ searchParams }: AdminAnalyticsPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const [clients, historicalData, appSettings] = await Promise.all([
    getClients(),
    getHistoricalData(),
    getAppSettings(),
  ]);

  const initialSelectedClientIds =
    typeof resolvedSearchParams.ids === "string"
      ? resolvedSearchParams.ids.split(",").filter(Boolean)
      : null;
  const initialActiveClientId =
    typeof resolvedSearchParams.active === "string" ? resolvedSearchParams.active : null;
  const initialHistoricalOpen = resolvedSearchParams.hist === "1";

  return (
    <AdminAnalyticsDashboard
      clients={clients}
      historicalData={historicalData}
      cycleSchedulesByCycle={appSettings.cycleSchedulesByCycle || {}}
      initialSelectedClientIds={initialSelectedClientIds}
      initialActiveClientId={initialActiveClientId}
      initialHistoricalOpen={initialHistoricalOpen}
    />
  );
}
