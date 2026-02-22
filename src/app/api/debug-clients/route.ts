import { graduateTeam, getClients } from '@/lib/data';

export async function GET() {
  try {
    const clients = await getClients();
    const firstClient = clients[0];
    
    if (!firstClient) {
      return Response.json({ error: 'No clients found' });
    }

    return Response.json({
      success: true,
      firstClient: {
        id: firstClient.id,
        name: firstClient.name,
        currentCycleNumber: firstClient.currentCycleNumber,
        trainingMaxes: firstClient.trainingMaxes,
      }
    });
  } catch (error) {
    return Response.json({ 
      success: false, 
      error: String(error)
    }, { status: 500 });
  }
}
