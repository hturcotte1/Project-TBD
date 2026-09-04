import { type NextRequest, NextResponse } from 'next/server';

/**
 * Builds a `.vcf` for the agent's iMessage contact on demand, from `?name=` and `?phone=` query
 * params the client already has from `GET /settings` (`agent_name`, `agent_phone_number`). No
 * server-side lookup needed, so this stays public (see `middleware.ts`).
 */
function escapeVCardValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n');
}

export async function GET(req: NextRequest): Promise<Response> {
  const name = req.nextUrl.searchParams.get('name')?.trim() || 'Agent';
  const phone = req.nextUrl.searchParams.get('phone')?.trim();
  if (!phone) {
    return NextResponse.json({ code: 'bad_request', message: 'phone is required' }, { status: 400 });
  }

  const lines = ['BEGIN:VCARD', 'VERSION:3.0', `N:;${escapeVCardValue(name)};;;`, `FN:${escapeVCardValue(name)}`, `TEL;TYPE=CELL:${phone}`, 'END:VCARD', ''];

  return new Response(lines.join('\r\n'), {
    status: 200,
    headers: {
      'content-type': 'text/vcard; charset=utf-8',
      'content-disposition': `attachment; filename="${name.replace(/[^a-zA-Z0-9]/g, '-')}.vcf"`,
    },
  });
}
