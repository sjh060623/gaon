import {parseKakaoTransit} from './transit.mjs';
export {parseKakaoTransit} from './transit.mjs';
import {distance} from './meet.mjs';
const NAVER_BASE='https://maps.apigw.ntruss.com';
const hasNaver=()=>!!(process.env.NAVER_MAPS_CLIENT_ID&&process.env.NAVER_MAPS_CLIENT_SECRET);
const naverHeaders=()=>({'x-ncp-apigw-api-key-id':process.env.NAVER_MAPS_CLIENT_ID,'x-ncp-apigw-api-key':process.env.NAVER_MAPS_CLIENT_SECRET});
export function providerStatus(){const kakao=!!process.env.KAKAO_REST_API_KEY;return {places:kakao,addresses:hasNaver()||kakao,car:hasNaver()||!!process.env.KAKAO_MOBILITY_REST_API_KEY,carProvider:hasNaver()?'naver':process.env.KAKAO_MOBILITY_REST_API_KEY?'kakao':null,transit:kakao,transitProvider:'kakao',candidates:kakao};}
async function getJson(url,headers={},overallSignal){
 const response=await fetch(url,{headers,signal:overallSignal?AbortSignal.any([overallSignal,AbortSignal.timeout(9000)]):AbortSignal.timeout(9000),cache:'no-store'});
 if(!response.ok){const message=response.status===429?'조회 한도에 도달했습니다.':response.status===401?'지도 API 키 인증에 실패했습니다.':response.status===403?'지도 API 사용 권한 또는 카카오맵 활성화 상태를 확인해 주세요.':'지도 서비스에 연결하지 못했습니다.';const error=new Error(message);error.fatal=[401,403,429].includes(response.status);throw error;}
 return response.json();
}
export async function searchPlaces(query,extra={}){
 const url=new URL('https://dapi.kakao.com/v2/local/search/keyword.json');
 url.search=new URLSearchParams({query,size:'15',...extra}).toString();
 const result=await getJson(url,{Authorization:`KakaoAK ${process.env.KAKAO_REST_API_KEY}`});
 return (result.documents||[]).map(p=>({id:p.id,name:p.place_name,address:p.road_address_name||p.address_name,lng:Number(p.x),lat:Number(p.y),area:p.address_name?.split(' ').slice(0,2).join(' '),kind:'place'}));
}
export async function searchAddresses(query){
 if(hasNaver()){
  const url=new URL(`${NAVER_BASE}/map-geocode/v2/geocode`);url.search=new URLSearchParams({query,count:'10'}).toString();
  const data=await getJson(url,{...naverHeaders(),Accept:'application/json'});
  if(data.status&&data.status!=='OK')throw new Error('주소 검색에 실패했습니다. 네이버 Geocoding 사용 권한을 확인해 주세요.');
  return (data.addresses||[]).map(p=>({id:`addr:${p.x},${p.y}`,name:p.roadAddress||p.jibunAddress,address:p.roadAddress||p.jibunAddress,lng:Number(p.x),lat:Number(p.y),area:p.jibunAddress?.split(' ').slice(0,2).join(' '),kind:'address'}));
 }
 const url=new URL('https://dapi.kakao.com/v2/local/search/address.json');url.search=new URLSearchParams({query,size:'10'}).toString();
 const data=await getJson(url,{Authorization:`KakaoAK ${process.env.KAKAO_REST_API_KEY}`});
 return (data.documents||[]).map(p=>({id:`addr:${p.x},${p.y}`,name:p.road_address?.address_name||p.address_name,address:p.road_address?.address_name||p.address_name,lng:Number(p.x),lat:Number(p.y),area:p.address?.region_2depth_name,kind:'address'}));
}
export async function searchOrigins(query){
 // Do not classify by digits: numbered businesses and addresses both occur.
 const tasks=[];if(providerStatus().addresses)tasks.push(searchAddresses(query));if(providerStatus().places)tasks.push(searchPlaces(query));if(!tasks.length)throw new Error('주소 검색 API가 설정되지 않았습니다.');const responses=await Promise.allSettled(tasks);
 if(responses.every(r=>r.status==='rejected'))throw new Error('주소·장소를 검색하지 못했습니다. 지도 API 연결을 확인해 주세요.');
 const places=[];for(const r of responses)if(r.status==='fulfilled')for(const p of r.value){if(Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&!places.some(v=>distance(v,p)<.015&&v.name===p.name))places.push(p);}
 return {places:places.slice(0,20),warnings:responses.some(r=>r.status==='rejected')?['일부 검색 서비스가 응답하지 않았습니다.']:[]};
}
export async function reverseAddress(lng,lat){
 if(!process.env.KAKAO_REST_API_KEY) return {address:`위도 ${lat.toFixed(5)}, 경도 ${lng.toFixed(5)}`};
 const url=new URL('https://dapi.kakao.com/v2/local/geo/coord2address.json');url.search=new URLSearchParams({x:String(lng),y:String(lat)}).toString();
 const data=await getJson(url,{Authorization:`KakaoAK ${process.env.KAKAO_REST_API_KEY}`});const doc=data.documents?.[0];return {address:doc?.road_address?.address_name||doc?.address?.address_name||`위도 ${lat.toFixed(5)}, 경도 ${lng.toFixed(5)}`};
}
async function route(person,destination,overallSignal){
 const a=person.place;
 if(person.mode==='car'){
  if(hasNaver()){
   const url=new URL(`${NAVER_BASE}/map-direction/v1/driving`);url.search=new URLSearchParams({start:`${a.lng},${a.lat}`,goal:`${destination.lng},${destination.lat}`,option:'trafast'}).toString();
   const data=await getJson(url,naverHeaders(),overallSignal);const found=data.route?.trafast?.find(r=>r.summary?.duration>0);
   if(data.code!==0||!found)throw new Error('네이버 자동차 경로를 찾지 못했습니다.');
   // NAVER duration is milliseconds; Kakao below uses seconds.
   const minutes=Math.max(1,Math.ceil(found.summary.duration/60000));
   return {personId:person.id,minutes,mode:'car',provider:'naver',summary:`네이버 자동차 · ${(found.summary.distance/1000).toFixed(1)}km`,toll:found.summary.tollFare||0,legs:[{type:'car',minutes,line:null,from:a.name,to:destination.name,label:'자동차 이동'}]};
  }
  const url=new URL('https://apis-navi.kakaomobility.com/v1/directions');url.search=new URLSearchParams({origin:`${a.lng},${a.lat}`,destination:`${destination.lng},${destination.lat}`,priority:'TIME',summary:'true'}).toString();
  const data=await getJson(url,{Authorization:`KakaoAK ${process.env.KAKAO_MOBILITY_REST_API_KEY}`},overallSignal);
  const found=data.routes?.find(r=>r.result_code===0&&r.summary?.duration>0);if(!found)throw new Error('자동차 경로를 찾지 못했습니다.');
  const minutes=Math.max(1,Math.ceil(found.summary.duration/60));return {personId:person.id,minutes,mode:'car',provider:'kakao',summary:`카카오 자동차 · ${(found.summary.distance/1000).toFixed(1)}km`,toll:found.summary.fare?.toll||0,legs:[{type:'car',minutes,from:a.name,to:destination.name,label:'자동차 이동'}]};
 }
 const url=new URL('https://dapi.kakao.com/v2/routing/publictraffic');
 url.search=new URLSearchParams({start_x:String(a.lng),start_y:String(a.lat),end_x:String(destination.lng),end_y:String(destination.lat),s_name:a.name,e_name:destination.name,input_coord:'WGS84',output_coord:'WGS84'}).toString();
 const data=await getJson(url,{Authorization:`KakaoAK ${process.env.KAKAO_REST_API_KEY}`},overallSignal);
 if(data.status!=='OK')throw new Error('해당 출발지에서 대중교통 경로를 찾지 못했습니다.');
 const paths=(data.routes||[]).filter(p=>p.properties?.totalTime>0).sort((a,b)=>a.properties.totalTime-b.properties.totalTime);
 for(const path of paths){try{return parseKakaoTransit(path,person);}catch{}}
 throw new Error('도보·환승을 포함한 대중교통 경로가 없습니다.');
}

