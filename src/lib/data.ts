import type { Client, CycleSettings, HistoricalRecord, Lift } from './types';

let clients: Client[] = [
  {
    id: 'client-1',
    name: 'John Doe',
    oneRepMaxes: { Squat: 315, Bench: 225, Deadlift: 405, Press: 135 },
    trainingMaxes: { Squat: 285, Bench: 205, Deadlift: 365, Press: 120 },
  },
  {
    id: 'client-2',
    name: 'Jane Smith',
    oneRepMaxes: { Squat: 225, Bench: 135, Deadlift: 275, Press: 95 },
    trainingMaxes: { Squat: 205, Bench: 120, Deadlift: 250, Press: 85 },
  },
];

let historicalData: HistoricalRecord[] = [
    {
        clientId: 'client-1',
        date: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString(),
        lift: 'Squat',
        weight: 270,
        reps: 5,
        estimated1RM: 315,
    },
    {
        clientId: 'client-1',
        date: new Date(new Date().setDate(new Date().getDate() - 23)).toISOString(),
        lift: 'Squat',
        weight: 285,
        reps: 3,
        estimated1RM: 313,
    },
    {
        clientId: 'client-1',
        date: new Date(new Date().setDate(new Date().getDate() - 16)).toISOString(),
        lift: 'Squat',
        weight: 295,
        reps: 3,
        estimated1RM: 324,
    },
    {
        clientId: 'client-1',
        date: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString(),
        lift: 'Bench',
        weight: 195,
        reps: 4,
        estimated1RM: 221,
    }
];

const cycleSettings: CycleSettings = {
  week1: {
    name: "Week 1",
    percentages: { warmup1: 0.4, warmup2: 0.5, workset1: 0.65, workset2: 0.75, workset3: 0.85 },
    reps: { workset1: 5, workset2: 5, workset3: "5+" },
  },
  week2: {
    name: "Week 2",
    percentages: { warmup1: 0.4, warmup2: 0.5, workset1: 0.7, workset2: 0.8, workset3: 0.9 },
    reps: { workset1: 3, workset2: 3, workset3: "3+" },
  },
  week3: {
    name: "Week 3",
    percentages: { warmup1: 0.4, warmup2: 0.5, workset1: 0.75, workset2: 0.85, workset3: 0.95 },
    reps: { workset1: 5, workset2: 3, workset3: "1+" },
  },
};

// Simulate a database
export const getClients = () => clients;
export const getCycleSettings = () => cycleSettings;
export const getHistoricalData = () => historicalData;

export const addClient = (clientData: Omit<Client, 'id'>) => {
    const newClient = { ...clientData, id: `client-${Date.now()}` };
    clients.push(newClient);
    return newClient;
};

export const addHistoricalRecord = (record: HistoricalRecord) => {
    historicalData.push(record);
    return record;
};

export const graduateTeam = () => {
    clients = clients.map(client => {
        return {
            ...client,
            trainingMaxes: {
                Squat: client.trainingMaxes.Squat + 10,
                Deadlift: client.trainingMaxes.Deadlift + 10,
                Bench: client.trainingMaxes.Bench + 5,
                Press: client.trainingMaxes.Press + 5,
            }
        };
    });
    return clients;
};
