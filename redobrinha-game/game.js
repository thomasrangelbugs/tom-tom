const C=document.querySelector('#game'),X=C.getContext('2d'),W=C.width,H=C.height;
const ui={
  start:document.querySelector('#start'),result:document.querySelector('#result'),gameover:document.querySelector('#gameover'),
  score:document.querySelector('#scoreCard'),over:document.querySelector('#overCard'),title:document.querySelector('#resultTitle'),
  cont:document.querySelector('#continue'),menuFox:document.querySelector('#menuFox'),resultFox:document.querySelector('#resultFox'),
  volMusic:document.querySelector('#volMusic'),volSfx:document.querySelector('#volSfx')
};
const keys={left:false,right:false,jump:false,run:false,down:false};
let running=false,level=0,world,player,camera=0,last=0,audio,shake=0,bgm,muted=false;
const BGM_TRACKS=['assets/trilha.mp3','assets/trilha2.mp3'];
let bgmTrack=Math.random()<.5?0:1;
let lives=3,bestScore=0,saveData=null,menuAnim=0,waveAnim=0;
let aiMode=false,aiStuck=0,aiLastX=0,aiJumpCd=0,aiBackoff=0,aiPatience=0;
const isTouchDevice=matchMedia('(pointer:coarse)').matches||matchMedia('(max-width:900px)').matches||('ontouchstart' in window);
if(isTouchDevice)document.body.classList.add('touch-device');
const fsBtn=document.querySelector('#fs');
const touchRoot=document.querySelector('#touch');
if(touchRoot)touchRoot.hidden=false;

function isFullscreen(){
  return !!(document.fullscreenElement||document.webkitFullscreenElement||document.msFullscreenElement);
}
function syncFsUi(){
  const on=isFullscreen()||document.body.classList.contains('is-fs');
  document.body.classList.toggle('is-fs',on);
  if(fsBtn){fsBtn.classList.toggle('active',on);fsBtn.textContent=on?'⛶':'⛶';fsBtn.title=on?'Sair da tela cheia (F)':'Tela cheia (F)'}
}
async function enterFullscreen(){
  document.body.classList.add('is-fs');
  syncFsUi();
  const el=document.documentElement;
  try{
    if(!isFullscreen()){
      await (el.requestFullscreen?.()||el.webkitRequestFullscreen?.()||el.msRequestFullscreen?.());
    }
  }catch{}
  try{await screen.orientation?.lock?.('landscape')}catch{}
  syncFsUi();
}
async function exitFullscreen(){
  try{
    if(isFullscreen())await (document.exitFullscreen?.()||document.webkitExitFullscreen?.()||document.msExitFullscreen?.());
  }catch{}
  document.body.classList.remove('is-fs');
  syncFsUi();
}
async function toggleFullscreen(){
  if(isFullscreen()||document.body.classList.contains('is-fs'))await exitFullscreen();
  else await enterFullscreen();
}
function setPlaying(on){
  document.body.classList.toggle('playing',!!on);
}

const SAVE_KEY='redobrinha_save_v2';
const vols={music:.42,sfx:.55};

function loadSeries(folder,n){return Array.from({length:n},(_,i)=>{const img=new Image();img.src=`assets/sprites/${folder}/${i}.png`;return img})}
const SPR={
  idleFront:loadSeries('idle_front',5),
  run:loadSeries('run',8),
  walk:loadSeries('walk',8),
  wave:loadSeries('wave',4),
  jump:loadSeries('jump',5),
  emotion:loadSeries('emotion',8),
  magic:loadSeries('magic',6),
  inspect:loadSeries('inspect',6)
};
const brandLogo=new Image();brandLogo.src='assets/redobrai-logo.png';
const brandCorp=new Image();brandCorp.src='assets/redobrai-corp-logo.png';
const SPRITE_H=100,SPRITE_H_BIG=130,CROUCH_H=82,CROUCH_H_BIG=108;
const IDLE_POOL=['pocket','think','look','wave','sit','surprise','magic'];

function applyHeight(p,crouch){
  const want=p.big?(crouch?CROUCH_H_BIG:SPRITE_H_BIG):(crouch?CROUCH_H:SPRITE_H);
  if(p.h===want&&!!p.crouch===!!crouch)return;
  const feet=p.y+p.h;
  p.crouch=!!crouch;
  p.h=want;
  p.w=crouch?(p.big?72:66):(p.big?70:56);
  p.y=feet-p.h;
}

const themes=[
 {season:'Verão',sky:['#42bce8','#d9f8ff'],ground:'#35844f',soil:'#67492d',accent:'#ffe47c',leaf:'#7bc96f',challenge:'calor'},
 {season:'Outono',sky:['#e8895c','#ffd6a0'],ground:'#9b5a2e',soil:'#583522',accent:'#ffbd5e',leaf:'#e07a3a',challenge:'folhas'},
 {season:'Inverno',sky:['#6e91aa','#eaf8ff'],ground:'#e9f7f8',soil:'#637b87',accent:'#a8f3ff',leaf:'#cde8f5',challenge:'gelo'},
 {season:'Primavera',sky:['#6bc5b6','#f6d3e6'],ground:'#49a557',soil:'#73503b',accent:'#ffc1dc',leaf:'#ff8eb8',challenge:'vento'}
];
const dayParts=[
  {id:'madrugada',label:'Madrugada',night:true,skyMul:['#071225','#1a2740']},
  {id:'manha',label:'Manhã',night:false,skyMul:null},
  {id:'dia',label:'Dia',night:false,skyMul:null},
  {id:'tarde',label:'Tarde',night:false,skyMul:['#4aa3c7','#f2c48a']},
  {id:'entardecer',label:'Entardecer',night:false,skyMul:['#c45d3a','#f5b56a']},
  {id:'noite',label:'Noite',night:true,skyMul:['#07152d','#182f4d']}
];
const weathers=['Limpo','Nublado','Garoa','Chuva','Neve','Ventania'];

function rng(seed){return()=>(((seed=Math.imul(seed^seed>>>15,1|seed),seed^=seed+Math.imul(seed^seed>>>7,61|seed))^seed>>>14)>>>0)/4294967296}
function newWorldSeed(extra=0){
  const a=(Date.now()^((performance.now()*1000)|0)^extra)&0xffffffff;
  const b=((Math.random()*0xffffffff)|0);
  return (a^b^(level*99991)^(lives*131)^((Math.random()*0xffffff)|0))>>>0;
}
function pickClimate(R){
  const base={...themes[Math.floor(R()*themes.length)]};
  const part=dayParts[Math.floor(R()*dayParts.length)];
  let pool;
  if(base.season==='Inverno')pool=['Limpo','Nublado','Neve','Neve','Garoa','Chuva','Ventania'];
  else if(base.season==='Verão')pool=['Limpo','Limpo','Nublado','Garoa','Chuva','Ventania'];
  else if(base.season==='Outono')pool=['Limpo','Nublado','Garoa','Chuva','Ventania','Nublado'];
  else pool=['Limpo','Nublado','Garoa','Chuva','Ventania','Limpo'];
  const weather=pool[Math.floor(R()*pool.length)];
  const challenges=['calor','folhas','gelo','vento','calmaria'];
  const challenge=R()<.58?base.challenge:challenges[Math.floor(R()*challenges.length)];
  let wind=0;
  if(weather==='Ventania'||challenge==='vento')wind=(R()<.5?-1:1)*(1.3+R()*1.1);
  else if(challenge==='gelo')wind=R()<.5?(R()<.5?-1:1)*(0.4+R()*0.5):0;
  else if(weather==='Chuva'||weather==='Garoa')wind=(R()<.5?-1:1)*(0.3+R()*0.7);
  else wind=R()<.38?(R()<.5?-1:1)*(0.4+R()*0.8):0;
  const t={
    ...base,challenge,
    dayPart:part.label,dayPartId:part.id,night:part.night,weather,wind,
    ice:challenge==='gelo'||(base.season==='Inverno'&&weather==='Neve'&&R()<.55),
    heat:challenge==='calor'||(base.season==='Verão'&&(part.id==='tarde'||part.id==='dia')&&R()<.45),
    leafStorm:challenge==='folhas'||(base.season==='Outono'&&R()<.4),
    skyOverride:part.skyMul?part.skyMul.slice():null
  };
  if(weather==='Nublado')t.skyOverride=t.skyOverride||[t.sky[0],'#9bb6c5'];
  return t;
}

