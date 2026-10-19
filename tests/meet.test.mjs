import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_PEOPLE,PLACES,validatePeople,demoResults,rankResults} from '../lib/meet.mjs';
import {liveResults,parseKakaoTransit,searchOrigins,providerStatus} from '../lib/providers.mjs';
function path(){return {properties:{totalTime:2460,transfers:1},steps:[
 {properties:{type:'WALKING',time:95,distance:110}},
 {properties:{type:'BUS',time:720,vehicles:[{name:'1007'}],stops:[{name:'집 근처'},{name:'환승 정류장'}]}},
 {properties:{type:'WALKING',time:80,distance:90}},
 {properties:{type:'SUBWAY',time:1320,vehicles:[{name:'신분당선'}],stops:[{name:'판교'},{name:'강남'}]}},
 {properties:{type:'WALKING',time:125,distance:130}}
 ]};}
const docs=[['1','판교역','127.111','37.395'],['2','정자역','127.108','37.367'],['3','강남역','127.0276','37.4979'],['4','수원역','126.999','37.266']].map(([id,place_name,x,y])=>({id,place_name,x,y,address_name:'경기·서울',road_address_name:'출입구 주소'}));
async function withProviders(run){const previous=globalThis.fetch;const keys=['KAKAO_REST_API_KEY','KAKAO_MOBILITY_REST_API_KEY','NAVER_MAPS_CLIENT_ID','NAVER_MAPS_CLIENT_SECRET'];const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));process.env.KAKAO_REST_API_KEY='test';process.env.KAKAO_MOBILITY_REST_API_KEY='test';delete process.env.NAVER_MAPS_CLIENT_ID;delete process.env.NAVER_MAPS_CLIENT_SECRET;
 try{await run();}finally{globalThis.fetch=previous;for(const k of keys)if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}}
