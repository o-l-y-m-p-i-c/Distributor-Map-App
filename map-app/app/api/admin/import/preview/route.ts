import {NextResponse} from 'next/server';
import {parse} from 'csv-parse/sync';
import {z} from 'zod';
import {authenticateAdminRequest} from '@/lib/auth/shopify';

const rowSchema = z.object({
  name: z.string().trim().min(1), address: z.string().trim().min(1), city: z.string().trim().min(1), postal_code: z.string().trim().min(1), country: z.string().trim().min(1),
  address2: z.string().optional().default(''), state: z.string().optional().default(''), latitude: z.string().optional().default(''), longitude: z.string().optional().default(''), phone: z.string().optional().default(''), email: z.string().optional().default(''), website: z.string().optional().default(''), type: z.string().optional().default('store'), description: z.string().optional().default(''),
});

export async function POST(request: Request) {
  try {
    await authenticateAdminRequest(request);
    const body = await request.json() as {csv?: string};
    if (!body.csv || body.csv.length > 2_000_000) return NextResponse.json({error: 'CSV is missing or too large'}, {status: 400});
    const rows = parse(body.csv, {columns: true, skip_empty_lines: true, bom: true, relax_column_count: true}) as Record<string, string>[];
    const preview = rows.map((row, index) => {
      const parsed = rowSchema.safeParse(row);
      return parsed.success ? {row: index + 2, valid: true, data: parsed.data} : {row: index + 2, valid: false, errors: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`), data: row};
    });
    return NextResponse.json({total: preview.length, valid: preview.filter((row) => row.valid).length, invalid: preview.filter((row) => !row.valid).length, rows: preview.slice(0, 100)});
  } catch (error) {
    console.error('CSV preview failed', error);
    return NextResponse.json({error: 'Unable to authenticate or parse CSV'}, {status: 400});
  }
}
