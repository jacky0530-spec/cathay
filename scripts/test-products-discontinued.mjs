import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const main=read('products.html'),stop=main.indexOf('已停售商品區');
assert(stop>main.indexOf('href="prod_accident.html"'));
const active=['prod_lifetime_medical.html','prod_good_health.html','prod_cancer_protect.html','prod_accident.html','prod_rider.html','prod_surgery.html','prod_bone.html'];
for(const name of active){assert((main.match(new RegExp('href="'+name+'"','g'))||[]).length===1,name+' duplicated/missing');assert(main.indexOf('href="'+name+'"')<stop);}
for(const [file,label] of [['prod_invest_forever.html','月月(永)溢'],['prod_invest_full.html','月月(滿)溢'],['prod_overflow_love.html','滿溢康愛']]){
 const pos=main.indexOf('href="'+file+'"');
 assert(pos>stop,file+' outside retired section');assert(main.indexOf('href="'+file+'"',pos+1)<0,file+' duplicate');
 assert(main.slice(pos,pos+280).includes(label));assert(main.slice(pos,pos+280).includes('已停售'));
 const detail=read(file);assert(detail.includes('role="note"')&&detail.includes('已停售')&&detail.includes('src="auth.js"'));
}
assert(!main.includes('<span class="badge">熱銷</span>'));
assert(main.includes('src="auth.js"'));
const sw=read('sw.js');
assert(sw.includes("cathay-app-v31")&&sw.includes("endsWith('/products.html')")&&sw.includes("self.clients.claim()"));
console.log('All discontinued product groups, original links, detail notices and PWA version: PASS');