function loadSave(){
  try{saveData=JSON.parse(localStorage.getItem(SAVE_KEY)||'null')}catch{saveData=null}
  if(saveData){ui.cont.classList.remove('hidden');bestScore=saveData.best||0}
  const v=JSON.parse(localStorage.getItem('redobrinha_vols')||'null');
  if(v){vols.music=v.music??vols.music;vols.sfx=v.sfx??vols.sfx}
  ui.volMusic.value=Math.round(vols.music*100);ui.volSfx.value=Math.round(vols.sfx*100);
}
function persistVols(){localStorage.setItem('redobrinha_vols',JSON.stringify(vols))}
function saveProgress(extra={}){
  if(aiMode)return; // demo da IA não sobrescreve o save do jogador
  const payload={
    level,lives,score:world?.score||0,best:Math.max(bestScore,world?.score||0),
    checkpoint:player?.checkpoint||null,worldSeed:world?.worldSeed??null,updated:Date.now(),...extra
  };
  bestScore=Math.max(bestScore,payload.best);
  localStorage.setItem(SAVE_KEY,JSON.stringify(payload));
  saveData=payload;ui.cont.classList.remove('hidden');
}

function ensureAudio(){
  audio??=new(window.AudioContext||window.webkitAudioContext)();
  if(audio.state==='suspended')audio.resume();
  if(!bgm){
    bgm=new Audio(BGM_TRACKS[bgmTrack]);
    bgm.loop=false;
    bgm.preload='auto';
    bgm.addEventListener('ended',()=>{
      bgmTrack=(bgmTrack+1)%BGM_TRACKS.length;
      bgm.src=BGM_TRACKS[bgmTrack];
      bgm.volume=muted?0:vols.music;
      if(running)bgm.play().catch(()=>{});
    });
  }
  bgm.volume=muted?0:vols.music;
}
const sfxBank={};
function sfx(name){
  if(muted||vols.sfx<=0)return;
  ensureAudio();
  try{
    if(!sfxBank[name]){const a=new Audio(`assets/sfx/${name}.wav`);a.preload='auto';sfxBank[name]=a}
    const a=sfxBank[name].cloneNode();a.volume=vols.sfx;a.play().catch(()=>{});
  }catch{}
}
function setMute(on){
  muted=!!on;const btn=document.querySelector('#mute');
  if(btn){btn.classList.toggle('muted',muted);btn.textContent=muted?'×':'♪'}
  if(bgm)bgm.volume=muted?0:vols.music;
}
function music(type){
  ensureAudio();bgm.volume=muted?0:vols.music;
  if(type==='play'){
    if(bgm.paused){
      bgm.src=BGM_TRACKS[bgmTrack];
      try{bgm.currentTime=0}catch{}
    }
    bgm.play().catch(()=>{});
  }
  else if(type==='victory'){bgm.volume=muted?0:vols.music*.4;sfx('victory')}
  else if(type==='stop'){
    if(bgm&&!bgm.paused)bgm.pause();
    // próxima partida começa na outra trilha
    bgmTrack=(bgmTrack+1)%BGM_TRACKS.length;
  }
}

function makeLevel(fromCheckpoint){
  // Seed novo a cada partida/fase; só reaproveita no checkpoint da mesma run
  const seed=(fromCheckpoint?.worldSeed!=null)?(fromCheckpoint.worldSeed>>>0):newWorldSeed(level*7919+Math.floor(Math.random()*1e9));
  let R=rng(seed^((level+1)*13007));
  const t=pickClimate(R);

  let platforms=[],coins=[],enemies=[],power=[],decor=[],clouds=[],checkpoints=[],buildings=[],blocks=[],crates=[];
  let x=0,y=590;platforms.push({x:0,y,w:700,h:160,ice:false});x=590;
  for(let i=0;i<26;i++){
    let gap=50+R()*80,w=185+R()*270;
    x+=gap;y=Math.max(350,Math.min(610,y+(R()-.5)*155));
    let icy=t.ice&&R()<.7;
    platforms.push({x,y,w,h:H-y+60,ice:icy});
    let n=1+Math.floor(w/105);
    for(let k=0;k<n;k++)coins.push({x:x+55+k*85,y:y-65-Math.sin(k*Math.PI/Math.max(1,n-1))*55,t:0,got:false,pulse:R()*6});

    // Enemy variety
    if(w>220&&R()<.62){
      const kinds=['bug','flyer','spike','hopper','glitch'];
      const kind=kinds[Math.floor(R()*kinds.length)];
      if(kind==='bug')enemies.push({type:'bug',x:x+w*.55,y:y-37,w:48,h:37,v:R()<.5?-52:52,alive:true,wobble:R()*10,baseY:y-37});
      else if(kind==='flyer')enemies.push({type:'flyer',x:x+w*.4,y:y-140-R()*60,w:44,h:34,v:R()<.5?-70:70,alive:true,wobble:R()*10,baseY:y-140-R()*40,amp:28+R()*24});
      else if(kind==='spike')enemies.push({type:'spike',x:x+w*.5,y:y-40,w:46,h:40,v:R()<.5?-38:38,alive:true,wobble:R()*10,baseY:y-40});
      else if(kind==='hopper')enemies.push({type:'hopper',x:x+w*.45,y:y-42,w:44,h:40,v:R()<.5?-30:30,vy:0,alive:true,wobble:R()*10,baseY:y-42,hop:R()*1.4});
      else enemies.push({type:'glitch',x:x+w*.5,y:y-38,w:42,h:36,v:R()<.5?-80:80,alive:true,wobble:R()*10,baseY:y-38,blink:0,visible:true});
    }

    // Breakable / bonus blocks in the air
    if(R()<.55&&w>200){
      const bx=x+60+R()*(w-140), by=y-130-R()*70, count=1+Math.floor(R()*3);
      for(let k=0;k<count;k++){
        const kind=R()<.35?'bonus':R()<.75?'brick':'crate';
        blocks.push({x:bx+k*46,y:by,w:42,h:42,type:kind,alive:true,bump:0,used:false});
      }
    }
    // Solid floating crate platforms
    if(R()<.28){
      const cx=x+40+R()*(w-100), cy=y-90-R()*50;
      crates.push({x:cx,y:cy,w:70+R()*40,h:22});
    }
    // Pipe decor / platform
    if(R()<.22){
      const px=x+30+R()*(w-90), ph=50+R()*70;
      decor.push({type:'pipe',x:px,y,h:ph,w:52});
      platforms.push({x:px,y:y-ph,w:52,h:10,ice:false,soft:true});
    }

    if(i===5||i===15)power.push({x:x+w*.3,y:y-36,got:false,t:R()*4});
    if(i===8||i===18)checkpoints.push({x:x+w*.5,y,got:false,id:`L${level}_C${i}`});
    for(let g=0;g<Math.floor(w/28);g++)if(R()<.7)decor.push({type:'grass',x:x+12+g*28+R()*10,y,h:10+R()*16,phase:R()*6,side:R()<.5?-1:1});
    if(R()<.4)decor.push({type:'bush',x:x+40+R()*(w-80),y,s:.7+R()*.6,phase:R()*5});
    if(R()<.25)decor.push({type:'rock',x:x+30+R()*(w-60),y,s:.5+R()*.7});
    if(R()<.32)decor.push({type:'tree',x:x+50+R()*(w-100),y,s:.75+R()*.55,phase:R()*4});
    if(R()<.2)decor.push({type:'flower',x:x+20+R()*(w-40),y,phase:R()*5,col:t.accent});
    if(R()<.18)buildings.push({x:x+R()*w*.4,y,h:90+R()*120,w:40+R()*50,layer:0});
    x+=w;
  }
  let finish=x+80;platforms.push({x,y:560,w:650,h:200,ice:false});
  for(let i=0;i<9;i++)clouds.push({x:R()*2600,y:50+R()*200,w:90+R()*150,spd:.12+R()*.4,a:.16+R()*.25,layer:1+Math.floor(R()*2)});
  for(let i=0;i<6;i++)buildings.push({x:200+i*420+R()*80,y:620,h:140+R()*160,w:55+R()*70,layer:1});

  const startX=fromCheckpoint?.x||100,startY=fromCheckpoint?.y||430;
  return{R,t,worldSeed:seed,platforms,coins,enemies,power,decor,clouds,buildings,blocks,crates,checkpoints,finish,length:x+680,
    particles:[],fx:[],time:110+level*5,start:performance.now(),score:fromCheckpoint?.score||0,coinsGot:fromCheckpoint?.coinsGot||0,state:'play',portalPulse:0,startX,startY};
}

function makePlayer(spawn){
  return{
    x:spawn?.x??100,y:spawn?.y??430,w:56,h:SPRITE_H,vx:0,vy:0,on:false,big:false,inv:0,
    frame:0,face:1,squash:1,landFlash:0,wasOn:false,lastStep:0,idleTime:0,anim:'idle',
    think:false,checkpoint:spawn?.checkpoint||null,hurtFlash:0,poseT:0,jumpsLeft:2,
    crouch:false,idleMode:'pocket',idleNext:2.2+Math.random()*1.5
  };
}

