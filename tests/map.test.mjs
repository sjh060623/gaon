import test from 'node:test';
import assert from 'node:assert/strict';
import {compactPath,routeMapSegments} from '../lib/map-geometry.mjs';
import {parseKakaoTransit} from '../lib/transit.mjs';

test('map paths keep longitude/latitude order, reject invalid points, and retain endpoints when bounded',()=>{
 const points=Array.from({length:1200},(_,i)=>[127+i/10000,37+i/10000]);
 const path=compactPath([[0,0],...points,[null,37]],100);
 assert.equal(path.length,100);assert.deepEqual(path[0],points[0]);assert.deepEqual(path.at(-1),points.at(-1));
 assert.deepEqual(compactPath([[127,37],[127,37],[127.1,37.1]]),[[127,37],[127.1,37.1]]);
});
test('transit geometry preserves walking and railway segments and connects exact origins without inventing a road',()=>{
 const route=parseKakaoTransit({properties:{totalTime:1200},steps:[
  {properties:{type:'WALKING',time:60},path:{points:[[127,37],[127.01,37.01]]}},
  {properties:{type:'SUBWAY',time:1140,vehicles:[{name:'1호선'}]},path:{points:[[127.01,37.01],[127.1,37.1]]}}
 ]},{id:'a'});
 assert.deepEqual(route.mapSegments.map(s=>s.type),['walk','subway']);
 const connected=routeMapSegments(route,{lng:126.99,lat:36.99},{lng:127.11,lat:37.11});
 assert.equal(connected[0].approximate,true);assert.equal(connected.at(-1).approximate,true);
 assert.deepEqual(connected[0].path[0],[126.99,36.99]);assert.deepEqual(connected.at(-1).path.at(-1),[127.11,37.11]);
 const fallback=routeMapSegments({}, {lng:127,lat:37}, {lng:127.2,lat:37.2});
 assert.equal(fallback[0].type,'connection');assert.equal(fallback[0].approximate,true);
});
