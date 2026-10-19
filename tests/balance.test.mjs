import test from 'node:test';
import assert from 'node:assert/strict';
import {rankResults} from '../lib/meet.mjs';
import {searchBalancedPlaces,seedSearchPoints} from '../lib/meeting-search.mjs';
const people=[
 {id:'a',mode:'transit',place:{lng:127,lat:37.5}},
 {id:'b',mode:'transit',place:{lng:127.05,lat:37.5}},
 {id:'c',mode:'transit',place:{lng:126.6,lat:37.4}}
];
test('fairness gives absolute priority to the time gap and uses the longest trip to break a tie',()=>{
 const result=(id,times)=>({place:{id},routes:times.map(minutes=>({minutes}))});
 const results=[result('quick',[20,25,30]),result('equal',[70,71,72]),result('equal-but-slower',[80,81,82])];
 assert.equal(rankResults(results,'fair',90)[0].place.id,'equal');
 assert.equal(rankResults(results,'fast',90)[0].place.id,'quick');
 assert.equal(rankResults(results,'fair',60)[0].place.id,'quick');
});
test('seed coverage includes the western origin and intermediate regions',()=>{
 const {points}=seedSearchPoints(people);
 assert.ok(points.some(p=>p.lng===126.6));assert.ok(points.some(p=>p.lng>126.6&&p.lng<126.85));
});
test('measured time imbalance triggers a western search and finds a balanced station missed by the initial pool',async()=>{
 const initial=[0,1,2].map(i=>({id:`seoul-${i}`,name:'서울 후보',lng:126.94+i*.004,lat:37.5}));
 const balanced={id:'balanced',name:'경기 후보',lng:126.8,lat:37.45};let routingStarted=false,westSearched=false;
 const result=await searchBalancedPlaces(people,{
  searchPlaces:async(_,query)=>{
   if(routingStarted&&Number(query.x)<126.92){westSearched=true;return [balanced];}
   return initial;
  },
  route:async(person,place)=>{
   routingStarted=true;const index=people.findIndex(p=>p.id===person.id);
   return {personId:person.id,minutes:(place.id==='balanced'?[54,55,56]:[33,49,77])[index]};
  }
 });
 const best=rankResults(result.results,'fair',90)[0];
 assert.equal(westSearched,true);assert.equal(best.place.id,'balanced');assert.equal(best.spread,2);assert.ok(result.searchRounds>1);
});
test('a broad search stays within 24 destinations and eight simultaneous routing requests',async()=>{
 const travellers=[...people,{id:'d',mode:'car',place:{lng:127.2,lat:37.3}}];
 const stations=Array.from({length:100},(_,i)=>({id:`s${i}`,name:`후보 ${i}`,lng:126.5+(i%10)*.08,lat:37.2+Math.floor(i/10)*.04}));
 let active=0,peak=0,calls=0;
 const result=await searchBalancedPlaces(travellers,{
  searchPlaces:async()=>stations,
  route:async(person,place)=>{
   active++;peak=Math.max(peak,active);calls++;
   await new Promise(resolve=>setTimeout(resolve,1));active--;
   return {personId:person.id,minutes:25+travellers.findIndex(p=>p.id===person.id)*10+Number(place.id.slice(1))%4};
  }
 });
 assert.equal(result.candidateCount,24);assert.equal(calls,96);assert.ok(peak<=8);
});
test('an authentication failure drains queued work and stops instead of returning partial recommendations',async()=>{
 const stations=Array.from({length:12},(_,i)=>({id:`s${i}`,name:'후보',lng:126.5+i*.04,lat:37.4}));
 const error=Object.assign(new Error('권한 오류'),{fatal:true});
 await assert.rejects(searchBalancedPlaces([...people,{...people[0],id:'d',mode:'car'}],{
  searchPlaces:async()=>stations,
  route:async()=>{throw error;}
 }),/권한 오류/);
});