function startLevel(opts={}){
  if(opts.ai!=null)aiMode=!!opts.ai;
  const cp=opts.checkpoint||null;
  world=makeLevel(cp);player=makePlayer(cp?{x:cp.x,y:cp.y-SPRITE_H,checkpoint:cp,score:cp.score,coinsGot:cp.coinsGot}:null);
  if(opts.resetLives)lives=3;
  if(opts.keepScore&&saveData&&!aiMode)world.score=saveData.score||0;
  camera=Math.max(0,player.x-W*.36);running=true;shake=0;
  aiStuck=0;aiLastX=player.x;aiJumpCd=0;aiBackoff=0;aiPatience=0;
  keys.left=keys.right=keys.jump=keys.run=keys.down=false;
  ui.start.classList.add('hidden');ui.result.classList.add('hidden');ui.gameover.classList.add('hidden');
  setPlaying(true);
  document.body.classList.toggle('ai-playing',aiMode);
  if((isTouchDevice||opts.forceFs)&&!aiMode)enterFullscreen();
  music('play');saveProgress({checkpoint:player.checkpoint});
}

function stopAiToMenu(){
  aiMode=false;running=false;setPlaying(false);
  document.body.classList.remove('ai-playing');
  keys.left=keys.right=keys.jump=keys.run=keys.down=false;
  ui.result.classList.add('hidden');ui.gameover.classList.add('hidden');
  ui.start.classList.remove('hidden');music('stop');
}

/** Piloto automático cuidadoso: anda com calma, respeita inimigos/buracos e morre como o jogador */
function aiThink(dt){
  const p=player;
  aiJumpCd=Math.max(0,aiJumpCd-dt);
  aiBackoff=Math.max(0,aiBackoff-dt);
  aiPatience=Math.max(0,aiPatience-dt);

  keys.left=false;keys.right=false;keys.run=false;keys.jump=false;keys.down=false;

  // Depois de tomar dano, espera a invulnerabilidade e não avança loucamente
  if(p.inv>0.35){
    keys.right=false;
    if(p.on&&aiJumpCd<=0&&Math.random()<dt*2){/* quiet */}
    return;
  }

  const feetX=p.x+p.w*.55, feetY=p.y+p.h;
  const solidAt=(x,yTol=22)=>world.platforms.some(b=>x>b.x+6&&x<b.x+b.w-6&&Math.abs(b.y-feetY)<yTol)
    ||world.crates.some(c=>x>c.x+4&&x<c.x+c.w-4&&Math.abs(c.y-feetY)<yTol);

  const gapClose=!solidAt(feetX+48,18);
  const gapMid=!solidAt(feetX+110,26);
  const landOK=solidAt(feetX+150,40)||solidAt(feetX+190,50);
  const pitAhead=gapClose&&gapMid;

  // Inimigos relevantes à frente / perto
  let danger=null, stompTarget=null, flyerOver=null;
  for(const e of world.enemies){
    if(!e.alive||(e.type==='glitch'&&!e.visible))continue;
    const dx=e.x-(p.x+p.w*.5);
    const dy=(e.y+e.h*.5)-(p.y+p.h*.5);
    if(dx<-40||dx>220)continue;
    if(Math.abs(dy)>110)continue;
    if(e.type==='flyer'&&e.y+e.h<p.y+20&&dx>10&&dx<160){flyerOver=e;continue}
    if(e.type==='spike'){
      if(dx<150&&Math.abs(dy)<70)danger=e;
    }else if(dx>8&&dx<130&&Math.abs(dy)<55){
      // só considera stomp se estiver caindo / saltable
      if(dx>35&&dx<95)stompTarget=e;
      else if(dx<=35)danger=e;
    }else if(dx<150&&Math.abs(dy)<60){
      danger=danger||e;
    }
  }

  // Coleta só se for quase no caminho e sem ameaça
  const safeLoot=!danger&&!pitAhead;
  const coin=safeLoot&&world.coins.find(c=>!c.got&&c.x>p.x&&c.x<p.x+100&&c.y<p.y+30&&c.y>p.y-90);
  const pow=safeLoot&&world.power.find(m=>!m.got&&m.x>p.x&&m.x<p.x+110&&Math.abs(m.y-(p.y+p.h/2))<70);

  if(Math.abs(p.x-aiLastX)<6)aiStuck+=dt; else aiStuck=Math.max(0,aiStuck-dt*1.5);
  aiLastX=p.x;

  // Direção padrão: avançar com calma
  let goRight=true, goLeft=false, wantRun=false, wantJump=false;

  if(aiBackoff>0){
    goRight=false;goLeft=true;wantRun=false;
  }

  // Spike / perigo próximo: recuar ou esperar, não spammar pulo
  if(danger){
    const dx=danger.x-(p.x+p.w*.5);
    if(danger.type==='spike'||dx<55){
      // espera passar ou pula por cima com um único pulo bem timed
      if(p.on&&dx>70&&dx<120&&aiJumpCd<=0&&solidAt(danger.x+60,35)){
        wantJump=true;wantRun=true;goRight=true;goLeft=false;
      }else if(dx<80){
        goRight=false;goLeft=true;aiBackoff=.35;
      }else{
        goRight=false; // espera
        aiPatience=.2;
      }
    }else if(stompTarget&&p.on&&aiJumpCd<=0){
      // prepara stomp: anda até a distância e pula uma vez
      const sdx=stompTarget.x-(p.x+p.w);
      if(sdx>40){goRight=true;wantRun=false}
      else if(sdx>12){wantJump=true;goRight=true}
      else{goLeft=true;goRight=false;aiBackoff=.25}
    }
  }

  // Buraco: só pula se houver pouso previsível
  if(!danger&&p.on&&pitAhead){
    if(landOK&&aiJumpCd<=0){wantJump=true;wantRun=true;goRight=true}
    else{goRight=false;goLeft=true;aiBackoff=.4} // não se mata no void
  }

  // Loot seguro
  if(safeLoot&&p.on&&aiJumpCd<=0){
    if(coin&&coin.y<p.y-25)wantJump=true;
    if(pow&&pow.y<p.y+20)wantJump=true;
  }

  // Stuck: um pulo, sem spam
  if(aiStuck>.7&&p.on&&aiJumpCd<=0){
    wantJump=true;wantRun=true;aiStuck=0;
  }

  // No ar: duplo só para salvar de precipício ou inimigo, nunca automaticamente
  if(!p.on&&p.jumpsLeft>0&&aiJumpCd<=0){
    const stillPit=!solidAt(feetX+70,80)&&!solidAt(feetX+120,100);
    if(stillPit&&p.vy>40)wantJump=true;
    else if(danger&&danger.x>p.x&&danger.x<p.x+90&&p.vy>0)wantJump=true;
  }

  // Velocidade: correr só em trecho limpo
  if(goRight&&!danger&&!pitAhead&&!gapClose)wantRun=true;
  if(flyerOver&&flyerOver.x-p.x<90){wantRun=false;goRight=true} // passa por baixo andando

  if(aiPatience>0){goRight=false;goLeft=false;wantRun=false}

  keys.right=goRight;keys.left=goLeft;keys.run=wantRun;
  if(wantJump&&aiJumpCd<=0){
    keys.jump=true;
    aiJumpCd=p.on?.42:.55; // cooldown pra não gastar o duplo no mesmo frame
  }
}

function rect(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y}
function burst(x,y,n,cols,spd=180){
  for(let i=0;i<n;i++){let a=Math.random()*Math.PI*2,s=40+Math.random()*spd;
    world.fx.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-60,life:.35+Math.random()*.45,max:.8,r:2+Math.random()*4,c:cols[i%cols.length],g:420})}
}
function dust(x,y,dir=1){
  for(let i=0;i<5;i++)world.fx.push({x:x+(Math.random()-.5)*18,y,vx:(Math.random()*-40-20)*dir,vy:-20-Math.random()*50,life:.25+Math.random()*.35,max:.5,r:3+Math.random()*5,c:'#c8b48a88',g:200});
}

