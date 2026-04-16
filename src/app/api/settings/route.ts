import { NextRequest, NextResponse } from 'next/server';
import { getSetting, setSetting } from '@/lib/db';

const SETTING_KEYS = [
  'epos_app_id',
  'epos_app_secret',
];

export async function GET() {
  const settings: Record<string, string> = {};
  for (const key of SETTING_KEYS) {
    const val = getSetting(key);
    if (val) {
      // Mask secrets: show only fixed "••••••••" + last 4 characters
      if (key.includes('secret') || key.includes('key')) {
        settings[key] = '••••••••' + val.slice(-4);
      } else {
        settings[key] = val;
      }
    }
  }
  return NextResponse.json(settings);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    for (const key of SETTING_KEYS) {
      if (key in body && body[key] !== undefined) {
        const value = String(body[key]).trim();
        // Skip if value looks like a masked placeholder
        if (value.includes('••••')) continue;
        if (value) {
          setSetting(key, value);
        }
      }
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
