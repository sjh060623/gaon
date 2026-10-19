import {searchOrigins,providerStatus} from '@/lib/providers.mjs';
export async function GET(request){
 const q=new URL(request.url).searchParams.get('q')?.trim();
 if(!q||q.length>80)return Response.json({error:'검색어는 1~80자로 입력해 주세요.'},{status:400});
 if(!providerStatus().addresses)return Response.json({error:'주소·장소 검색 API 키가 아직 설정되지 않았습니다. 실제 검색에는 지도 API 연결이 필요합니다.'},{status:503});
 try{return Response.json(await searchOrigins(q),{headers:{'Cache-Control':'no-store'}});}catch(e){return Response.json({error:e.message},{status:502});}
}
