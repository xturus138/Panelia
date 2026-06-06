import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

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
    const { uid, type, data } = body;

    if (!uid) {
      return NextResponse.json({ success: false, error: 'uid required' }, { status: 400 });
    }

    const allData = await getSyncData();
    if (!allData[uid]) allData[uid] = { updates: [] };

    allData[uid].updates.push({
      timestamp: new Date().toISOString(),
      type,
      data
    });

    if (allData[uid].updates.length > 1000) {
      allData[uid].updates = allData[uid].updates.slice(-1000);
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