function update(dt){
  if(!running||world.state!=='play')return;
  if(aiMode)aiThink(dt);
  let p=player,t=world.t;
  const wantCrouch=!!keys.down&&p.on&&!keys.jump;
  applyHeight(p,wantCrouch);
  const wantSprint=keys.run&&!p.crouch;
  const accel=p.crouch?900:(wantSprint?2100:1600);
  const maxSp=p.crouch?140:(wantSprint?460:340);
  const ice=p.on&&world.platforms.some(b=>b.ice&&p.x+p.w>b.x&&p.x<b.x+b.w&&Math.abs(p.y+p.h-b.y)<6);
  const friction=ice?Math.pow(.25,dt):Math.pow(.0009,dt);
  const windForce=(t.wind||0)*(t.challenge==='vento'?38:22);

  p.vx+=(keys.right-keys.left)*accel*dt;
  if(!keys.left&&!keys.right)p.vx*=friction;
  p.vx=Math.max(-maxSp,Math.min(maxSp,p.vx+windForce*dt));
  if(t.heat&&Math.abs(p.vx)>20)p.vx*=Math.pow(.92,dt); // sticky summer sand feel lightly

  if(p.on)p.jumpsLeft=2;
  if(keys.jump&&p.jumpsLeft>0){
    const midAir=!p.on;
    applyHeight(p,false);
    p.jumpsLeft--;
    // Pulo do chão um pouco mais alto; duplo um pouco mais fraco, mas ainda decisivo
    p.vy=midAir?(wantSprint?-700:-660):(wantSprint?-800:-740);
    p.on=false;p.squash=.65;p.anim=midAir?'jumpUp':'jump';
    sfx('jump');
    if(midAir){
      burst(p.x+p.w/2,p.y+p.h*.7,8,['#4ff5b0','#dfffee','#a8f3ff'],160);
      dust(p.x+p.w/2,p.y+p.h*.85,p.face);
    }else dust(p.x+p.w/2,p.y+p.h,p.face);
  }
  keys.jump=false;
  p.vy+=1920*dt;
  p.x+=p.vx*dt;p.x=Math.max(0,p.x);p.y+=p.vy*dt;
  p.wasOn=p.on;p.on=false;
  // Platforms
  for(const b of world.platforms){
    if(p.vy>=0&&p.x+p.w>b.x+4&&p.x<b.x+b.w-4&&p.y+p.h>=b.y&&p.y+p.h-p.vy*dt<=b.y+10){
      p.y=b.y-p.h;p.vy=0;p.on=true;
    }
  }
  // Crates as platforms
  for(const c of world.crates){
    if(p.vy>=0&&p.x+p.w>c.x+2&&p.x<c.x+c.w-2&&p.y+p.h>=c.y&&p.y+p.h-p.vy*dt<=c.y+10){
      p.y=c.y-p.h;p.vy=0;p.on=true;
    }
  }
  // Blocks: stand on top / bump from below
  for(const b of world.blocks){
    if(!b.alive)continue;
    b.bump=Math.max(0,(b.bump||0)-dt*8);
    const hitbox={x:b.x,y:b.y+(b.bump?-6:0),w:b.w,h:b.h};
    // land on top
    if(p.vy>=0&&p.x+p.w>b.x+4&&p.x<b.x+b.w-4&&p.y+p.h>=b.y&&p.y+p.h-p.vy*dt<=b.y+12){
      p.y=b.y-p.h;p.vy=0;p.on=true;
    }
    // hit from below
    if(p.vy<0&&p.x+p.w>b.x+6&&p.x<b.x+b.w-6&&p.y<=b.y+b.h&&p.y-p.vy*dt>=b.y+b.h-8){
      p.y=b.y+b.h;p.vy=80;b.bump=1;
      hitBlock(b);
    }
  }

  if(!p.wasOn&&p.on){p.squash=1.2;p.landFlash=.22;p.jumpsLeft=2;dust(p.x+p.w/2,p.y+p.h,p.face||1);sfx('land')}
  if(p.y>H+120)hurt(true);
  if(p.vx)p.face=Math.sign(p.vx);

  // Animation state machine
  const moving=p.on&&Math.abs(p.vx)>(ice?12:26);
  const airborne=!p.on;
  if(p.landFlash>0){p.landFlash=Math.max(0,p.landFlash-dt);p.anim='land'}
  else if(p.crouch&&p.on){
    p.anim=Math.abs(p.vx)>18?'crawl':'crouch';
    p.frame+=dt*(Math.abs(p.vx)>18?8:3);
    p.idleTime=0;p.think=false;
  }else if(airborne){
    p.anim=p.vy<-80?'jumpUp':p.vy>120?'jumpDown':'jumpPeak';
    p.frame+=dt*8;p.idleTime=0;p.think=false;
  }else if(moving){
    p.anim=wantSprint||Math.abs(p.vx)>300?'run':'walk';
    let prev=p.frame;p.frame+=Math.abs(p.vx)*dt/(p.anim==='run'?16:20);
    if(Math.floor(p.frame)%2!==Math.floor(prev)%2)dust(p.x+p.w*(p.face>0?.35:.65),p.y+p.h,p.face);
    p.idleTime=0;p.think=false;p.idleNext=1.8+Math.random()*1.2;
  }else{
    p.idleTime+=dt;p.frame+=dt;
    if(p.idleTime>=p.idleNext){
      p.idleTime=0;
      p.idleNext=2.4+Math.random()*2.8;
      let next=IDLE_POOL[Math.floor(Math.random()*IDLE_POOL.length)];
      if(next===p.idleMode)next=IDLE_POOL[(IDLE_POOL.indexOf(next)+1+(Math.random()*4|0))%IDLE_POOL.length];
      p.idleMode=next;p.poseT=0;
    }
    p.anim=p.idleMode||'pocket';
    p.think=p.anim==='think';
  }
  p.squash+=(1-p.squash)*Math.min(1,dt*12);
  p.inv=Math.max(0,p.inv-dt);p.hurtFlash=Math.max(0,p.hurtFlash-dt);p.poseT+=dt;
  shake=Math.max(0,shake-dt*3);world.portalPulse+=dt;

  for(const c of world.coins){
    c.t+=dt;
    if(!c.got&&Math.hypot(p.x+p.w/2-c.x,p.y+p.h/2-c.y)<52){
      c.got=true;world.coinsGot++;world.score+=100;sfx('coin');
      burst(c.x,c.y,10,['#55f2b0','#dfffee','#43efa7','#ffe47c'],220);
      p.anim='magic';p.poseT=0;
    }
  }
  updateEnemies(dt,t);
  for(const m of world.power){
    m.t=(m.t||0)+dt;
    if(!m.got&&rect(p,{x:m.x,y:m.y,w:44,h:38})){
      m.got=true;
      if(!p.big){p.big=true;applyHeight(p,false);p.y-=30;p.h=SPRITE_H_BIG;p.w=70}
      world.score+=500;sfx('power');p.anim='magic';p.poseT=0;
      burst(m.x+22,m.y+18,18,['#48f3a9','#fff','#a8f3ff'],300);
    }
  }
  for(const cp of world.checkpoints){
    if(!cp.got&&Math.abs(p.x+p.w/2-cp.x)<40&&p.y+p.h<=cp.y+8&&p.y+p.h>cp.y-120){
      cp.got=true;p.checkpoint={x:cp.x-20,y:cp.y,id:cp.id,score:world.score,coinsGot:world.coinsGot,worldSeed:world.worldSeed};
      sfx('checkpoint');burst(cp.x,cp.y-60,16,['#4affb0','#ffe47c','#fff'],200);
      p.anim='inspect';p.poseT=0;saveProgress({checkpoint:p.checkpoint});
    }
  }

  if(p.x>world.finish){
    world.state='portal';running=false;
    world.score+=Math.max(0,Math.floor(world.time-(performance.now()-world.start)/1000))*20;
    burst(world.finish+190,455,30,['#4affb0','#9a5cff','#dfffee'],320);
    victory();
  }
  camera+=(Math.max(0,Math.min(world.length-W,p.x-W*.36))-camera)*Math.min(1,dt*5);
  weather(dt);updateFx(dt);ambient(dt);
}

function hitBlock(b){
  if(!b.alive)return;
  if(b.type==='brick'){
    b.alive=false;world.score+=50;sfx('break');
    burst(b.x+b.w/2,b.y+b.h/2,14,['#c47a3a','#8b5a2b','#e8b07a'],240);
  }else if(b.type==='crate'){
    b.alive=false;world.score+=30;sfx('break');
    burst(b.x+b.w/2,b.y+b.h/2,12,['#d4a574','#8b6914','#fff3'],220);
    if(Math.random()<.45){world.coins.push({x:b.x+21,y:b.y-20,t:0,got:false,pulse:0});world.score+=20}
  }else if(b.type==='bonus'){
    if(b.used){sfx('land');return}
    b.used=true;b.type='empty';
    world.coins.push({x:b.x+21,y:b.y-30,t:0,got:false,pulse:0});
    world.score+=150;sfx('coin');
    burst(b.x+21,b.y,10,['#ffe47c','#55f2b0','#fff'],200);
  }else sfx('land');
}

