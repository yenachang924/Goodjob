import { learningEndpoint } from '@cockpit/backend/learning';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const GET = (request: Request) => learningEndpoint(request);
export const POST = GET;
