import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// Simulation of a server-side sync storage
// In a real app, this would be a database call
const SYNC_FILE = path.join(process.cwd(), 'sync_data.json');

async function getSyncData() {
  try {
    const data = await fs.readFile(SYNC_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

async function saveSyncData(data: any) {
  await fs.writeFile(SYNC_FILE, JSON.stringify(data, null, 2));
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, type, data } = body;

    // For now, use a default 'local-user' since we don't have auth
    const id = userId || 'local-user';

    const allData = await getSyncData();
    if (!allData[id]) allData[id] = { updates: [] };

    allData[id].updates.push({
      timestamp: new Date().toISOString(),
      type,
      data
    });

    // Keep only last 1000 updates
    if (allData[id].updates.length > 1000) {
      allData[id].updates = allData[id].updates.slice(-1000);
    }

    await saveSyncData(allData);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function GET() {
  const data = await getSyncData();
  return NextResponse.json(data);
}