function updateEnemies(dt,t){
  const p=player;
  for(const b of world.enemies){
    if(!b.alive)continue;
    b.wobble+=dt*8;
    if(b.type==='bug'||b.type==='spike'){
      b.x+=b.v*dt*(t.ice?1.15:1);
      let footing=world.platforms.find(z=>b.x+b.w/2>z.x&&b.x+b.w/2<z.x+z.w&&Math.abs(b.y+b.h-z.y)<10);
      if(!footing){b.v*=-1;b.x+=b.v*dt*2}
    }else if(b.type==='flyer'){
      b.x+=b.v*dt;b.y=b.baseY+Math.sin(b.wobble*1.2)*(b.amp||30);
      if(b.x<camera-80||b.x>camera+W+80){/* keep */}
      // reverse near platform edges loosely
      if(Math.random()<dt*.2)b.v*=-1;
    }else if(b.type==='hopper'){
      b.hop=(b.hop||0)-dt;
      b.vy=(b.vy||0)+2200*dt;b.y+=b.vy*dt;b.x+=b.v*dt;
      let footing=world.platforms.find(z=>b.x+b.w/2>z.x&&b.x+b.w/2<z.x+z.w&&b.y+b.h>=z.y&&b.y+b.h-b.vy*dt<=z.y+12);
      if(footing){b.y=footing.y-b.h;b.vy=0;if(b.hop<=0){b.vy=-520;b.hop=.9+Math.random()*.8}}
      if(!footing&&b.y>H+40){b.alive=false}
      let edge=world.platforms.find(z=>b.x+b.w/2>z.x&&b.x+b.w/2<z.x+z.w);
      if(edge&&(b.x<=edge.x+4||b.x+b.w>=edge.x+edge.w-4)&&b.vy===0)b.v*=-1;
    }else if(b.type==='glitch'){
      b.blink=(b.blink||0)-dt;
      if(b.blink<=0){b.visible=!b.visible;b.blink=b.visible?.35+.4*Math.random():.15+.2*Math.random();if(b.visible)b.x+=b.v*(.25+Math.random()*.4)}
      if(b.visible)b.x+=b.v*dt*.35;
      let footing=world.platforms.find(z=>b.x+b.w/2>z.x&&b.x+b.w/2<z.x+z.w&&Math.abs(b.y+b.h-z.y)<10);
      if(!footing){b.v*=-1}
    }

    if(b.type==='glitch'&&!b.visible)continue;
    if(rect(p,b)){
      const canStomp=b.type!=='spike'&&p.vy>120&&p.y+p.h<b.y+b.h*.55;
      if(canStomp){
        b.alive=false;p.vy=-450;world.score+=b.type==='glitch'?350:250;sfx('land');p.squash=.75;
        const cols=b.type==='flyer'?['#5ec8ff','#fff','#7affc2']:b.type==='hopper'?['#ff9f43','#ffe47c']:['#8b3fe0','#c9a0ff','#7affc2'];
        burst(b.x+b.w/2,b.y+b.h/2,14,cols,260);
      }else hurt(false);
    }
  }
}

function ambient(dt){
  let t=world.t;
  const leafRate=t.leafStorm?10:(t.weather==='Limpo'?(t.wind?5:2):0);
  if(Math.random()<dt*leafRate){
    world.fx.push({x:camera+Math.random()*W,y:-8,vx:(t.wind||0)*80+(Math.random()-.5)*40,vy:40+Math.random()*55,life:3+Math.random()*2,max:5,r:3+Math.random()*3,c:t.leaf,g:30,spin:Math.random()*6,leaf:true});
  }
  if(t.night&&Math.random()<dt*3){
    world.fx.push({x:camera+Math.random()*W,y:80+Math.random()*420,vx:(Math.random()-.5)*18,vy:(Math.random()-.5)*18,life:1.2+Math.random(),max:2,r:1.5+Math.random()*2,c:'#d7ffe499',g:0,glow:true});
  }
  for(const c of world.clouds){c.x+=c.spd*(t.wind||1)*26*dt;if(c.x>world.length+200)c.x=-200;if(c.x<-220)c.x=world.length+100}
  for(const d of world.decor)d.phase+=dt*(1.6+Math.abs(t.wind||0)*2.5);
}

function updateFx(dt){
  for(const p of world.fx){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=(p.g||0)*dt;if(p.leaf)p.vx+=Math.sin((p.spin||0)+p.life*4)*30*dt}
  world.fx=world.fx.filter(p=>p.life>0);
}

function hurt(fall){
  if(player.inv>0)return;
  shake=.5;player.hurtFlash=.6;player.anim='hurt';player.poseT=0;sfx('hurt');
  if(player.big&&!fall){
    player.big=false;applyHeight(player,false);player.h=SPRITE_H;player.w=56;player.inv=1.8;
    burst(player.x+player.w/2,player.y+player.h/2,12,['#48f3a9','#fff'],180);
    if(aiMode){aiBackoff=.5;aiJumpCd=.3}
    return;
  }
  lives--;
  world.score=Math.max(0,world.score-200);
  if(aiMode){aiBackoff=.55;aiStuck=0;aiJumpCd=.35}
  if(lives<=0){gameOver();return}
  const cp=player.checkpoint;
  if(cp){player.x=cp.x;player.y=cp.y-player.h;world.score=Math.max(world.score,cp.score||0)}
  else{player.x=Math.max(80,camera+100);player.y=250}
  player.vx=0;player.vy=0;player.inv=2;
  camera=Math.max(0,player.x-W*.36);
  if(!aiMode)saveProgress({checkpoint:player.checkpoint});
}

function gameOver(){
  running=false;world.state='dead';music('stop');setPlaying(false);
  document.body.classList.remove('ai-playing');
  if(aiMode){
    ui.over.innerHTML=`Modo IA perdeu<br>Pontuação: <b>${world.score}</b><br>Fase: <b>${level+1}</b>`;
    ui.gameover.classList.remove('hidden');
    // Reinicia a demo depois, sem imortalidade
    setTimeout(()=>{
      if(!document.querySelector('#gameover')?.classList.contains('hidden')&&!running){
        // só reinicia se ainda estiver na tela de game over da IA
        if(ui.start.classList.contains('hidden')){
          aiMode=true;level=0;lives=3;startLevel({resetLives:true,ai:true});
        }
      }
    },2200);
    return;
  }
  ui.over.innerHTML=`Pontuação: <b>${world.score}</b><br>Fase: <b>${level+1}</b><br>Recorde: <b>${Math.max(bestScore,world.score)}</b>`;
  ui.gameover.classList.remove('hidden');
  bestScore=Math.max(bestScore,world.score);
  localStorage.setItem(SAVE_KEY,JSON.stringify({level:0,lives:3,score:0,best:bestScore,checkpoint:null}));
}

function weather(dt){
  const w=world.t.weather;
  let rate=w==='Limpo'||w==='Nublado'?0:w==='Chuva'?18:w==='Garoa'?8:w==='Ventania'?2:8;
  for(let i=0;i<rate;i++)if(Math.random()<dt*9)world.particles.push({x:camera+Math.random()*W,y:-10,v:w==='Chuva'?760:w==='Garoa'?420:95,s:w==='Chuva'?16:w==='Garoa'?10:3});
  for(const p of world.particles){p.y+=p.v*dt;p.x+=(world.t.wind||0)*95*dt}
  world.particles=world.particles.filter(p=>p.y<H+40);
}

function pickAnimFrame(){
  const p=player;
  // Short special poses
  if(p.anim==='hurt'&&p.poseT<.45)return SPR.emotion[Math.min(1,Math.floor(p.poseT*6))%2];
  if(p.anim==='magic'&&p.poseT<.7&&p.idleMode!=='magic')return SPR.magic[Math.floor(p.poseT*10)%SPR.magic.length];
  if(p.anim==='inspect'&&p.poseT<1.1&&p.idleMode!=='look')return SPR.inspect[Math.floor(p.poseT*7)%SPR.inspect.length];
  if(p.landFlash>0)return SPR.jump[p.landFlash>.1?3:4]||SPR.jump[3];

  if(p.anim==='crouch'||p.anim==='crawl'){
    return SPR.jump[Math.floor(p.frame*2)%2===0?0:3]||SPR.jump[0];
  }
  if(p.anim==='jumpUp')return SPR.jump[1]||SPR.jump[0];
  if(p.anim==='jumpPeak')return SPR.jump[2]||SPR.jump[1];
  if(p.anim==='jumpDown')return SPR.jump[0]||SPR.jump[3];
  if(p.anim==='run')return SPR.run[Math.floor(Math.abs(p.frame))%SPR.run.length];
  if(p.anim==='walk')return SPR.walk[Math.floor(Math.abs(p.frame))%SPR.walk.length];

  // Idles variados quando parada
  if(p.anim==='think')return SPR.emotion[4+Math.floor(p.poseT*2)%3];
  if(p.anim==='look')return SPR.inspect[Math.floor(p.poseT*4)%SPR.inspect.length];
  if(p.anim==='wave')return SPR.wave[Math.floor(p.poseT*5)%SPR.wave.length];
  if(p.anim==='sit')return SPR.jump[4]||SPR.emotion[7];
  if(p.anim==='surprise')return SPR.emotion[Math.floor(p.poseT*6)%2];
  if(p.anim==='magic')return SPR.magic[Math.floor(p.poseT*4)%SPR.magic.length];
  const idleSet=[SPR.emotion[2],SPR.emotion[3],SPR.emotion[7]];
  return idleSet[Math.floor(p.poseT*1.2)%idleSet.length];
}

