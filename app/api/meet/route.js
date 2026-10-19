import {validatePeople} from '@/lib/meet.mjs';
import {liveResults,providerStatus} from '@/lib/providers.mjs';
export async function POST(request){
 let people;try{const body=await request.text();if(body.length>12000)throw new Error('요청이 너무 큽니다.');people=validatePeople(JSON.parse(body).people);}catch(e){return Response.json({error:e.message||'출발지를 확인해 주세요.'},{status:400});}
 const config=providerStatus();if(!config.places||people.some(p=>!config[p.mode]))return Response.json({error:'카카오 REST API 키를 등록하고 카카오맵을 활성화해야 합니다. 자동차는 네이버 키도 확인해 주세요.'},{status:503});
 try{return Response.json({...await liveResults(people,request.signal),source:'live',queriedAt:new Date().toISOString()},{headers:{'Cache-Control':'no-store'}});}catch(e){return Response.json({error:e.message},{status:502});}
}
