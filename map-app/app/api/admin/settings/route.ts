import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateAdminRequest } from '@/lib/auth/shopify';
import { prisma } from '@/lib/db/client';

const settingsSchema = z.object({
  mapProvider: z.string().trim().max(80).optional(),
  defaultLatitude: z.number().min(-90).max(90).nullable().optional(),
  defaultLongitude: z.number().min(-180).max(180).nullable().optional(),
  defaultZoom: z.number().min(1).max(20).optional(),
  searchRadius: z.number().int().min(1).max(500).optional(),
  enableGeolocation: z.boolean().optional(),
  showDirections: z.boolean().optional(),
  showPhone: z.boolean().optional(),
  showWebsite: z.boolean().optional(),
  showOpeningHours: z.boolean().optional(),
  mapStyle: z.string().trim().max(120).optional(),
  markerStyle: z.string().trim().max(80).optional(),
  primaryColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  accentColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  customSections: z.array(z.object({
    id: z.string().trim().min(1).max(60),
    title: z.string().trim().min(1).max(120),
    fields: z.array(z.object({
      id: z.string().trim().min(1).max(60),
      label: z.string().trim().min(1).max(120),
      type: z.enum(['text', 'textarea', 'url', 'email', 'phone', 'number']),
    })).max(20),
  })).max(20).optional(),
  modalConfig: z.object({
    backgroundColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
    textColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
    accentColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
    borderRadius: z.number().int().min(0).max(40).optional(),
    width: z.number().int().min(280).max(900).optional(),
    sections: z.array(z.string().trim().min(1).max(80)).max(40).optional(),
    hidden: z.array(z.string().trim().min(1).max(80)).max(40).optional(),
  }).optional(),
});

export async function GET(request: Request) {
  try {
    const { shop } = await authenticateAdminRequest(request);
    const settings = await prisma.settings.findUnique({ where: { shopId: shop.id } });
    return NextResponse.json(settings ?? { shopId: shop.id });
  } catch (error) {
    console.error('Admin settings GET failed', error);
    return NextResponse.json({ error: 'Unable to authenticate or load settings' }, { status: 401 });
  }
}

export async function PUT(request: Request) {
  try {
    const { shop } = await authenticateAdminRequest(request);
    const input = settingsSchema.parse(await request.json());
    const settings = await prisma.settings.upsert({ where: { shopId: shop.id }, create: { shopId: shop.id, ...input }, update: input });
    return NextResponse.json(settings);
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid settings' }, { status: 400 });
    console.error('Admin settings PUT failed', error);
    return NextResponse.json({ error: 'Unable to authenticate or save settings' }, { status: 401 });
  }
}
