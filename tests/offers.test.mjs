import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {calculateOffer,compareOffers,parseCostIndexCSV,validateWeights,defaultWeights,offerPreferences} from '../core/offers/index.js';
const fixture=JSON.parse(await readFile(new URL('./fixtures/offers.json',import.meta.url),'utf8'));
test('offer fixtures reproduce 110600 total, 105488 adjusted, 98600 year-1 cash and entered priority ratings',()=>{
  const result=compareOffers(fixture.offers),expected=fixture.expected;assert.equal(result.rows[0].total,expected.beaconTotal);assert.equal(Math.round(result.rows[1].adjusted),expected.fjordAdjustedRounded);assert.equal(result.rows[0].year1Cash,expected.beaconYear1Cash);assert.deepEqual(result.rows.map(row=>Number(row.weightedScore.toFixed(1))),expected.scoresRounded);assert.equal(result.best.adjusted,110600);assert.deepEqual(fixture.offers[0].ratings,{growth:8,flexibility:4,team:9});
});
test('offer bounds, unknown vesting and missing ratings prevent invented financial assumptions',()=>{
  for(const field of ['base','colIndex','cliffMonths'])assert.throws(()=>calculateOffer({[field]:-1}));assert.throws(()=>calculateOffer({base:Infinity}));assert.throws(()=>calculateOffer({cliffMonths:1.5}));assert.throws(()=>compareOffers([{currency:'USD'},{currency:'GBP'}]));
  assert.equal(calculateOffer({base:100,equityPerYear:20,cliffMonths:6}).year1Cash,null);assert.equal(calculateOffer({base:100,equityPerYear:20,cliffMonths:6,vestedEquityYear1:7}).year1Cash,107);assert.equal(compareOffers([{base:100}]).rows[0].weightedScore,null);
  assert.equal(compareOffers([{base:0}],{weights:{compensation:100,growth:0,flexibility:0,team:0}}).rows[0].weightedScore,0);assert.throws(()=>validateWeights({...defaultWeights(),team:11}));assert.deepEqual(offerPreferences({weights:defaultWeights(),apiKey:'PRIVATE'}),{weights:defaultWeights()});
  for(const row of [null,[],{company:{}},{deleted:'yes'}])assert.throws(()=>compareOffers([row]));
});
test('cost CSV accepts quoted cities, CRLF and BOM, and rejects incomplete, duplicate or unsafe numeric data',()=>{
  assert.deepEqual(parseCostIndexCSV('\uFEFFcity,index\r\n"London, UK",100\r\nManchester,82\r\n'),[{city:'London, UK',index:100},{city:'Manchester',index:82}]);
  for(const text of ['city,index\nLondon,0','city,index\nLondon,','city,index\nLondon,Infinity','city,index\nLondon,82\nLondon,100','city,index\n"London,100','city,index\nLondon,100,extra'])assert.throws(()=>parseCostIndexCSV(text));
});
