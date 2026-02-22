import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getClients } from '@/lib/data';

export async function GET() {
  try {
    const settingsRef = doc(db, 'appSettings', 'cycleSettings');
    const settingsSnapshot = await getDoc(settingsRef);
    const appData = settingsSnapshot.exists() ? settingsSnapshot.data() : null;

    const clients = await getClients();
    const clientWithSettings = clients.find((client: any) =>
      client.cycleSettingsByCycle && Object.keys(client.cycleSettingsByCycle).length > 0
    ) as any;

    const appCycleSettingsByCycle = appData?.cycleSettingsByCycle || {};
    const appCycleKeys = Object.keys(appCycleSettingsByCycle).sort();
    const clientCycleKeys = Object.keys(clientWithSettings?.cycleSettingsByCycle || {}).sort();

    const appWeekKeysByCycle: Record<string, string[]> = {};
    for (const cycleKey of appCycleKeys) {
      appWeekKeysByCycle[cycleKey] = Object.keys(appCycleSettingsByCycle?.[cycleKey] || {}).sort();
    }

    const clientWeekKeysByCycle: Record<string, string[]> = {};
    for (const cycleKey of clientCycleKeys) {
      clientWeekKeysByCycle[cycleKey] = Object.keys(clientWithSettings?.cycleSettingsByCycle?.[cycleKey] || {}).sort();
    }

    return Response.json({
      success: true,
      appSettings: {
        exists: settingsSnapshot.exists(),
        settingsUpdatedAt: appData?.settingsUpdatedAt || null,
        cycleKeys: appCycleKeys,
        weekKeysByCycle: appWeekKeysByCycle,
      },
      clientSharedSettings: {
        exists: Boolean(clientWithSettings),
        clientId: clientWithSettings?.id || null,
        settingsUpdatedAt: clientWithSettings?.settingsUpdatedAt || null,
        cycleKeys: clientCycleKeys,
        weekKeysByCycle: clientWeekKeysByCycle,
      },
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
