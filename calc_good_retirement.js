(function(root){
'use strict';
const monthly=r=>Math.pow(1+r/100,1/12)-1;
const fv=(cash,payment,n,r)=>{const m=monthly(r);return cash*Math.pow(1+m,n)+payment*(Math.abs(m)<1e-12?n:(Math.pow(1+m,n)-1)/m)};
const factor=(n,r)=>{const m=monthly(r);return Math.abs(m)<1e-12?n:(1-Math.pow(1+m,-n))/m};
function calculate(p){
 if(!Object.values(p).every(v=>typeof v==='string'||Number.isFinite(v)))throw Error('請填寫有效數字。');
 if(p.retire<p.age||p.end<=p.retire)throw Error('退休年齡不得小於目前年齡，規劃年齡必須大於退休年齡。');
 if(p.mode==='auto'&&(p.retire<60||p.claim<p.retire||p.claim<p.legal-5))throw Error('自動模式需退休年齡至少 60 歲，勞保請領不早於退休，且不得早於法定年齡前五年；其他情況請使用手動模式。');
 if(p.years>p.age)throw Error('目前勞保年資不能大於目前年齡。');
 const n=(p.retire-p.age)*12,N=(p.end-p.retire)*12;
 const yrs=p.years+n/12;
 const first=p.mode==='manual'?p.manualOne:yrs<15?0:Math.max(p.insured*yrs*.00775+3000,p.insured*yrs*.0155)*(1+Math.max(-5,Math.min(5,p.claim-p.legal))*.04);
 let account=p.balance*10000;
 for(let i=0;i<n;i++)account=account*(1+monthly(p.fund))+p.salary*Math.pow(1+p.growth/100,Math.floor(i/12))*(.06+p.self/100);
 const second=p.mode==='manual'?p.manualTwo:account/factor(N,p.post);
 let need=0,system=0;const rows=[];
 for(let i=0;i<N;i++){
  const expense=p.expense*Math.pow(1+p.inflation/100,Math.floor(i/12));
  const income=second+((p.mode==='manual'||p.retire+i/12>=p.claim)?first:0);
  const disc=Math.pow(1+monthly(p.post),i+1);need+=expense/disc;system+=income/disc;
  const y=Math.floor(i/12);if(!rows[y])rows[y]={age:p.retire+y,expense:0,income:0};rows[y].expense+=expense;rows[y].income+=income;
 }
 const lump=p.mode==='manual'?p.lump*10000:0;system+=lump;
 const personal=fv(p.assets*10000,p.saving,n,p.return),gap=need-system-personal;
 const required=n?Math.max(0,(need-system-fv(p.assets*10000,0,n,p.return))/fv(0,1,n,p.return)):null;
 const targetCapital=Math.max(0,need-system);let target;
 if(fv(p.assets*10000,p.saving,n,0)>=targetCapital)target=0;
 else if(!n||(!p.assets&&!p.saving)||fv(p.assets*10000,p.saving,n,30)<targetCapital)target=null;
 else {let low=0,high=30;for(let i=0;i<70;i++){const mid=(low+high)/2;if(fv(p.assets*10000,p.saving,n,mid)<targetCapital)low=mid;else high=mid;}target=high;}
 return {need,system,personal,gap,required,target,first,second,account,rows,n,N,yrs,lump};
}
root.RetirementMath={calculate,fv,factor};if(typeof module!=='undefined')module.exports=root.RetirementMath;
if(typeof document==='undefined')return;
const $=id=>document.getElementById(id),num=n=>Math.round(n).toLocaleString('zh-TW'),money=n=>num(n)+' 元',wan=n=>(n/10000).toLocaleString('zh-TW',{maximumFractionDigits:1})+' 萬';
const form=$('retireForm');
// Text controls support full selection on iOS; retain numeric bounds explicitly.
const numericInputs=[...form.querySelectorAll('input[type=number]')];
for(const input of numericInputs){
 input.type='text';input.inputMode=Number(input.min)<0?'text':Number(input.step||1)<1?'decimal':'numeric';
 input.autocomplete='off';input.spellcheck=false;
 let revision=0;
 const selectAll=()=>{if(input.value)input.select()};
 input.addEventListener('focus',selectAll);
 input.addEventListener('click',selectAll);
 input.addEventListener('touchend',()=>{const before=revision;requestAnimationFrame(()=>{if(document.activeElement===input&&revision===before)selectAll()})});
 input.addEventListener('input',()=>{revision++});
}
function validateNumbers(){
 for(const input of numericInputs){
  const raw=input.value.trim(),value=Number(raw),min=Number(input.min),max=Number(input.max),step=Number(input.step||1);
  const valid=/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw)&&Number.isFinite(value)&&value>=min&&value<=max&&Math.abs((value-min)/step-Math.round((value-min)/step))<1e-6;
  input.setCustomValidity(valid?'':`請輸入 ${min}～${max}，以 ${step} 為間隔的數字。`);
 }
}
const defaults=[...form.querySelectorAll('input,select')].map(el=>[el,el.value]);
function update(){
 try{
 validateNumbers();
 if(!form.checkValidity())throw Error('請依欄位範圍填入數字，不能留白。');
 const p={};form.querySelectorAll('input,select').forEach(el=>p[el.id]=el.id==='mode'?el.value:Number(el.value));
 const r=calculate(p);$('error').textContent='';$('results').hidden=false;
 $('profile').textContent=`目前 ${p.age} 歲 · ${p.retire} 歲退休 · 規劃至 ${p.end} 歲 · 準備期 ${r.n/12} 年`;
 $('need').textContent=wan(r.need);$('gapLabel').textContent=r.gap>0?'尚需準備':'預估準備餘裕';$('gap').textContent=wan(Math.abs(r.gap));$('required').textContent=r.required===null?'已到退休時點':money(r.required);
 $('first').textContent=money(r.first)+'／月';$('second').textContent=money(r.second)+'／月';$('third').textContent=wan(r.personal);
 $('firstNote').textContent=p.mode==='manual'?'手動輸入，自退休時起計領':r.yrs<15?'預估年資未滿 15 年，未計入月領年金；請核對一次金或併計資格':`估計年資 ${r.yrs.toFixed(1)} 年，${p.claim} 歲開始領取`;
 $('secondNote').textContent=p.mode==='manual'?`手動輸入；另計一次金 ${wan(r.lump)}`:`專戶預估 ${wan(r.account)}，攤提至 ${p.end} 歲（規劃值）`;
 const entries=[['退休總需求',r.need],['制度退休金',r.system],['個人準備',r.personal],[r.gap>0?'退休缺口':'準備餘裕',Math.abs(r.gap)]];
 const max=Math.max(1,...entries.map(x=>x[1]));$('chart').replaceChildren();
 for(const [label,value]of entries){const row=document.createElement('div');const title=document.createElement('span');title.textContent=label;const track=document.createElement('div');const bar=document.createElement('i');bar.style.width=(value/max*100)+'%';track.append(bar);const val=document.createElement('b');val.textContent=wan(value);row.append(title,track,val);$('chart').append(row);}
 $('chart').setAttribute('aria-label',entries.map(([l,v])=>l+' '+wan(v)).join('；'));
 $('target').textContent=`每月額外準備 ${money(p.saving)}，使退休缺口為零的目標年報酬率：${r.target===null?'目前條件無法在 0～30% 搜尋範圍內達成':r.target.toFixed(2)+'%'}`;
 $('targetNote').textContent=r.n===0?'已到退休時點，沒有累積期間，請調整資產、支出或退休計畫。':'目標報酬率同時套用個人現有資產與未來每月投入；制度退休金假設保持不變。0% 表示不需正報酬即可達標，非實際預期收益。';
 $('assumptions').textContent=`退休首年月支出 ${money(p.expense)}；退休後通膨 ${p.inflation}%，退休前／後年報酬 ${p.return}%／${p.post}%。勞退專戶收益假設 ${p.fund}%；個人投入與勞退自提分開計算。`;
 $('rows').replaceChildren();for(const row of r.rows){const tr=document.createElement('tr');for(const v of [row.age+' 歲',money(row.expense),money(row.income),money(row.expense-row.income)]){const td=document.createElement('td');td.textContent=v;tr.append(td)}$('rows').append(tr)}
 }catch(e){$('error').textContent=e.message;$('results').hidden=true;}
}
form.addEventListener('submit',e=>{e.preventDefault();update()});form.addEventListener('input',update);form.addEventListener('change',update);form.addEventListener('reset',e=>{e.preventDefault();defaults.forEach(([el,v])=>el.value=v);update()});let closed=[];window.addEventListener('beforeprint',()=>{closed=[...document.querySelectorAll('details:not([open])')];closed.forEach(el=>el.open=true)});window.addEventListener('afterprint',()=>closed.forEach(el=>el.open=false));$('print').addEventListener('click',()=>window.print());update();
})(typeof window==='undefined'?globalThis:window);
