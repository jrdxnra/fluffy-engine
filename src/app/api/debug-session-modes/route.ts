import { getAppSettings, getClients } from '@/lib/data';

type SessionMode = 'normal' | 'slide' | 'jack_shit' | 'pause_week' | 'recovery';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cycleNumber = Number(searchParams.get('cycle') || '1');
    const currentWeek = searchParams.get('week') || 'week1';

    const clients = await getClients();
    const { cycleSettingsByCycle } = await getAppSettings();
    const cycleSettings = cycleSettingsByCycle[cycleNumber] || cycleSettingsByCycle[1] || {};

    const sortedWeekKeys = Object.keys(cycleSettings).sort((a, b) => {
      const aNum = parseInt(a.match(/\d+/)?.[0] || '0', 10);
      const bNum = parseInt(b.match(/\d+/)?.[0] || '0', 10);
      return aNum - bNum;
    });

    const rows = clients.map((client: any) => {
      const state = client.sessionStateByCycle?.[cycleNumber];
      const mode: SessionMode = state?.modeByWeek?.[currentWeek] || state?.mode || 'normal';
      let effectiveWeekKey = currentWeek;

      if (mode === 'slide') {
        const flowWeekKey = state?.flowWeekKeyByWeek?.[currentWeek] || state?.flowWeekKey;
        if (flowWeekKey && cycleSettings[flowWeekKey]) {
          effectiveWeekKey = flowWeekKey;
        } else {
          const index = sortedWeekKeys.indexOf(currentWeek);
          if (index > 0) {
            effectiveWeekKey = sortedWeekKeys[index - 1];
          }
        }
      }

      return {
        clientId: client.id,
        name: client.name,
        mode,
        flowWeekKey: state?.flowWeekKeyByWeek?.[currentWeek] || state?.flowWeekKey || null,
        effectiveWeekKey,
        isPaused: mode === 'pause_week',
        isMainLiftOnly: mode === 'jack_shit',
        noAmrap: mode === 'recovery',
      };
    });

    return Response.json({
      success: true,
      cycleNumber,
      currentWeek,
      availableWeeks: sortedWeekKeys,
      clients: rows,
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
