import {compactPath} from './map-geometry.mjs';
const validSeconds=value=>Number.isFinite(value)&&value>=0;
export function parseKakaoTransit(found,person){
 const properties=found.properties||{},steps=found.steps||[];
 if(!Number.isFinite(properties.totalTime)||properties.totalTime<=0||!steps.length)throw new Error('전체 이동시간과 세부 경로가 필요합니다.');
 if(steps.some(s=>!['WALKING','BUS','SUBWAY'].includes(s.properties?.type)))throw new Error('지원하지 않는 대중교통 구간입니다.');
 const transit=steps.filter(s=>s.properties.type!=='WALKING');if(!transit.length)throw new Error('대중교통 승차 구간이 없습니다.');
 const first=steps.findIndex(s=>s.properties.type!=='WALKING'),last=steps.findLastIndex(s=>s.properties.type!=='WALKING');
 const legs=steps.map((s,index)=>{
  const p=s.properties,type=p.type==='WALKING'?'walk':p.type==='BUS'?'bus':'subway',stops=p.stops||[];
  return {type,minutes:validSeconds(p.time)?Math.ceil(p.time/60):null,distance:Number.isFinite(p.distance)?p.distance:null,line:type==='walk'?null:(p.vehicles||[]).map(v=>v.name).filter(Boolean).join(' / ')||null,from:stops[0]?.name||null,to:stops.at(-1)?.name||null,stopCount:stops.length?Math.max(0,stops.length-1):null,label:type==='walk'?(index<first?'출발지에서 승차 지점까지':index>last?'하차 후 도착지까지':'환승 이동'):p.guidance||(type==='bus'?'버스':'지하철')};
 });
 const mapSegments=steps.map(step=>({type:step.properties.type==='WALKING'?'walk':step.properties.type==='BUS'?'bus':'subway',path:compactPath(step.path?.points)})).filter(segment=>segment.path.length>1);
 const walks=steps.filter(s=>s.properties.type==='WALKING'),walkMinutes=walks.every(s=>validSeconds(s.properties.time))?Math.ceil(walks.reduce((n,s)=>n+s.properties.time,0)/60):null;
 return {mapSegments,personId:person.id,minutes:Math.ceil(properties.totalTime/60),mode:'transit',provider:'kakao',summary:transit.flatMap(s=>(s.properties.vehicles||[]).map(v=>v.name)).filter(Boolean).join(' → ')||'카카오맵 대중교통',walkMinutes,transfers:Number.isInteger(properties.transfers)&&properties.transfers>=0?properties.transfers:Math.max(0,transit.length-1),walkDistance:walks.every(s=>Number.isFinite(s.properties.distance))?walks.reduce((n,s)=>n+s.properties.distance,0):null,legs};
}
