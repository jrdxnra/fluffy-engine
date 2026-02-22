import { getAppSettings } from '@/lib/data';
import type { Lift } from '@/lib/types';
import { getCycleWeekSchedule, getEffectiveCycleSchedule, getLiftDaySlot, getLiftsForDaySlot } from '@/lib/schedule';

export async function GET(request: Request) {
  try {
    const settings = await getAppSettings();
    const url = new URL(request.url);

    const cycleNumber = Math.max(1, Number(url.searchParams.get('cycle') || '1'));
    const weekKey = url.searchParams.get('week') || 'week1';
    const lift = (url.searchParams.get('lift') || 'Deadlift') as Lift;

    const cycleSchedule = getEffectiveCycleSchedule(settings.cycleSchedulesByCycle?.[cycleNumber]);
    const weekSchedule = getCycleWeekSchedule(cycleSchedule, weekKey);
    const liftDaySlot = getLiftDaySlot(lift, cycleSchedule);
    const cycleWeekKeys = Object.keys(settings.cycleSettingsByCycle?.[cycleNumber] || {})
      .sort((a, b) => {
        const aNum = parseInt(a.match(/\d+/)?.[0] || '0', 10);
        const bNum = parseInt(b.match(/\d+/)?.[0] || '0', 10);
        return aNum - bNum;
      });
    const allWeekSchedules = cycleWeekKeys.map((key) => {
      const computed = getCycleWeekSchedule(cycleSchedule, key);
      return {
        weekKey: key,
        day1Weekday: computed.day1Weekday,
        day2Weekday: computed.day2Weekday,
        day1Date: computed.day1Date,
        day2Date: computed.day2Date,
        isConfigured: computed.isConfigured,
      };
    });

    return Response.json({
      success: true,
      cycleNames: settings.cycleNames,
      cycleSchedulesByCycle: settings.cycleSchedulesByCycle,
      computed: {
        cycleNumber,
        weekKey,
        lift,
        liftDaySlot,
        day1Lifts: getLiftsForDaySlot('day1', cycleSchedule),
        day2Lifts: getLiftsForDaySlot('day2', cycleSchedule),
        cycleSchedule,
        weekSchedule,
        selectedLiftDate: liftDaySlot === 'day1' ? weekSchedule.day1Date : weekSchedule.day2Date,
        allWeekSchedules,
      },
      cycleSettingsKeys: Object.fromEntries(
        Object.entries(settings.cycleSettingsByCycle || {}).map(([cycle, cycleSettings]) => [
          cycle,
          Object.keys(cycleSettings || {}),
        ])
      ),
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
