import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const sandbox = {};
vm.runInNewContext(readFileSync('public/assets/scenario.js','utf8'),sandbox);
const { validate,encode,decode,difference } = sandbox.AIScenario;
const catalog = { devices:[{id:'a'},{id:'b'}],models:[{id:'m',use:['coding']}],quants:[{id:'q4'}],uses:[{id:'coding'},{id:'all'}],images:[{id:'sdxl'}],contexts:[4096,8192],prompts:[1024,4096] };
const scenario = {v:1,devices:['a','b'],model:'m',use:'coding',image:'sdxl',quant:'q4',ctx:1,prompt:0,ram:64,base:true,baseCost:1300,wired:false,showPrices:true,prices:{a:1000,b:null},privateField:'omit'};
const clean = validate(scenario,catalog);
assert.ok(clean); assert.equal(clean.privateField,undefined);
assert.equal(JSON.stringify(decode(encode(clean),catalog)),JSON.stringify(clean));
for (const bad of [{v:2},{devices:['a','a']},{devices:['a','missing']},{ctx:10},{prompt:-1},{ram:NaN},{baseCost:-1},{use:'unknown'},{model:'missing'},{quant:'unknown'},{prices:{a:'1000',b:null}},{prices:{a:1000}},{image:'unknown'}]) assert.equal(validate({...scenario,...bad},catalog),null);
for (const hash of ['#compare=%ZZ','#compare=null','#compare='+encodeURIComponent('x'.repeat(8000))]) assert.equal(decode(hash,catalog),null);
// Optionale Felder: Modell je Gerät und Strompreis
{ const m = catalog.models[0].id;
  const per = validate({...scenario, cmpMode:'manual', models:[m,m], elPrice:0.31}, catalog);
  assert.equal(per.cmpMode,'manual'); assert.equal(JSON.stringify(per.models),JSON.stringify([m,m])); assert.equal(per.elPrice,0.31);
  assert.equal(JSON.stringify(decode(encode(per),catalog)),JSON.stringify(per));
  assert.equal(validate({...scenario}, catalog).cmpMode,'same');
  for (const bad of [{cmpMode:'x'},{cmpMode:'manual'},{cmpMode:'manual',models:['missing',m]},{elPrice:-1},{elPrice:'0.3'},{elPrice:9}]) assert.equal(validate({...scenario,...bad},catalog),null); }
assert.equal(difference(null,10),null);assert.equal(difference(Infinity,10),null);
assert.equal(difference(3,10).winner,0);assert.equal(difference(10,3).winner,1);assert.equal(difference(3,3).winner,null);assert.equal(difference(3,10).amount,7);
console.log('Comparison link round-trip, invalid/untrusted input, price snapshots and time/cost differences passed.');