test('rejects invalid cardinality, mode and coordinates',()=>{
 for(const p of [[],DEFAULT_PEOPLE.slice(0,1),[...DEFAULT_PEOPLE,...DEFAULT_PEOPLE]])assert.throws(()=>validatePeople(p));
 assert.throws(()=>validatePeople([{...DEFAULT_PEOPLE[0],mode:'plane'},DEFAULT_PEOPLE[1]]));
 assert.throws(()=>validatePeople([{...DEFAULT_PEOPLE[0],place:{name:'x',lng:NaN,lat:0}},DEFAULT_PEOPLE[1]]));
});
test('demo supports four travellers with mixed modes',()=>{
 const data=demoResults([...DEFAULT_PEOPLE,{id:'d',name:'친구 3',place:PLACES[3],mode:'car'}]);assert.equal(data.length,PLACES.length);assert.ok(data.every(r=>r.routes.length===4&&r.routes.every(v=>v.minutes>0)));
});
test('fair and fast objectives differ and respect each traveller time limit',()=>{
 const make=(id,times)=>({place:{id},routes:times.map((minutes,i)=>({minutes,personId:String(i)}))});const data=[make('equal',[35,35]),make('fast',[10,25]),make('long',[100,100])];
 assert.equal(rankResults(data,'fair',90)[0].place.id,'equal');assert.equal(rankResults(data,'fast',90)[0].place.id,'fast');assert.deepEqual(rankResults(data,'fair',15),[]);
});
test('Kakao seconds are converted once; walks and transfers preserve actual stages',()=>{
 const raw=path(),result=parseKakaoTransit(raw,DEFAULT_PEOPLE[0]);assert.equal(result.minutes,41);assert.equal(result.walkMinutes,5);assert.equal(result.transfers,1);assert.equal(result.provider,'kakao');assert.equal(result.legs[0].label,'출발지에서 승차 지점까지');assert.equal(result.legs[2].label,'환승 이동');assert.equal(result.legs.at(-1).label,'하차 후 도착지까지');assert.equal(result.legs[1].line,'1007');assert.equal(result.legs[3].from,'판교');raw.steps[0].properties.time=-1;assert.equal(parseKakaoTransit(raw,DEFAULT_PEOPLE[0]).walkMinutes,null);
 assert.throws(()=>parseKakaoTransit({properties:{totalTime:10},steps:[]},DEFAULT_PEOPLE[0]));
});
test('four people compare all available seed candidates with bounded calls and exact addresses',()=>withProviders(async()=>{
 const calls=[];globalThis.fetch=async input=>{const u=new URL(input);calls.push(u);if(u.pathname.includes('/local/'))return Response.json({documents:docs});return Response.json({status:'OK',routes:[path()]});};
 const people=[...DEFAULT_PEOPLE,{id:'d',name:'친구 3',place:PLACES[4],mode:'transit'}];const result=await liveResults(people);assert.equal(result.candidateCount,4);assert.equal(result.routeCalls,16);assert.equal(calls.filter(u=>u.pathname.includes('publictraffic')).length,16);assert.ok(result.results.every(r=>r.routes.length===4));const first=calls.find(u=>u.pathname.includes('publictraffic'));assert.equal(first.searchParams.get('start_x'),String(people[0].place.lng));assert.equal(first.searchParams.get('start_y'),String(people[0].place.lat));assert.equal(providerStatus().transitProvider,'kakao');assert.ok(calls.every(u=>!u.hostname.includes('odsay')));
}));
test('same-address routes are deduplicated within one search and keep person ids',()=>withProviders(async()=>{
 globalThis.fetch=async input=>new URL(input).pathname.includes('/local/')?Response.json({documents:[docs[0]]}):Response.json({status:'OK',routes:[path()]});
 const people=[DEFAULT_PEOPLE[0],{...DEFAULT_PEOPLE[0],id:'b',name:'친구'}];const result=await liveResults(people);assert.equal(result.routeCalls,1);assert.deepEqual(result.results[0].routes.map(r=>r.personId),['a','b']);
}));
test('missing routes exclude a candidate and authentication errors stop searching',()=>withProviders(async()=>{
 globalThis.fetch=async input=>new URL(input).pathname.includes('/local/')?Response.json({documents:docs}):Response.json({status:'NO_RESULTS'});
 await assert.rejects(()=>liveResults(DEFAULT_PEOPLE),/경로를 확보/);
 globalThis.fetch=async input=>new URL(input).pathname.includes('/local/')?Response.json({documents:docs}):new Response('',{status:403});await assert.rejects(()=>liveResults(DEFAULT_PEOPLE),/권한/);
}));
test('mixed driving uses NAVER milliseconds and transit uses Kakao seconds',()=>withProviders(async()=>{
 process.env.NAVER_MAPS_CLIENT_ID='test';process.env.NAVER_MAPS_CLIENT_SECRET='test';
 globalThis.fetch=async input=>{const u=new URL(input);if(u.pathname.includes('/local/'))return Response.json({documents:[docs[0]]});if(u.hostname==='maps.apigw.ntruss.com')return Response.json({code:0,route:{trafast:[{summary:{duration:1500000,distance:10000}}]}});return Response.json({status:'OK',routes:[path()]});};
 const result=await liveResults([{...DEFAULT_PEOPLE[0],mode:'car'},DEFAULT_PEOPLE[1]]);assert.deepEqual(result.results[0].routes.map(r=>r.minutes),[25,41]);
}));
test('address and place search includes Gyeonggi results',()=>withProviders(async()=>{
 globalThis.fetch=async input=>new URL(input).pathname.includes('address.json')?Response.json({documents:[{x:'127.029',y:'37.264',address_name:'경기 수원시 팔달구 효원로 241'}]}):Response.json({documents:[{id:'suwon-city',place_name:'수원시청',x:'127.029',y:'37.264',address_name:'경기 수원시 팔달구 효원로 241'}]});const data=await searchOrigins('경기도 수원');assert.ok(data.places.some(p=>p.kind==='address'));assert.ok(data.places.some(p=>p.name==='수원시청'));
}));
