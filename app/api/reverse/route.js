import {reverseAddress} from '@/lib/providers.mjs';
export async function GET(request){
 const params=new URL(request.url).searchParams,lng=Number(params.get('lng')),lat=Number(params.get('lat'));
 if(!params.has('lng')||!params.has('lat')||!Number.isFinite(lng)||!Number.isFinite(lat)||lat<33||lat>39||lng<124||lng>132)return Response.json({error:'대한민국 내 좌표를 확인해 주세요.'},{status:400});
 try{return Response.json(await reverseAddress(lng,lat),{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({address:`위도 ${lat.toFixed(5)}, 경도 ${lng.toFixed(5)}`});}
}
