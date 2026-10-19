import {providerStatus} from '@/lib/providers.mjs';
export async function GET(){return Response.json(providerStatus(),{headers:{'Cache-Control':'no-store'}});}
