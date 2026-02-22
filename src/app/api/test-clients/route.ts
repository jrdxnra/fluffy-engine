import { getClients } from '@/lib/data';

export async function GET() {
  try {
    const clients = await getClients();
    return Response.json({ 
      success: true, 
      count: clients.length,
      clients: clients
    });
  } catch (error) {
    return Response.json({ 
      success: false, 
      error: String(error)
    }, { status: 500 });
  }
}
