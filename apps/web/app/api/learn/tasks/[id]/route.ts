import { learningEndpoint } from '@cockpit/backend/learning';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return learningEndpoint(request, id);
}