export async function liveResults(people,requestSignal){
 const center={lng:people.reduce((v,p)=>v+p.place.lng,0)/people.length,lat:people.reduce((v,p)=>v+p.place.lat,0)/people.length};
 const points=[center,...people.map(p=>({lng:(p.place.lng+center.lng)/2,lat:(p.place.lat+center.lat)/2}))];
 const sets=await Promise.all(points.map(p=>searchPlaces('역',{x:String(p.lng),y:String(p.lat),radius:'20000',sort:'distance',category_group_code:'SW8'})));
 const unique=new Map();for(const set of sets)for(const p of set)if(![...unique.values()].some(v=>v.name===p.name&&distance(v,p)<.2))unique.set(p.id,p);
 // Geometry proposes only three candidates; final ranking uses full route times.
 const candidates=[...unique.values()].sort((a,b)=>distance(center,a)-distance(center,b)).slice(0,3);
 if(!candidates.length)throw new Error('주변에서 만남 후보 역을 찾지 못했습니다.');
 const results=[];let excluded=0,routeCalls=0;const timeout=AbortSignal.timeout(45000),overallSignal=requestSignal?AbortSignal.any([requestSignal,timeout]):timeout;
 const pending=new Map();
 async function getRoute(person,place){
  const key=[person.mode,person.place.lng,person.place.lat,place.lng,place.lat].join(':');
  if(!pending.has(key)){routeCalls++;pending.set(key,route(person,place,overallSignal));}
  return {...await pending.get(key),personId:person.id};
 }
 for(const [index,place] of candidates.entries()){
  if(requestSignal?.aborted)throw new Error('요청이 취소되었습니다.');if(overallSignal.aborted){excluded+=candidates.length-index;break;}
  const routes=await Promise.allSettled(people.map(p=>getRoute(p,place)));
  const fatal=routes.find(r=>r.status==='rejected'&&r.reason?.fatal);if(fatal)throw fatal.reason;
  if(routes.every(r=>r.status==='fulfilled'))results.push({place,routes:routes.map(r=>r.value)});else excluded++;
 }
 if(!results.length)throw new Error('모든 참가자의 전체 경로를 확보하지 못했습니다. 출발지와 API 연결을 확인해 주세요.');
 return {results,excluded,candidateCount:candidates.length,routeCalls};
}

