import {validatePeople} from '@/lib/meet.mjs';
import {liveResults,providerStatus} from '@/lib/providers.mjs';
export async function POST(request){
 let people,limit=90;try{const body=await request.text();if(body.length>12000)throw new Error('요청이 너무 큽니다.');const data=JSON.parse(body);people=validatePeople(data.people);if(data.limit!==undefined){if(!Number.isFinite(data.limit)||data.limit<15||data.limit>120)throw new Error('최대 이동시간은 15~120분으로 설정해 주세요.');limit=data.limit;}}catch(e){return Response.json({error:e.message||'출발지를 확인해 주세요.'},{status:400});}
 const config=providerStatus();if(!config.places||people.some(p=>!config[p.mode]))return Response.json({error:'카카오 REST API 키를 등록하고 카카오맵을 활성화해야 합니다. 자동차는 네이버 키도 확인해 주세요.'},{status:503});
 try{return Response.json({...await liveResults(people,request.signal,{limit}),source:'live',queriedAt:new Date().toISOString()},{headers:{'Cache-Control':'no-store'}});}catch(e){return Response.json({error:e.message},{status:502});}
}