function draw(){
  let t=world?.t||themes[0];
  let sx=shake?(Math.random()-.5)*shake*18:0,sy=shake?(Math.random()-.5)*shake*14:0;
  X.save();X.translate(sx,sy);
  let g=X.createLinearGradient(0,0,0,H);
  let a=t.skyOverride?t.skyOverride[0]:(t.night?'#07152d':t.sky[0]);
  let b=t.skyOverride?t.skyOverride[1]:(t.night?'#182f4d':t.sky[1]);
  g.addColorStop(0,a);g.addColorStop(1,b);X.fillStyle=g;X.fillRect(-20,-20,W+40,H+40);
  drawSky(t);
  if(!world){X.restore();return}
  // Parallax far buildings
  X.save();X.translate(-camera*.25,0);drawBuildings(t,1);X.restore();
  X.save();X.translate(-camera*.55,0);drawClouds(t);drawBuildings(t,0);X.restore();
  X.save();X.translate(-camera,0);drawWorld(t);drawFxWorld();X.restore();
  drawWeather(t);drawHud(t);X.restore();
}

function drawSky(t){
  X.globalAlpha=.85;X.fillStyle=t.night?'#e7fff4':'#fff5c4';
  X.beginPath();X.arc(1060,100,t.night?34:60,0,7);X.fill();
  if(t.night){X.fillStyle='#fff';for(let i=0;i<55;i++)X.fillRect((i*197)%W,(i*83)%330,2,2)}
  X.globalAlpha=1;
  for(let layer=0;layer<3;layer++){
    X.fillStyle=t.night?`rgba(16,55,71,${.38+layer*.12})`:`rgba(43,104,105,${.17+layer*.1})`;
    X.beginPath();X.moveTo(0,H);
    for(let x=0;x<=W;x+=100)X.lineTo(x,420-layer*45-Math.sin(x*.009+layer+(world?.portalPulse||0)*.3)*70);
    X.lineTo(W,H);X.fill();
  }
}

function drawBuildings(t,layer){
  for(const b of world.buildings){
    if((b.layer||0)!==layer)continue;
    const x=b.x,y=b.y-b.h,bw=b.w,bh=b.h;
    X.fillStyle=t.night?'#0e2433cc':'#1a3a44aa';
    X.fillRect(x,y,bw,bh);
    X.fillStyle='#43efa7';X.font=`900 ${Math.floor(bw*.35)}px sans-serif`;
    X.fillText('R',x+bw*.28,y+bh*.35);
    X.fillStyle=t.night?'#4affb055':'#ffe47c55';
    for(let wy=y+20;wy<y+bh-20;wy+=22)for(let wx=x+8;wx<x+bw-8;wx+=16)X.fillRect(wx,wy,8,10);
  }
}

function drawClouds(t){
  if(t.night)return;
  for(const c of world.clouds){
    X.globalAlpha=c.a;X.fillStyle='#ffffff';
    X.beginPath();X.ellipse(c.x,c.y,c.w*.5,c.w*.22,0,0,7);X.fill();
    X.beginPath();X.ellipse(c.x-c.w*.25,c.y+8,c.w*.28,c.w*.16,0,0,7);X.fill();
    X.beginPath();X.ellipse(c.x+c.w*.22,c.y+6,c.w*.32,c.w*.18,0,0,7);X.fill();
  }
  X.globalAlpha=1;
}

function drawWorld(t){
  for(const b of world.platforms){
    if(b.soft)continue; // pipe top already drawn via decor
    X.fillStyle=t.soil;X.fillRect(b.x,b.y,b.w,b.h);
    X.fillStyle=b.ice?'#d7f7ff':t.ground;X.fillRect(b.x,b.y,b.w,18);
    X.fillStyle=(b.ice?t.accent:t.accent)+'66';X.fillRect(b.x,b.y,b.w,4);
    if(b.ice){X.fillStyle='#ffffff55';for(let x=b.x+10;x<b.x+b.w;x+=40)X.fillRect(x,b.y+2,18,3)}
    X.fillStyle='#ffffff18';for(let x=b.x+15;x<b.x+b.w;x+=55)X.fillRect(x,b.y+45+(x%3)*12,28,7);
  }
  for(const c of world.crates)drawCrate(c,t);
  for(const d of world.decor)drawDecor(d,t);
  for(const b of world.blocks)if(b.alive)drawBlock(b,t);
  for(const cp of world.checkpoints)drawCheckpoint(cp);
  for(const c of world.coins)if(!c.got)drawCoin(c);
  for(const m of world.power)if(!m.got)drawPower(m);
  for(const e of world.enemies)if(e.alive)drawEnemy(e);
  drawFinish();drawPlayer();
}

function drawCrate(c,t){
  X.fillStyle='#8b5a2b';X.fillRect(c.x,c.y,c.w,c.h);
  X.fillStyle='#c47a3a';X.fillRect(c.x+2,c.y+2,c.w-4,c.h-6);
  X.strokeStyle='#5a3a18';X.lineWidth=2;X.strokeRect(c.x+4,c.y+4,c.w-8,c.h-10);
}

function drawBlock(b,t){
  const y=b.y-(b.bump?Math.sin(b.bump*Math.PI)*8:0);
  if(b.type==='brick'){
    X.fillStyle='#b45c2e';X.fillRect(b.x,y,b.w,b.h);
    X.fillStyle='#7a3a18';X.fillRect(b.x,y+b.h/2-1,b.w,3);X.fillRect(b.x+b.w/2-1,y,3,b.h);
    X.fillStyle='#e09860';X.fillRect(b.x+4,y+4,10,8);X.fillRect(b.x+b.w-14,y+b.h-14,10,8);
  }else if(b.type==='bonus'){
    X.fillStyle='#e8b34a';X.fillRect(b.x,y,b.w,b.h);
    X.strokeStyle='#8a5a10';X.lineWidth=3;X.strokeRect(b.x+3,y+3,b.w-6,b.h-6);
    X.fillStyle='#fff8';X.font='900 26px sans-serif';X.fillText('?',b.x+12,y+30);
  }else if(b.type==='empty'){
    X.fillStyle='#6a5840';X.fillRect(b.x,y,b.w,b.h);
    X.strokeStyle='#3d3224';X.lineWidth=2;X.strokeRect(b.x+2,y+2,b.w-4,b.h-4);
  }else{ // crate block
    X.fillStyle='#c9965a';X.fillRect(b.x,y,b.w,b.h);
    X.strokeStyle='#6b4423';X.lineWidth=2;X.strokeRect(b.x+3,y+3,b.w-6,b.h-6);
    X.beginPath();X.moveTo(b.x+6,y+6);X.lineTo(b.x+b.w-6,y+b.h-6);X.moveTo(b.x+b.w-6,y+6);X.lineTo(b.x+6,y+b.h-6);X.stroke();
  }
}

function drawDecor(d,t){
  if(d.type==='grass'){
    let sway=Math.sin(d.phase)*4*(world.t.wind||.4)*d.side;
    X.strokeStyle=t.ground;X.lineWidth=2.5;X.lineCap='round';
    X.beginPath();X.moveTo(d.x,d.y);X.quadraticCurveTo(d.x+sway,d.y-d.h*.5,d.x+sway*1.4,d.y-d.h);X.stroke();
  }else if(d.type==='bush'){
    let sway=Math.sin(d.phase)*3;
    X.fillStyle=t.ground;X.beginPath();X.ellipse(d.x+sway,d.y-18*d.s,28*d.s,20*d.s,0,0,7);X.fill();
    X.beginPath();X.ellipse(d.x-16*d.s+sway*.5,d.y-12*d.s,18*d.s,14*d.s,0,0,7);X.fill();
    X.beginPath();X.ellipse(d.x+16*d.s+sway*.5,d.y-12*d.s,18*d.s,14*d.s,0,0,7);X.fill();
  }else if(d.type==='rock'){
    X.fillStyle='#5a504888';X.beginPath();
    X.moveTo(d.x-18*d.s,d.y);X.lineTo(d.x-10*d.s,d.y-16*d.s);X.lineTo(d.x+8*d.s,d.y-20*d.s);X.lineTo(d.x+20*d.s,d.y);X.fill();
  }else if(d.type==='tree'){
    const sway=Math.sin(d.phase)*5;
    X.fillStyle='#5a3a22';X.fillRect(d.x-6*d.s,d.y-55*d.s,12*d.s,55*d.s);
    X.fillStyle=t.ground;X.beginPath();X.ellipse(d.x+sway,d.y-70*d.s,34*d.s,28*d.s,0,0,7);X.fill();
    X.beginPath();X.ellipse(d.x-18*d.s+sway,d.y-55*d.s,22*d.s,18*d.s,0,0,7);X.fill();
    X.beginPath();X.ellipse(d.x+18*d.s+sway,d.y-55*d.s,22*d.s,18*d.s,0,0,7);X.fill();
  }else if(d.type==='pipe'){
    X.fillStyle='#2f8f5b';X.fillRect(d.x+4,d.y-d.h,d.w-8,d.h);
    X.fillStyle='#3cb872';X.fillRect(d.x,d.y-d.h-12,d.w,18);
    X.fillStyle='#1e5c3a';X.fillRect(d.x+8,d.y-d.h+10,d.w-16,d.h-14);
  }else if(d.type==='flower'){
    const sway=Math.sin(d.phase)*3;
    X.strokeStyle=t.ground;X.lineWidth=2;X.beginPath();X.moveTo(d.x,d.y);X.lineTo(d.x+sway,d.y-22);X.stroke();
    X.fillStyle=d.col||t.accent;
    for(let i=0;i<5;i++){const a=i*1.256;X.beginPath();X.arc(d.x+sway+Math.cos(a)*7,d.y-22+Math.sin(a)*7,5,0,7);X.fill()}
    X.fillStyle='#ffe47c';X.beginPath();X.arc(d.x+sway,d.y-22,4,0,7);X.fill();
  }
}

