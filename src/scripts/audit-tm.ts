import { getClients } from "@/lib/data";

const mround = (v: number) => Math.round(v / 5) * 5;
const lifts = ["Squat", "Bench", "Deadlift", "Press"] as const;

type Finding = {
  name: string;
  id: string;
  lift: (typeof lifts)[number];
  cycle: number;
  tm: number;
  expected: number;
  oneRM: number;
  delta: number;
  over1rm: boolean;
};

async function main() {
  const clients = await getClients();
  const findings: Finding[] = [];

  for (const c of clients) {
    const byCycle = c.trainingMaxesByCycle || {};
    const cycleNums = Object.keys(byCycle)
      .map(Number)
      .filter((n) => !Number.isNaN(n))
      .sort((a, b) => a - b);

    for (const lift of lifts) {
      const oneRM = c.oneRepMaxes[lift];
      const baseTm = mround(oneRM * 0.9);
      for (const cycle of cycleNums) {
        const tm = byCycle[cycle]?.[lift];
        if (typeof tm !== "number") continue;

        const increment = lift === "Squat" || lift === "Deadlift" ? 10 : 5;
        const expected = baseTm + (cycle - 1) * increment;
        const delta = tm - expected;
        const over1rm = tm > oneRM;

        if (Math.abs(delta) >= 15 || over1rm) {
          findings.push({
            name: c.name,
            id: c.id,
            lift,
            cycle,
            tm,
            expected,
            oneRM,
            delta,
            over1rm,
          });
        }
      }
    }
  }

  const clientsAffected = Array.from(new Set(findings.map((f) => f.name)));

  console.log(
    JSON.stringify(
      {
        clientCount: clients.length,
        findingCount: findings.length,
        clientsAffected,
        findings,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
