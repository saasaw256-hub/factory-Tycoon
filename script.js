(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const SAVE_KEY = "factoryTycoonSave_v1";
  const defaults = {
    cash:250, rawOre:0, ingots:0, rare:0, totalEarned:0, totalCollected:0, totalSold:0,
    smelter:1, press:0, packer:0, drill:1, level:1, sound:true, lastTick:Date.now()
  };
  let state = {...defaults};
  let toastTimer;
  let audioCtx = null;

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (saved && typeof saved === "object") state = {...defaults, ...saved};
    } catch (_) {}
    // Avoid excessive offline accumulation; award up to two hours.
    const elapsed = Math.min(7200, Math.max(0, (Date.now() - (state.lastTick || Date.now())) / 1000));
    if (elapsed > 5) {
      const ore = Math.floor((12 + (state.drill - 1) * 8) / 60 * elapsed);
      state.rawOre += ore;
      state.totalCollected += ore;
      const smelted = Math.min(state.rawOre, Math.floor((state.smelter * elapsed) / 10));
      state.rawOre -= smelted;
      state.ingots += smelted;
      const sold = state.packer > 0 ? Math.min(state.ingots, Math.floor(elapsed / 8) * state.packer) : 0;
      state.ingots -= sold;
      const value = sellValue() * sold;
      state.cash += value; state.totalEarned += value; state.totalSold += sold;
    }
    state.lastTick = Date.now();
  }
  function save() { state.lastTick = Date.now(); try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (_) {} }
  function money(n) { return "$" + Math.floor(n).toLocaleString("en-GB"); }
  function sellValue() { return 25 + state.press * 5; }
  function oreRate() { return 12 + (state.drill - 1) * 8; }
  function smeltRate() { return state.smelter * 6; }
  function revenueRate() { return state.packer ? smeltRate() * sellValue() : 0; }
  function toast(message) {
    $("toast").textContent = message; $("toast").classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => $("toast").classList.remove("show"), 2200);
  }
  function beep(freq=520, duration=.07) {
    if (!state.sound) return;
    try {
      audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
      osc.frequency.value = freq; osc.type = "sine"; gain.gain.value = .035;
      osc.connect(gain); gain.connect(audioCtx.destination); osc.start();
      gain.gain.exponentialRampToValueAtTime(.001, audioCtx.currentTime + duration);
      osc.stop(audioCtx.currentTime + duration);
    } catch (_) {}
  }
  function spend(cost) {
    if (state.cash < cost) { toast("Not enough cash for this investment."); beep(170); return false; }
    state.cash -= cost; return true;
  }
  function collect() {
    const amount = Math.max(1, Math.floor(oreRate() / 6));
    state.rawOre += amount; state.totalCollected += amount; beep(620);
    toast(`Collected ${amount} raw ore from the conveyor.`);
    render(); save();
  }
  function smelt(manual=false) {
    const amount = manual ? 10 : 1;
    if (state.rawOre < amount) { if (manual) toast("You need 10 raw ore to smelt."); return false; }
    state.rawOre -= amount; state.ingots += 1;
    if (manual) { beep(430); toast("10 raw ore refined into 1 iron ingot."); }
    return true;
  }
  function sell() {
    if (state.ingots < 1) { toast("No ingots available to sell."); return; }
    const quantity = state.ingots, earned = quantity * sellValue();
    state.ingots = 0; state.cash += earned; state.totalEarned += earned; state.totalSold += quantity;
    beep(760); toast(`Sold ${quantity} ingot${quantity===1?"":"s"} for ${money(earned)}.`);
    render(); save();
  }
  function buy(type) {
    const costs = {
      smelter: 150 * Math.pow(1.75, state.smelter - 1),
      press: state.press ? 350 * Math.pow(1.8, state.press - 1) : 500,
      packer: state.packer ? 850 * Math.pow(1.9, state.packer - 1) : 1200,
      drill: 100 * Math.pow(1.65, state.drill - 1)
    };
    const cost = Math.ceil(costs[type]);
    if (!spend(cost)) return;
    state[type] += 1; beep(840); toast(`${type[0].toUpperCase()+type.slice(1)} upgraded!`);
    render(); save();
  }
  function goalData() {
    return [
      {name:"First shipment",desc:"Sell your first iron ingot",done:state.totalSold>=1,reward:"$100"},
      {name:"Expand production",desc:"Upgrade your smelter to level 2",done:state.smelter>=2,reward:"$200"},
      {name:"Industrial investor",desc:"Reach $1,000 lifetime earnings",done:state.totalEarned>=1000,reward:"$300"}
    ];
  }
  function updateLevel() {
    const xp = state.totalCollected + state.totalSold * 10 + (state.smelter - 1) * 30;
    state.level = 1 + Math.floor(xp / 150);
    return xp % 150;
  }
  function render() {
    $("cash").textContent=money(state.cash); $("rawOre").textContent=state.rawOre.toLocaleString();
    $("ingots").textContent=state.ingots.toLocaleString();
    $("inventoryOre").textContent=state.rawOre.toLocaleString();
    $("inventoryIngots").textContent=state.ingots.toLocaleString();
    $("inventoryRare").textContent=state.rare.toLocaleString();
    $("level").textContent=state.level;
    $("levelProgress").style.width=updateLevel()/150*100+"%";
    $("oreRate").textContent=oreRate(); $("ingotRate").textContent=smeltRate();
    $("revenueRate").textContent=money(revenueRate());
    $("smelterCount").textContent=state.smelter; $("pressCount").textContent=state.press; $("packerCount").textContent=state.packer;
    $("totalEarned").textContent=money(state.totalEarned); $("totalCollected").textContent=state.totalCollected.toLocaleString(); $("totalSold").textContent=state.totalSold.toLocaleString();
    $("smelterLevel").textContent="LEVEL "+state.smelter;
    $("pressLevel").textContent=state.press ? "LEVEL "+state.press : "LOCKED";
    $("packerLevel").textContent=state.packer ? "LEVEL "+state.packer : "LOCKED";
    $("drillLevel").textContent="LEVEL "+state.drill;
    $("smelterSpeed").textContent=smeltRate()+" / min";
    $("pressBonus").textContent="+"+(state.press*20)+"%";
    $("packerSpeed").textContent=state.packer ? state.packer+" / 8 sec" : "Inactive";
    $("drillSpeed").textContent=oreRate()+" / min";
    const prices={smelter:Math.ceil(150*Math.pow(1.75,state.smelter-1)),press:Math.ceil(state.press?350*Math.pow(1.8,state.press-1):500),packer:Math.ceil(state.packer?850*Math.pow(1.9,state.packer-1):1200),drill:Math.ceil(100*Math.pow(1.65,state.drill-1))};
    const labels={smelter:"Upgrade",press:state.press?"Upgrade":"Unlock",packer:state.packer?"Upgrade":"Unlock",drill:"Upgrade"};
    ["smelter","press","packer","drill"].forEach(k=>{const b=$("buy"+k[0].toUpperCase()+k.slice(1));b.textContent=labels[k]+" · "+money(prices[k]);b.disabled=state.cash<prices[k];});
    $("smeltBtn").disabled=state.rawOre<10; $("sellBtn").disabled=state.ingots<1; $("sellAllBtn").disabled=state.ingots<1;
    const goals=goalData(); $("goalCount").textContent=goals.filter(g=>g.done).length+"/3";
    $("goalsList").innerHTML=goals.map(g=>`<div class="goal ${g.done?"done":""}"><span class="goal-check">${g.done?"✓":""}</span><div><b>${g.name}</b><small>${g.desc}</small></div><span class="goal-reward">${g.done?"DONE":g.reward}</span></div>`).join("");
  }
  function tick() {
    const ore = Math.floor(oreRate()/60);
    // Fractional production is accumulated using the production clock below.
    tick.oreRemainder += oreRate()/60;
    const newOre=Math.floor(tick.oreRemainder); tick.oreRemainder-=newOre;
    if(newOre){state.rawOre+=newOre;state.totalCollected+=newOre;}
    tick.smeltRemainder += smeltRate()/60;
    let produced=Math.floor(tick.smeltRemainder); tick.smeltRemainder-=produced;
    produced=Math.min(produced,state.rawOre); state.rawOre-=produced; state.ingots+=produced;
    if(state.packer>0){tick.packRemainder+=state.packer/8;let sold=Math.floor(tick.packRemainder);tick.packRemainder-=sold;sold=Math.min(sold,state.ingots);state.ingots-=sold;let earned=sold*sellValue();state.cash+=earned;state.totalEarned+=earned;state.totalSold+=sold;}
    if (Math.random()<.018) state.rare += 1;
    render();
  }
  tick.oreRemainder=0; tick.smeltRemainder=0; tick.packRemainder=0;
  $("collectBtn").addEventListener("click",collect);
  $("smeltBtn").addEventListener("click",()=>{if(smelt(true)){render();save();}});
  $("sellBtn").addEventListener("click",sell); $("sellAllBtn").addEventListener("click",sell);
  $("buySmelter").addEventListener("click",()=>buy("smelter"));
  $("buyPress").addEventListener("click",()=>buy("press"));
  $("buyPacker").addEventListener("click",()=>buy("packer"));
  $("buyDrill").addEventListener("click",()=>buy("drill"));
  $("soundBtn").addEventListener("click",()=>{state.sound=!state.sound;$("soundBtn").textContent=state.sound?"♫":"♪";toast(state.sound?"Sound enabled":"Sound muted");save();});
  $("resetBtn").addEventListener("click",()=>{if(confirm("Reset your entire factory and erase this device's saved progress?")){localStorage.removeItem(SAVE_KEY);state={...defaults,lastTick:Date.now()};tick.oreRemainder=tick.smeltRemainder=tick.packRemainder=0;render();toast("Factory reset. A new empire begins!");}});
  document.addEventListener("keydown",e=>{if(e.code==="Space"&&!["BUTTON","INPUT","TEXTAREA"].includes(document.activeElement.tagName)){e.preventDefault();collect();}});
  for(let i=0;i<3;i++){const el=document.createElement("span");el.className="ore-piece";el.textContent="◆";$("oreTrack").appendChild(el);}
  load(); render();
  if(!state.sound)$("soundBtn").textContent="♪";
  setInterval(tick,1000); setInterval(save,5000);
  window.addEventListener("beforeunload",save);
  if(state.totalCollected>0) setTimeout(()=>toast("Welcome back! Your factory has been running."),500);
})();