function drawEnemy(b){
  if(b.type==='glitch'&&!b.visible)return;
  X.save();X.translate(b.x+b.w/2,b.y+b.h/2+Math.sin(b.wobble)*(b.type==='flyer'?0:3));
  if(b.type==='bug'){
    X.fillStyle='#8b3fe0';X.beginPath();X.ellipse(0,2,23,17,0,0,7);X.fill();
    X.strokeStyle='#321146';X.lineWidth=5;
    for(let i=-1;i<=1;i+=2){X.beginPath();X.moveTo(i*12,8);X.lineTo(i*28,17);X.moveTo(i*12,-3);X.lineTo(i*27,-12);X.stroke()}
    X.fillStyle='#7affc2';X.fillRect(-12,-7,7,7);X.fillRect(5,-7,7,7);
  }else if(b.type==='flyer'){
    X.fillStyle='#3aa0e8';X.beginPath();X.ellipse(0,0,20,14,0,0,7);X.fill();
    X.fillStyle='#9ad8ff88';X.beginPath();X.ellipse(-8,-14,14,8,0,0,7);X.fill();X.beginPath();X.ellipse(8,-14,14,8,0,0,7);X.fill();
    X.fillStyle='#fff';X.fillRect(-10,-4,6,6);X.fillRect(4,-4,6,6);X.fillStyle='#07304a';X.fillRect(-8,-2,3,3);X.fillRect(6,-2,3,3);
  }else if(b.type==='spike'){
    X.fillStyle='#c23b5a';X.beginPath();X.ellipse(0,4,20,14,0,0,7);X.fill();
    X.fillStyle='#ff6b8a';
    for(let i=-2;i<=2;i++){X.beginPath();X.moveTo(i*8,-2);X.lineTo(i*8-5,-18);X.lineTo(i*8+5,-18);X.closePath();X.fill()}
    X.fillStyle='#fff';X.fillRect(-10,0,6,6);X.fillRect(4,0,6,6);
  }else if(b.type==='hopper'){
    X.fillStyle='#e67e22';X.beginPath();X.ellipse(0,2,20,16,0,0,7);X.fill();
    X.fillStyle='#f5c16c';X.beginPath();X.ellipse(0,8,14,8,0,0,7);X.fill();
    X.fillStyle='#2d1608';X.fillRect(-14,10,10,8);X.fillRect(4,10,10,8);
    X.fillStyle='#fff';X.fillRect(-10,-6,7,7);X.fillRect(3,-6,7,7);
  }else if(b.type==='glitch'){
    X.fillStyle='#5cff9d';X.fillRect(-18,-14,36,28);
    X.fillStyle='#9a5cff';X.fillRect(-18,-14,36,6);X.fillRect(-18,8,36,6);
    X.fillStyle='#0a1f18';X.fillRect(-10,-4,6,6);X.fillRect(4,-4,6,6);
    X.globalAlpha=.5;X.fillStyle='#fff';X.fillRect(10,-20,8,8);X.fillRect(-22,6,6,6);X.globalAlpha=1;
  }
  X.restore();
}

function drawCheckpoint(cp){
  const lit=cp.got;
  X.strokeStyle=lit?'#4affb0':'#9bb3ba';X.lineWidth=6;
  X.beginPath();X.moveTo(cp.x,cp.y);X.lineTo(cp.x,cp.y-110);X.stroke();
  X.fillStyle=lit?'#43efa7':'#6a8490';
  X.beginPath();X.moveTo(cp.x,cp.y-110);X.lineTo(cp.x+48,cp.y-92);X.lineTo(cp.x,cp.y-74);X.fill();
  if(lit){
    X.globalAlpha=.35;X.fillStyle='#4affb0';X.beginPath();X.arc(cp.x,cp.y-90,28+Math.sin(world.portalPulse*4)*4,0,7);X.fill();X.globalAlpha=1;
  }
}

function drawCoin(c){
  let y=c.y+Math.sin(c.t*5)*6,glow=.55+Math.abs(Math.sin(c.t*3+c.pulse))*.45;
  X.save();X.translate(c.x,y);
  X.globalAlpha=.35*glow;X.fillStyle='#55f2b0';X.beginPath();X.arc(0,0,32,0,7);X.fill();X.globalAlpha=1;
  X.scale(.5+Math.abs(Math.sin(c.t*4))*.5,1);
  X.fillStyle='#063c31';X.beginPath();X.arc(0,0,25,0,7);X.fill();
  X.strokeStyle='#55f2b0';X.lineWidth=4;X.stroke();
  if(brandLogo.complete)X.drawImage(brandLogo,-18,-18,36,36);
  X.restore();
}
function drawPower(m){
  let bob=Math.sin((m.t||0)*4)*5;
  X.save();X.translate(m.x+22,m.y+18+bob);
  X.globalAlpha=.3;X.fillStyle='#48f3a9';X.beginPath();X.arc(0,0,34,0,7);X.fill();X.globalAlpha=1;
  X.fillStyle='#48f3a9';X.beginPath();X.arc(0,-7,22,Math.PI,0);X.lineTo(22,2);X.lineTo(-22,2);X.fill();
  X.fillStyle='#f6fff8';X.fillRect(-13,0,26,25);X.fillStyle='#092c29';X.fillRect(-5,5,10,13);X.restore();
}
function drawFinish(){
  let x=world.finish,pulse=1+Math.sin(world.portalPulse*3)*.06;
  X.strokeStyle='#dfffee';X.lineWidth=8;X.beginPath();X.moveTo(x,560);X.lineTo(x,270);X.stroke();
  X.fillStyle='#43efa7';X.beginPath();X.moveTo(x,280);X.lineTo(x+100,310);X.lineTo(x,345);X.fill();
  X.fillStyle='#092c29';X.font='900 34px sans-serif';X.fillText('R',x+25,326);
  let px=x+190;
  X.save();X.translate(px,455);X.scale(pulse,pulse);
  X.strokeStyle='#4affb066';X.lineWidth=16;X.beginPath();X.ellipse(0,0,58,115,0,0,7);X.stroke();
  X.strokeStyle='#4affb0';X.lineWidth=10;X.beginPath();X.ellipse(0,0,48,105,0,0,7);X.stroke();
  X.strokeStyle='#9a5cff';X.lineWidth=5;X.beginPath();X.ellipse(0,0,34,86,0,0,7);X.stroke();X.restore();
}

function drawPlayer(){
  let p=player;
  if(p.inv&&Math.floor(p.inv*10)%2)return;
  let frame=pickAnimFrame();
  let hBase=p.h,drawH=hBase*p.squash,drawW;
  if(frame?.complete&&frame.naturalWidth)drawW=drawH*(frame.naturalWidth/frame.naturalHeight);
  else drawW=hBase*.95*p.squash;
  let bob=(p.anim==='walk'||p.anim==='run')?Math.sin(p.frame*Math.PI)*.5*Math.min(1,Math.abs(p.vx)/200)*4:0;
  let ox=p.x+p.w/2,oy=p.y+p.h;
  X.save();X.translate(ox,oy-bob);
  // Hurt / think facing: keep face; emotion sprites are 3/4 right so flip when face<0
  if(p.face<0)X.scale(-1,1);
  let lean=Math.max(-.08,Math.min(.08,p.vx/4500));X.rotate(lean);
  if(frame?.complete&&frame.naturalWidth)X.drawImage(frame,-drawW/2,-drawH,drawW,drawH);
  if(p.big){
    X.globalAlpha=.22+Math.sin(performance.now()/200)*.08;X.strokeStyle='#48f3a9';X.lineWidth=3;
    X.beginPath();X.ellipse(0,-drawH*.5,drawW*.55,drawH*.55,0,0,7);X.stroke();X.globalAlpha=1;
  }
  X.restore();
}

