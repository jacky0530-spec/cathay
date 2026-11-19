/* 滿溢鍾心 重大傷病定期保險(外溢型) · 教育試算 v1.2
   費率依「費率 (8).pdf」第1頁標準年繳費率：新臺幣／每萬元保額。
   「年繳應繳保險費總額」須按給付種類分別計算：
   1. 滿期與祝壽：以保額對應之年繳應繳保費 × 原定完整繳費年期。
   2. 重大傷病／特定疾病／身故／完全失能：
      以事故發生／診斷日與原定繳費期屆滿日較早者為截點。
   網頁以「第 N 保單年度」輸入情境，按年繳方式假設該年度保費應繳；
   示範計入 min(N, 繳費期數) 期，實際日期與保費應繳情況應依保單核對。
*/
(() => {
  "use strict";
  const rates={
    M15:[479,482,485,488,494,500,507,514,521,528,535,542,549,556,563,570,577,584,591,598,605,612,619,626,633,635,653,675,697,722,745,770,795,820,849,877,908,945,985,1029,1071,1114,1165,1221,1284,1346,1407,1469,1533,1597,1672,1739,1800,1861,1920,1990],
    M20:[356,362,365,368,374,377,382,390,395,401,409,415,423,429,434,441,447,453,457,461,465,470,474,476,478,480,490,513,545,578,610,642,654,666,678,690,704,718,737,754,776,795,816,838,862,878,895,908,923,935,960,null,null,null,null,null],
    F15:[461,464,469,474,480,486,492,498,504,510,516,522,528,534,540,546,552,558,564,570,576,582,588,594,600,606,612,618,624,635,662,691,720,748,778,806,836,864,893,923,951,980,1010,1040,1069,1105,1159,1210,1266,1315,1353,1389,1422,1462,1522,1595],
    F20:[344,347,351,355,359,363,368,376,381,387,394,400,405,411,418,423,428,432,437,442,447,452,457,462,468,473,476,492,526,554,583,610,639,652,667,675,687,697,707,720,732,745,762,774,789,809,828,847,864,887,905,null,null,null,null,null]
  };
  const $=id=>document.getElementById(id);
  const number=n=>Math.round(n).toLocaleString("zh-TW");
  const money=n=>Number.isFinite(n)?number(n)+" 元":"—";
  const typedInt=(id)=>Number($(id).value);
  const card=(step,title,value,desc,kind="")=>{
    const el=document.createElement("div");
    el.className="heart-flow-item"+(kind?" is-"+kind:"");
    const top=document.createElement("span");top.className="heart-flow-step";top.textContent=step;
    const label=document.createElement("strong");label.textContent=title;
    const amount=document.createElement("b");amount.textContent=value;
    const hint=document.createElement("p");hint.textContent=desc;
    el.append(top,label,amount,hint);
    return el;
  };
  const round2=n=>Math.round(n*100)/100;
  const quote=(age,sex,term,amountWan,override)=> {
    if(!Number.isInteger(age)||age<0||age>55)throw new Error("投保年齡請輸入 0～55 歲的整數。");
    if(!["M","F"].includes(sex))throw new Error("請選擇性別。");
    if(![15,20].includes(term))throw new Error("繳費年期只能選擇 15 或 20 年。");
    if(term===20 && age>50)throw new Error("20 年期最高承保年齡為 50 歲，請改選 15 年期或調整年齡。");
    if(!Number.isFinite(amountWan)||amountWan<30||amountWan>500||!Number.isInteger(amountWan))
      throw new Error("保額請輸入 30～500 萬元的整數（每萬元一單位）。");
    const rate=rates[sex+term]?.[age];
    if(!Number.isFinite(rate))throw new Error("此條件沒有有效費率，請確認年齡及繳費年期。");
    if(override!==null && (!Number.isFinite(override)||override<=0))
      throw new Error("自訂年繳保費須為大於 0 的金額，或保持空白使用費率表。");
    const annual=override??rate*amountWan;
    const total=annual*term;
    const earlyYear=term+10;
    const finalYear=90-age;
    if(earlyYear>=finalYear)throw new Error("第一階段生存給付時間不得晚於保障屆滿日。");
    return {age,sex,term,amountWan,face:amountWan*10000,rate,annual,total,
      earlyYear,earlyAge:age+earlyYear,finalYear,first:total/2,last:total/2,
      fromOverride:override!==null,protectedTo:90};
  };
  const premiumSumForBenefit=(quote,kind,eventYear)=> {
    if(["maturity","longevity"].includes(kind)){
      // 滿期、祝壽以原定繳費期間算，不因先領年度或90歲而延長計算。
      return {years:quote.term,sum:quote.annual*quote.term,cutoff:"原定繳費期間屆滿"};
    }
    if(!["critical","chronic","specific","death"].includes(kind))
      throw new Error("未支援的給付種類。");
    if(!Number.isInteger(eventYear)||eventYear<1||eventYear>quote.finalYear)
      throw new Error("事故年度必須介於第 1 年及保障至 90 歲的保單年度之間。");
    // 每個保單年度年初繳交該期應繳年繳保費；事故發生於第 N 保單年度示範計入該年度。
    const years=Math.min(eventYear,quote.term);
    return {years,sum:quote.annual*years,
      cutoff:eventYear<=quote.term?"第 "+eventYear+" 保單年度之事故／初次診斷日":"原定繳費期間屆滿"};
  };
  const payout=(quote,kind,eventYear)=> {
    const basis=premiumSumForBenefit(quote,kind,eventYear);
    const threshold=basis.sum*1.05;
    if(kind==="critical")return eventYear===1?threshold:Math.max(quote.face,threshold);
    if(kind==="chronic")return eventYear===1?threshold:Math.max(quote.face*.2,threshold);
    if(kind==="specific")return eventYear===1?threshold:Math.max(quote.face,threshold);
    if(kind==="death")return quote.age+eventYear<16?null:Math.max(quote.face,threshold);
    throw new Error("未支援的情境");
  };
  // 提供純數值函式供自動化測試；不包含客戶資料。
  window.FullHeartMath=Object.freeze({quote,premiumSumForBenefit,payout,rates});
  function set(id,value){$(id).textContent=value;}
  function setError(error){
    const el=$("heartError");
    el.hidden=!error;
    el.textContent=error||"";
  }
  function update(){
    let q;
    try{
      const age=typedInt("heartAge");
      const term=typedInt("heartTerm");
      const amount=typedInt("heartFace");
      const raw=$("heartPremiumOverride").value.trim();
      if(!String($("heartAge").value).trim()||!String($("heartFace").value).trim())
        throw new Error("請輸入年齡及保險金額。");
      q=quote(age,$("heartSex").value,term,amount,raw===""?null:Number(raw));
    }catch(err){
      setError(err.message||"條件有誤");
      ["heartAnnual","heartTotal","heartEarly50","heartAge90","heartScenarioAmount"].forEach(id=>set(id,"—"));
      $("heartBenefitBasis").hidden=true;
      ["heartBenefitYears","heartBenefitPremiumSum","heartBenefit105","heartBenefitCutoff"].forEach(id=>set(id,"—"));
      set("heartRateStatus","輸入條件尚未成立，請修正紅色提示後再試算。");
      $("heartRateStatus").classList.add("warning");
      $("heartEventCards").replaceChildren();
      return;
    }
    setError("");
    const sexName=q.sex==="M"?"男性":"女性";
    const rateDetail="標準年繳費率："+sexName+"／"+q.age+" 歲／"+q.term+" 年期，每萬元保額 "+number(q.rate)+" 元 × "+q.amountWan+" 單位";
    set("heartRateDetail",rateDetail);
    set("heartRateStatus",q.fromOverride?"目前採手動輸入的年繳保費；請與正式建議書核對。":"目前使用附件標準年繳費率；未套用其他外溢保費折減。");
    $("heartRateStatus").classList.remove("warning");
    set("heartAnnual",money(q.annual));
    set("heartTotal",money(q.total));
    set("heartFirstYear",String(q.earlyYear));
    set("heartEarly50",money(q.first));
    set("heartAge90",money(q.last));
    set("heartInsight","第 "+q.term+" 保單年度末停止繳費，但不是立即領取滿期金；第 "+q.earlyYear+
      " 保單年度末（約 "+q.earlyAge+" 歲）且仍生存、契約有效，才先領 "+money(q.first)+
      "。其後保障可依條款延續至 90 歲。");
    set("heartStartAge",q.age+" 歲");
    set("heartPaidAge",(q.age+q.term)+" 歲");
    set("heartPaidLabel","第 "+q.term+" 年末");
    set("heartEarlyAge",q.earlyAge+" 歲");
    set("heartEarlyLabel","第 "+q.earlyYear+" 年末");
    set("heartPeriodPay","第 1～"+q.term+" 保單年度繳費");
    // Time-axis segment widths represent years, not insurance amounts.
    const totalYears=q.finalYear;
    $("heartTrackPaid").style.width=round2(q.term/totalYears*100)+"%";
    $("heartTrackWait").style.width=round2(10/totalYears*100)+"%";
    $("heartTrackProtect").style.width=round2((totalYears-q.earlyYear)/totalYears*100)+"%";
    const scenario=$("heartScenario").value;
    const isHealthy=scenario==="healthy";
    $("heartEventYearField").hidden=isHealthy;
    $("heartBenefitBasis").hidden=isHealthy;
    $("heartEventYear").max=String(q.finalYear);
    if(!isHealthy){
      const eventField=$("heartEventYear");
      const rawYear=eventField.value.trim();
      const current=Number(rawYear);
      // Editing an empty/partial year must not restore the old default on every keystroke.
      // Only clamp a completed out-of-range year if this field is not being edited.
      if(rawYear!=="" && (!Number.isInteger(current)||current<1||current>q.finalYear)
        && document.activeElement!==eventField){
        eventField.value=String(Math.min(q.finalYear,q.earlyYear+5));
      }
    }
    const out=$("heartEventCards");out.replaceChildren();
    let sum=0,notes="";
    if(isHealthy){
      set("heartStoryIcon","👨‍👩‍👧‍👦");
      set("heartStoryTag","情境 A · 無提前理賠事故");
      set("heartStoryTitle","健康生存至 90 歲");
      set("heartStoryDescription","先繳費、再等十年領第一階段滿期金，之後在保單持續有效且 90 歲仍生存時再領第二階段。");
      out.append(
        card("第 1～"+q.term+" 年","繳費期間","累計 "+money(q.total),"第 "+q.term+" 年末繳清，非領回日","done"),
        card("第 "+q.earlyYear+" 年末","第一階段生存給付",money(q.first),"滿期紀錄期間屆滿仍生存、保單有效","payout"),
        card("90 歲保單期滿","第二階段生存給付",money(q.last),"保險期間屆滿仍生存、契約有效","payout")
      );
      sum=q.first+q.last;
      set("heartScenarioAmountLabel","本情境兩階段生存給付示意合計");
      notes="兩階段各按年繳應繳保費總額的 50% 試算，前提是符合各階段生存及契約有效條件；不是年化報酬或保證投資收益。";
    } else{
      const year=typedInt("heartEventYear");
      const names={critical:"一般重大傷病",chronic:"慢性精神病重大傷病",specific:"四項特定心血管疾病",death:"身故／完全失能"};
      const icons={critical:"🏥",chronic:"🧠",specific:"❤️",death:"🛡️"};
      set("heartStoryIcon",icons[scenario]||"🏥");
      set("heartStoryTag","情境 · 第 "+year+" 年（約 "+(q.age+year)+" 歲）");
      set("heartStoryTitle","如果遇到"+(names[scenario]||"保障事件"));
      let amount;
      try{amount=payout(q,scenario,year);}
      catch(err){
        setError(err.message);out.replaceChildren();
        set("heartScenarioAmount","—");
        return;
      }
      const basis=premiumSumForBenefit(q,scenario,year);
      const afterEarly=year>q.earlyYear;
      const firstReceived=afterEarly?q.first:0;
      set("heartBenefitYears",String(basis.years));
      set("heartBenefitPremiumSum",money(basis.sum));
      set("heartBenefit105",money(basis.sum*1.05));
      set("heartBenefitCutoff",basis.cutoff+"（以第 "+year+" 年度試算）");
      const calcName=scenario==="chronic"?"保額的 20%／事故時應計總保費 1.05 倍擇高":
        scenario==="death"?"當年度保額／事故時應計總保費 1.05 倍擇高（簡化）":
        "保額／事故時應計總保費 1.05 倍擇高";
      if(scenario==="death"){
        set("heartStoryDescription","以教材所列身故／完全失能給付作簡化示意；未滿 16 歲不適用一般成人理賠公式，亦需核對當年度保險金額及條款。");
      }else{
        set("heartStoryDescription","依您提供的契約定義，以事故／初次診斷日與原定繳費期滿日較早者計算應計年繳保費；第 1 年與第 2 年起的保障比較規則不同。");
      }
      out.append(
        card("第 "+q.earlyYear+" 年末","是否先領生存金",afterEarly?money(q.first):"尚未領取",
          afterEarly?"假設當時保單有效且仍生存，已完成第一階段給付":"事件發生在第一階段生存給付之前",""+(afterEarly?"payout":"disabled")),
        card("第 "+year+" 年","本次事件理賠",amount===null?"需依條款":money(amount),
          amount===null?"未滿 16 歲之給付規則不同，不適用成人試算。":
          year===1?"第 1 年：年繳應繳保費總額 × 1.05":calcName,
          "done"),
        card("後續","契約效力", "依條款終止",
          "此情境假設已符合一次性保險金申領條件；90 歲生存給付不再列入","disabled")
      );
      sum=amount===null?null:firstReceived+amount;
      set("heartScenarioAmountLabel",amount===null?"本情境給付金額":"本情境已發生給付示意合計");
      notes="本情境事故發生於第 "+year+" 保單年度，年繳應繳保險費總額按 "+basis.years+" 期 × "+money(q.annual)+" ＝ "+money(basis.sum)+" 計算，並以事故／診斷日與原定繳費期屆滿日較早者為準。年度模擬假設該年保費已到期，實際計算須按保單日期核對。第 "+q.earlyYear+" 年末先領生存金需符合生存及契約有效條件；事故給付與先領生存金能否合併、給付扣抵、未滿16歲及契約終止等，仍以條款為準。";
    }
    set("heartScenarioAmount",sum===null?"請依條款核算":money(sum));
    set("heartScenarioNote",notes);
  }
  function reset(){
    $("heartAge").value="40";
    $("heartSex").value="M";
    $("heartTerm").value="20";
    $("heartFace").value="100";
    $("heartPremiumOverride").value="";
    $("heartScenario").value="healthy";
    $("heartEventYear").value="35";
    update();
  }
  const ids=["heartAge","heartSex","heartTerm","heartFace","heartPremiumOverride","heartScenario","heartEventYear"];
  for(const id of ids){
    $(id).addEventListener("input",update);
    $(id).addEventListener("change",update);
  }
  // iOS Safari does not consistently support selecting the contents of type=number.
  // These four fields are type=text with numeric keyboards; the first tap selects
  // the existing value, so typing 10 replaces "1" rather than creating "110".
  for(const id of ["heartAge","heartFace","heartPremiumOverride","heartEventYear"]){
    const input=$(id);
    let untouchedSinceFocus=false;
    const selectExisting=()=>{
      if(untouchedSinceFocus && input.value!=="")input.select();
    };
    input.addEventListener("focus",()=>{
      untouchedSinceFocus=true;
      selectExisting();
    });
    input.addEventListener("click",selectExisting);
    input.addEventListener("touchend",()=>{
      // On iOS the native tap may move the caret after the focus handler.
      if(typeof requestAnimationFrame==="function"){
        requestAnimationFrame(()=>{
          if(untouchedSinceFocus && document.activeElement===input)selectExisting();
        });
      }
    });
    input.addEventListener("input",()=>{untouchedSinceFocus=false;});
    input.addEventListener("blur",()=>{untouchedSinceFocus=false;});
  }
  $("heartReset").addEventListener("click",reset);
  update();
})();