function drawFxWorld(){
  for(const p of world.fx){
    let a=Math.max(0,p.life/(p.max||.8));X.globalAlpha=a;X.fillStyle=p.c;
    if(p.glow){X.beginPath();X.arc(p.x,p.y,p.r*(1.2+a),0,7);X.fill()}
    else if(p.leaf){X.save();X.translate(p.x,p.y);X.rotate((p.spin||0)+p.life);X.fillRect(-p.r,-p.r*.4,p.r*2,p.r*.8);X.restore()}
    else{X.beginPath();X.arc(p.x,p.y,p.r*a,0,7);X.fill()}
  }
  X.globalAlpha=1;
}
function drawWeather(t){
  X.strokeStyle='#b5edff99';X.fillStyle='#fff';
  for(const p of world.particles){
    if(t.weather==='Chuva'||t.weather==='Garoa'){X.beginPath();X.moveTo(p.x-camera,p.y);X.lineTo(p.x-camera+(t.wind||0)*10,p.y+p.s);X.stroke()}
    else{X.beginPath();X.arc(p.x-camera,p.y,p.s,0,7);X.fill()}
  }
  if(t.night){X.fillStyle='#02101844';X.fillRect(0,0,W,H)}
  if(t.weather==='Chuva'){X.fillStyle='#1a334422';X.fillRect(0,0,W,H)}
  if(t.weather==='Garoa'){X.fillStyle='#1a334418';X.fillRect(0,0,W,H)}
  if(t.weather==='Nublado'){X.fillStyle='#1a2a3344';X.fillRect(0,0,W,H)}
  if(t.weather==='Ventania'||Math.abs(t.wind||0)>1){X.fillStyle='#ffffff08';for(let i=0;i<8;i++){let y=(performance.now()/12+i*90)%H;X.fillRect(0,y,W,2)}}
}

function drawHud(t){
  let elapsed=(performance.now()-world.start)/1000;
  const barX=25,barY=20,barH=78;
  const logoH=44;
  const logoW=brandCorp.complete&&brandCorp.naturalWidth
    ? Math.min(168, Math.max(110, brandCorp.naturalWidth/brandCorp.naturalHeight*logoH))
    : 140;
  const barW=Math.max(760, 48+logoW+520);
  X.fillStyle='#06151dcc';round(barX,barY,barW,barH,18);

  // Logo Redobrai dentro do bloco da fase
  if(brandCorp.complete){
    X.drawImage(brandCorp, barX+12, barY+(barH-logoH)/2, logoW, logoH);
  }

  const textX=barX+12+logoW+14;
  X.fillStyle='#fff';X.font='800 22px sans-serif';X.fillText(`FASE ${level+1}`,textX,48);
  X.fillStyle='#ff7a9a';X.fillText(`♥ ${lives}`,textX+120,48);
  X.fillStyle='#69f6ba';X.fillText(`◆ ${world.coinsGot}`,textX+200,48);
  X.fillStyle='#fff';X.fillText(`${world.score.toString().padStart(6,'0')}`,textX+300,48);
  X.fillStyle='#bfe5e4';X.font='600 15px sans-serif';
  const chal=t.ice?'Gelo escorregadio':t.challenge==='vento'?'Vento forte':t.leafStorm?'Tempestade de folhas':t.heat?'Calor intenso':'—';
  X.fillText(`${t.season} · ${t.dayPart||(t.night?'Noite':'Dia')} · ${t.weather} · ${chal}`,textX,74);
  X.textAlign='right';X.fillStyle='#fff';X.font='800 22px sans-serif';
  X.fillText(`${Math.max(0,Math.ceil(world.time-elapsed))}s`,barX+barW-18,58);X.textAlign='left';
  if(player.checkpoint){X.fillStyle='#4affb0';X.font='700 14px sans-serif';X.fillText('⚑ checkpoint',textX+430,48)}
  if(aiMode){
    X.fillStyle='#9a5cff';X.font='800 16px sans-serif';
    X.fillText('MODO IA · Esc para sair', barX+18, barY+barH+22);
  }
}
function round(x,y,w,h,r){X.beginPath();X.roundRect(x,y,w,h,r);X.fill()}

function victory(){
  music('victory');
  if(!aiMode)saveProgress({level:level+1,checkpoint:null,score:world.score});
  setTimeout(()=>{
    if(aiMode){
      // continua sozinha para a próxima fase
      level++;
      startLevel({ai:true});
      return;
    }
    setPlaying(false);
    ui.title.textContent=`Fase ${level+1} concluída!`;
    ui.score.innerHTML=`Núcleos: <b>${world.coinsGot}</b><br>Pontuação: <b>${world.score}</b><br>Vidas: <b>${lives}</b><br>Clima: <b>${world.t.season} · ${world.t.dayPart||''} · ${world.t.weather}</b>`;
    ui.result.classList.remove('hidden');waveAnim=0;
  },900);
}

function loop(ts){
  let dt=Math.min(.033,(ts-last)/1000||0);last=ts;
  // Menu fox blink
  if(!ui.start.classList.contains('hidden')){
    menuAnim+=dt;const f=Math.floor(menuAnim*3)%SPR.idleFront.length;
    if(SPR.idleFront[f]?.complete)ui.menuFox.src=SPR.idleFront[f].src;
  }
  if(!ui.result.classList.contains('hidden')){
    waveAnim+=dt;const f=Math.floor(waveAnim*4)%SPR.wave.length;
    if(SPR.wave[f]?.complete)ui.resultFox.src=SPR.wave[f].src;
  }
  if(world){update(dt);draw()}
  requestAnimationFrame(loop);
}

addEventListener('keydown',e=>{
  if(aiMode&&['ArrowLeft','a','A','ArrowRight','d','D','ArrowUp','w','W',' ','Shift','ArrowDown','s','S'].includes(e.key)){
    aiMode=false;document.body.classList.remove('ai-playing');
  }
  if(['ArrowLeft','a','A'].includes(e.key))keys.left=true;
  if(['ArrowRight','d','D'].includes(e.key))keys.right=true;
  if(['ArrowDown','s','S'].includes(e.key)){keys.down=true;e.preventDefault()}
  if(['ArrowUp','w','W',' '].includes(e.key)){keys.jump=true;e.preventDefault()}
  if(e.key==='Shift')keys.run=true;
  if(e.key==='m'||e.key==='M')setMute(!muted);
  if(e.key==='f'||e.key==='F'){e.preventDefault();toggleFullscreen()}
  if(e.key==='Escape'){
    if(aiMode){stopAiToMenu();return}
    if(isFullscreen()){exitFullscreen();return}
    running=false;setPlaying(false);ui.start.classList.remove('hidden');ui.result.classList.add('hidden');ui.gameover.classList.add('hidden');music('stop');
  }
});
addEventListener('keyup',e=>{
  if(['ArrowLeft','a','A'].includes(e.key))keys.left=false;
  if(['ArrowRight','d','D'].includes(e.key))keys.right=false;
  if(['ArrowDown','s','S'].includes(e.key))keys.down=false;
  if(e.key==='Shift')keys.run=false;
});
// Multi-touch friendly controls
document.querySelectorAll('#touch button').forEach(b=>{
  const k=b.dataset.key;
  const down=e=>{
    e.preventDefault();e.stopPropagation();
    if(aiMode){aiMode=false;document.body.classList.remove('ai-playing')}
    keys[k]=true;b.classList.add('held');try{b.setPointerCapture(e.pointerId)}catch{}
  };
  const up=e=>{e.preventDefault();keys[k]=false;b.classList.remove('held')};
  b.addEventListener('pointerdown',down);
  b.addEventListener('pointerup',up);
  b.addEventListener('pointercancel',up);
  b.addEventListener('pointerleave',e=>{if(e.buttons===0)up(e)});
  b.addEventListener('lostpointercapture',up);
  b.addEventListener('contextmenu',e=>e.preventDefault());
});
// Prevent page scroll / zoom while playing on mobile
['touchmove','gesturestart'].forEach(ev=>document.addEventListener(ev,e=>{if(running)e.preventDefault()},{passive:false}));

document.querySelector('#mute').onclick=()=>{ensureAudio();setMute(!muted)};
fsBtn.onclick=()=>{ensureAudio();toggleFullscreen()};
['fullscreenchange','webkitfullscreenchange'].forEach(ev=>document.addEventListener(ev,syncFsUi));

ui.volMusic.oninput=()=>{vols.music=+ui.volMusic.value/100;persistVols();if(bgm)bgm.volume=muted?0:vols.music};
ui.volSfx.oninput=()=>{vols.sfx=+ui.volSfx.value/100;persistVols()};

document.querySelector('#play').onclick=()=>{aiMode=false;level=0;lives=3;startLevel({resetLives:true,ai:false})};
document.querySelector('#playAi').onclick=()=>{level=0;lives=3;startLevel({resetLives:true,ai:true})};
document.querySelector('#continue').onclick=()=>{
  aiMode=false;
  loadSave();level=saveData?.level||0;lives=saveData?.lives||3;
  const cp=saveData?.checkpoint||null;
  const resume=cp?{...cp,worldSeed:cp.worldSeed??saveData?.worldSeed??null}:null;
  startLevel({checkpoint:resume,keepScore:true,ai:false});
};
document.querySelector('#next').onclick=()=>{if(aiMode){level++;startLevel({ai:true});return}level++;startLevel({ai:false})};
document.querySelector('#retry').onclick=()=>{aiMode=false;level=0;lives=3;startLevel({resetLives:true,ai:false})};
document.querySelector('#toMenu').onclick=()=>{
  stopAiToMenu();
};

loadSave();
syncFsUi();
world=makeLevel();player=makePlayer();draw();requestAnimationFrame(loop);
