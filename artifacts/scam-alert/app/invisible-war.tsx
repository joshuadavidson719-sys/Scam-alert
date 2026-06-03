import React, { useRef } from "react";
import { View, StyleSheet, TouchableOpacity, Text, Platform } from "react-native";
import WebView from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";

// ─────────────────────────────────────────────────────────────────────────────
// Full Three.js 3D fighting game embedded in a WebView
// ─────────────────────────────────────────────────────────────────────────────
const GAME_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<title>Invisible War</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;touch-action:manipulation;-webkit-user-select:none;user-select:none}
body{background:#000;overflow:hidden;width:100vw;height:100vh;font-family:'Courier New',monospace}
canvas{display:block;position:fixed;top:0;left:0;width:100vw;height:100vh}
button{-webkit-appearance:none;appearance:none;font:inherit;cursor:pointer;display:flex;align-items:center;justify-content:center;touch-action:manipulation}

.scr{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:20}
.scr.off{display:none}

/* MENU */
#mScrn{background:linear-gradient(180deg,#000 0%,#08001f 55%,#000 100%);gap:10px;padding:24px}
.m-eyebrow{font-size:11px;color:#6C63FF;letter-spacing:3px;text-align:center}
.m-title{font-size:clamp(44px,12vw,76px);font-weight:900;color:#fff;text-align:center;line-height:1;letter-spacing:2px;text-shadow:0 0 40px #6C63FF,0 0 80px #6C63FF44}
.m-lore{font-size:12px;color:#666;text-align:center;line-height:1.8;font-style:italic;max-width:280px}
.m-badges{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
.m-badge{width:46px;height:46px;border-radius:14px;border:1.5px solid;background:#111;display:flex;align-items:center;justify-content:center;font-size:20px}
.m-play{background:linear-gradient(90deg,#6C63FF,#FF00CC);border:none;color:#fff;font-size:14px;font-weight:900;padding:16px 28px;border-radius:16px;letter-spacing:2px;cursor:pointer;width:100%;max-width:300px}
.m-meta{font-size:10px;color:#333;text-align:center}

/* SELECT */
#sScrn{background:linear-gradient(180deg,#000,#0a001a);justify-content:flex-start;padding:max(env(safe-area-inset-top),12px) 16px 16px;overflow-y:auto}
#aScrn{background:linear-gradient(180deg,#000,#0a001a);justify-content:flex-start;padding:max(env(safe-area-inset-top),12px) 16px 16px;overflow-y:auto}
.nav{display:flex;align-items:center;justify-content:space-between;width:100%;max-width:340px;margin-bottom:12px}
.nav-back{font-size:13px;color:#888;font-weight:700;padding:8px;background:none;border:none;flex-direction:row;gap:0}
.nav-t{font-size:14px;font-weight:900;color:#fff;letter-spacing:2px}
.sel-card{display:flex;align-items:center;gap:12px;padding:14px;border-radius:16px;background:#0d0d0d;border:1.5px solid;width:100%;max-width:340px;margin-bottom:10px}
.sel-e{font-size:50px;flex-shrink:0}
.sel-i{flex:1;display:flex;flex-direction:column;gap:2px}
.sel-n{font-size:19px;font-weight:900}
.sel-r{font-size:10px;color:#888}
.sel-q{font-size:10px;color:#555;font-style:italic}
.sel-u{font-size:10px;color:#FF00CC;margin-top:2px}
.sel-s{display:flex;gap:8px;font-size:11px;font-weight:700;color:#ccc;margin-top:2px}
.f-grid{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;width:100%;max-width:340px;margin-bottom:10px}
.f-card{width:calc(25% - 6px);aspect-ratio:1;display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:14px;border:1.5px solid #222;background:#0d0d0d;cursor:pointer;gap:2px}
.f-card.on{border-color:#6C63FF;background:rgba(108,99,255,.15)}
.f-card-e{font-size:24px}
.f-card-n{font-size:8px;font-weight:700;color:#888}
.next-btn{background:linear-gradient(90deg,#FF3B3B,#6C63FF);border:none;color:#fff;font-size:16px;font-weight:900;padding:14px;border-radius:16px;letter-spacing:3px;cursor:pointer;width:100%;max-width:340px}
.a-card{display:flex;align-items:center;gap:12px;padding:14px;border-radius:16px;border:1.5px solid #2a2a2a;background:#0d0d0d;width:100%;max-width:340px;cursor:pointer;margin-bottom:8px}
.a-card.on{border-width:2px}
.a-e{font-size:30px;flex-shrink:0}
.a-n{font-size:14px;font-weight:900}
.a-b{height:2px;width:50px;border-radius:2px;margin-top:5px}
.a-sel{font-size:10px;font-weight:900;margin-left:auto}

/* HUD */
#hud{position:fixed;top:0;left:0;right:0;z-index:10;padding:max(env(safe-area-inset-top),8px) 10px 7px;background:rgba(7,0,16,.92);display:none}
.hud-row{display:flex;align-items:center;gap:7px}
.h-side{flex:1;display:flex;align-items:center;gap:6px}
.h-side.r{flex-direction:row-reverse}
.h-portrait{width:34px;height:34px;border-radius:9px;background:#111;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;border:1.5px solid}
.h-bars{flex:1;display:flex;flex-direction:column;gap:2px}
.h-name{font-size:9px;font-weight:900;color:#fff}
.h-name.r{text-align:right}
.hp-wrap{height:8px;background:#1a1a1a;border-radius:4px;overflow:hidden}
.hp-fill{height:100%;border-radius:4px;transition:width .12s}
.pw-wrap{height:4px;background:#1a1a1a;border-radius:2px;overflow:hidden}
.pw-fill{height:100%;background:#FF00CC;border-radius:2px;transition:width .15s}
.h-ctr{display:flex;flex-direction:column;align-items:center;gap:2px;min-width:40px}
.h-round{font-size:12px;font-weight:900;color:#fff}
.h-pips{display:flex;gap:3px;justify-content:center}
.h-pip{width:6px;height:6px;border-radius:50%}

/* FLOATING MESSAGES */
#hitMsg{position:fixed;top:37%;left:50%;transform:translate(-50%,-50%);font-size:19px;font-weight:900;text-align:center;z-index:15;pointer-events:none;opacity:0;transition:opacity .08s;white-space:nowrap}
#comboDiv{position:fixed;top:47%;left:50%;transform:translate(-50%,-50%);font-size:20px;font-weight:900;color:#FFD700;z-index:15;pointer-events:none;opacity:0;text-shadow:0 0 16px #FFD700}
#flash{position:fixed;inset:0;pointer-events:none;z-index:50;opacity:0;transition:opacity .04s}

/* COUNTDOWN */
#cdDiv{position:fixed;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;z-index:25;background:rgba(0,0,0,.55)}
.cd-f{font-size:30px;margin-bottom:10px}
.cd-r{font-size:12px;color:#888;letter-spacing:4px;font-weight:700;margin-bottom:14px}
.cd-n{font-size:96px;font-weight:900;text-shadow:0 0 50px currentColor;transition:color .3s}

/* KO */
#koDiv{position:fixed;inset:0;display:none;align-items:center;justify-content:center;z-index:25;background:rgba(0,0,0,.65)}
.ko-t{font-size:76px;font-weight:900;color:#FFD700;text-shadow:0 0 30px #FFD700,0 0 60px #FFD700}

/* GAME OVER */
#overDiv{position:fixed;inset:0;background:linear-gradient(180deg,#000,#0a001a);display:none;flex-direction:column;align-items:center;justify-content:center;z-index:30;gap:12px;padding:24px}
.ov-t{font-size:50px;font-weight:900;text-shadow:0 0 25px currentColor}
.ov-e{font-size:68px}
.ov-n{font-size:26px;font-weight:900}
.ov-s{font-size:13px;color:#777;text-align:center;line-height:1.75}
.ov-btn{width:100%;max-width:280px;padding:14px;border-radius:14px;border:none;font-size:14px;font-weight:900;letter-spacing:1px;color:#fff;cursor:pointer}

/* CONTROLS */
#ctrl{position:fixed;bottom:0;left:0;right:0;z-index:10;padding:7px 8px max(env(safe-area-inset-bottom),10px);background:rgba(5,0,14,.93);display:none}
.c-row{display:flex;gap:5px;margin-bottom:5px}
.c-row:last-child{margin-bottom:0}
.mb{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8px 2px;border-radius:11px;border:1.5px solid;background:#0d0020;cursor:pointer;gap:1px}
.mb:active{opacity:.7;transform:scale(.95)}
.mb-e{font-size:17px}
.mb-l{font-size:8px;font-weight:900;letter-spacing:.4px;color:#ddd}
.ult-btn{border-color:#FF00CC;background:#1a0030}
.ult-btn .mb-l{color:#FF00CC}
.ult-btn.dim{opacity:.28;pointer-events:none}
</style>
</head>
<body>
<div id="flash"></div>

<!-- MENU -->
<div class="scr" id="mScrn">
  <div class="m-eyebrow">⚔️ &nbsp;UNDERGROUND TOURNAMENT&nbsp; ⚔️</div>
  <div class="m-title">INVISIBLE<br>WAR</div>
  <div class="m-lore">"The world is secretly controlled by invisible shadow warriors. Enter the tournament. Claim the throne."</div>
  <div class="m-badges" id="mBadges"></div>
  <button class="m-play" onclick="showSelect()">ENTER THE TOURNAMENT</button>
  <div class="m-meta">8 Fighters · 6 Arenas · 7 Moves · AI Opponent · Best of 3</div>
</div>

<!-- CHARACTER SELECT -->
<div class="scr off" id="sScrn">
  <div class="nav">
    <button type="button" class="nav-back" onclick="showMenu()">← Back</button>
    <span class="nav-t">SELECT FIGHTER</span>
    <span style="width:44px"></span>
  </div>
  <div class="sel-card" id="selCard" style="border-color:#6C63FF"></div>
  <div class="f-grid" id="fGrid"></div>
  <button class="next-btn" onclick="showArenaSelect()">SELECT ARENA →</button>
</div>

<!-- ARENA SELECT -->
<div class="scr off" id="aScrn">
  <div class="nav">
    <button type="button" class="nav-back" onclick="showSelect()">← Back</button>
    <span class="nav-t">SELECT ARENA</span>
    <span style="width:44px"></span>
  </div>
  <div id="aList" style="width:100%;max-width:340px"></div>
</div>

<!-- HUD -->
<div id="hud">
  <div class="hud-row">
    <div class="h-side">
      <div class="h-portrait" id="pPort" style="border-color:#6C63FF">🥷</div>
      <div class="h-bars">
        <div class="h-name" id="pName">SHADOW</div>
        <div class="hp-wrap"><div class="hp-fill" id="pHp" style="width:100%;background:#00FF77"></div></div>
        <div class="pw-wrap"><div class="pw-fill" id="pPw" style="width:0%"></div></div>
      </div>
    </div>
    <div class="h-ctr">
      <div class="h-pips" id="pPips"></div>
      <div class="h-round" id="hRound">R1</div>
      <div class="h-pips" id="ePips"></div>
    </div>
    <div class="h-side r">
      <div class="h-portrait" id="ePort" style="border-color:#FF3B3B">👑</div>
      <div class="h-bars" style="align-items:flex-end">
        <div class="h-name r" id="eName">THE KING</div>
        <div class="hp-wrap" style="width:100%"><div class="hp-fill" id="eHp" style="width:100%;background:#00FF77;float:right"></div></div>
        <div class="pw-wrap" style="width:100%"><div class="pw-fill" id="ePw" style="width:0%;float:right"></div></div>
      </div>
    </div>
  </div>
</div>

<div id="hitMsg"></div>
<div id="comboDiv"></div>

<!-- COUNTDOWN -->
<div id="cdDiv" style="display:none;flex-direction:column;align-items:center;justify-content:center;position:fixed;inset:0;z-index:25;background:rgba(0,0,0,.6)">
  <div class="cd-f" id="cdF">🥷 VS 👑</div>
  <div class="cd-r" id="cdR">ROUND 1</div>
  <div class="cd-n" id="cdN" style="color:#6C63FF">3</div>
</div>

<!-- KO -->
<div id="koDiv" style="display:none;align-items:center;justify-content:center;position:fixed;inset:0;z-index:25;background:rgba(0,0,0,.7)">
  <div class="ko-t">K.O.!</div>
</div>

<!-- GAME OVER -->
<div id="overDiv" style="display:none;flex-direction:column">
  <div class="ov-t" id="ovT">VICTORY!</div>
  <div class="ov-e" id="ovE">🥷</div>
  <div class="ov-n" id="ovN" style="color:#6C63FF">SHADOW</div>
  <div class="ov-s" id="ovS"></div>
  <button class="ov-btn" style="background:#6C63FF;margin-top:8px" onclick="rematch()">REMATCH</button>
  <button class="ov-btn" style="background:#222" onclick="showMenu()">MAIN MENU</button>
</div>

<!-- CONTROLS -->
<div id="ctrl">
  <div class="c-row">
    <button type="button" class="mb" style="border-color:#6C63FF" id="btnLight">
      <span class="mb-e">👊</span><span class="mb-l">LIGHT</span>
    </button>
    <button type="button" class="mb" style="border-color:#FF6B00" id="btnHeavy">
      <span class="mb-e">🤜</span><span class="mb-l">HEAVY</span>
    </button>
    <button type="button" class="mb" style="border-color:#FF3B3B" id="btnKick">
      <span class="mb-e">🦵</span><span class="mb-l">KICK</span>
    </button>
    <button type="button" class="mb" style="border-color:#00C3FF" id="btnGrab">
      <span class="mb-e">✊</span><span class="mb-l">GRAB</span>
    </button>
  </div>
  <div class="c-row">
    <button type="button" class="mb" style="border-color:#00FF77" id="btnBlock">
      <span class="mb-e">🛡️</span><span class="mb-l">BLOCK</span>
    </button>
    <button type="button" class="mb" style="border-color:#FFD700" id="btnDodge">
      <span class="mb-e">💨</span><span class="mb-l">DODGE</span>
    </button>
    <button type="button" class="mb" style="border-color:#CC00AA" id="btnCounter">
      <span class="mb-e">⚡</span><span class="mb-l">COUNTER</span>
    </button>
    <button type="button" class="mb ult-btn dim" id="ultBtn">
      <span class="mb-e" id="ultE">💥</span><span class="mb-l">ULTIMATE</span>
    </button>
  </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js"></script>
<script>
// ─── DATA ──────────────────────────────────────────────────────────────
const FIGHTERS=[
  {id:"shadow", name:"Shadow",   emoji:"🥷",  color:0x6C63FF, accent:0x9B8FFF, hex:"#6C63FF", aHex:"#9B8FFF", title:"Assassin",        tagline:"Unseen. Unstoppable.",            light:9,  heavy:17,kick:13,grab:12,ult:52,ultName:"Shadow Annihilation",ultE:"🌑"},
  {id:"cyber",  name:"Cypher",   emoji:"🤖",  color:0x00AAFF, accent:0x55CCFF, hex:"#00AAFF", aHex:"#55CCFF", title:"Cyber Soldier",   tagline:"Precision-engineered to destroy.", light:11, heavy:19,kick:14,grab:10,ult:48,ultName:"Neural Override",     ultE:"⚡"},
  {id:"ghost",  name:"Spectra",  emoji:"👻",  color:0xBB44FF, accent:0xDD88FF, hex:"#BB44FF", aHex:"#DD88FF", title:"Ghost Warrior",   tagline:"Can't fight what you can't see.",  light:8,  heavy:15,kick:12,grab:11,ult:55,ultName:"Phase Obliteration",  ultE:"🌀"},
  {id:"monk",   name:"Ember",    emoji:"🔥",  color:0xFF5500, accent:0xFF8833, hex:"#FF5500", aHex:"#FF8833", title:"Fire Monk",       tagline:"Forged in sacred flame.",          light:12, heavy:21,kick:16,grab:9, ult:46,ultName:"Inferno Judgement",   ultE:"💥"},
  {id:"boxer",  name:"Volt",     emoji:"⚡",  color:0xFFCC00, accent:0xFFEE55, hex:"#FFCC00", aHex:"#FFEE55", title:"Electric Boxer",  tagline:"10,000 volts of pure fury.",       light:14, heavy:16,kick:13,grab:10,ult:44,ultName:"Thunder Barrage",     ultE:"⚡"},
  {id:"samurai",name:"Kage",     emoji:"⚔️", color:0xCCCCCC, accent:0xFFFFFF, hex:"#CCCCCC", aHex:"#FFFFFF", title:"Dark Samurai",    tagline:"Honor died. He didn't.",           light:10, heavy:22,kick:15,grab:11,ult:50,ultName:"Void Execution",      ultE:"🌫️"},
  {id:"alien",  name:"Xeron",    emoji:"👾",  color:0x00FF88, accent:0x55FFAA, hex:"#00FF88", aHex:"#55FFAA", title:"Alien Gladiator", tagline:"From a dimension of pure war.",    light:11, heavy:18,kick:14,grab:13,ult:49,ultName:"Gravity Collapse",    ultE:"🌌"},
  {id:"king",   name:"The King", emoji:"👑",  color:0xFF00CC, accent:0xFF66DD, hex:"#FF00CC", aHex:"#FF66DD", title:"Invisible King",  tagline:"He rules from the shadows.",       light:13, heavy:20,kick:15,grab:12,ult:60,ultName:"OBLIVION",            ultE:"☠️"},
];

const ARENAS=[
  {name:"Neon City Rooftop",      emoji:"🏙️",colors:["#060022","#0d0040"],floor:0x6C63FF,fog:0x000014,light1:0x6C63FF,light2:0xFF00CC},
  {name:"Underground Fight Club", emoji:"🥊", colors:["#1a0000","#2d0000"],floor:0xFF3B3B,fog:0x120000,light1:0xFF3B3B,light2:0xFF8800},
  {name:"Burning Temple",         emoji:"🔥", colors:["#1a0500","#2d0c00"],floor:0xFF6600,fog:0x140400,light1:0xFF6600,light2:0xFFCC00},
  {name:"Rainy Alleyway",         emoji:"🌧️",colors:["#000d1a","#001828"],floor:0x0099FF,fog:0x000814,light1:0x0099FF,light2:0x00CCFF},
  {name:"Military Lab",           emoji:"🔬", colors:["#001a0a","#002d14"],floor:0x00FF88,fog:0x001008,light1:0x00FF88,light2:0x00CC44},
  {name:"Dimension Rift",         emoji:"🌌", colors:["#0a0020","#180045"],floor:0xCC44FF,fog:0x080015,light1:0xCC44FF,light2:0xFF88FF},
];

// ─── GAME STATE ─────────────────────────────────────────────────────────
let pF=FIGHTERS[0], eF=FIGHTERS[7], curArena=ARENAS[0];
let pHP=100,eHP=100,pPow=0,ePow=0,pWins=0,eWins=0;
let round=1, combo=0, busy=false, blocking=false, dodging=false;
let lastHit=0, aiTO=null, phase='menu';
let hitTimer=null, comboTimer=null;

// ─── THREE.JS ───────────────────────────────────────────────────────────
let renderer,scene,camera,clock;
let pMesh,eMesh;
let ptcls=[], ptclGeo, ptclMat, ptclMesh;
let shakeX=0,shakeY=0,shakeDecay=0;
let camBaseY=2.5,camBaseZ=9;
let sceneLights=[];
let arenaObjects=[];
let raf=null;

function initGL(){
  const W=window.innerWidth, H=window.innerHeight;
  scene=new THREE.Scene();
  camera=new THREE.PerspectiveCamera(54,W/H,.1,120);
  camera.position.set(0,camBaseY,camBaseZ);
  camera.lookAt(0,1.2,0);
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
  renderer.setSize(W,H);
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.1;
  document.body.insertBefore(renderer.domElement,document.body.firstChild);
  clock=new THREE.Clock();
  // Particle system (reusable pool)
  const MAX=600;
  ptclGeo=new THREE.BufferGeometry();
  const pos=new Float32Array(MAX*3);
  const col=new Float32Array(MAX*3);
  const siz=new Float32Array(MAX);
  ptclGeo.setAttribute('position',new THREE.BufferAttribute(pos,3));
  ptclGeo.setAttribute('color',new THREE.BufferAttribute(col,3));
  ptclGeo.setAttribute('size',new THREE.BufferAttribute(siz,1));
  ptclMat=new THREE.PointsMaterial({size:.08,vertexColors:true,transparent:true,opacity:1,sizeAttenuation:true,depthWrite:false});
  ptclMesh=new THREE.Points(ptclGeo,ptclMat);
  scene.add(ptclMesh);
  ptcls=Array.from({length:MAX},(_,i)=>({i,active:false,x:0,y:0,z:0,vx:0,vy:0,vz:0,life:0,maxLife:1,r:1,g:1,b:1}));
  window.addEventListener('resize',()=>{
    const nW=window.innerWidth,nH=window.innerHeight;
    camera.aspect=nW/nH; camera.updateProjectionMatrix();
    renderer.setSize(nW,nH);
  });
}

function buildArena(a){
  arenaObjects.forEach(o=>scene.remove(o));
  arenaObjects=[]; sceneLights.forEach(l=>scene.remove(l)); sceneLights=[];
  scene.fog=new THREE.FogExp2(a.fog,.045);
  scene.background=new THREE.Color(a.fog);
  // Floor
  const fGeo=new THREE.PlaneGeometry(16,10);
  const fMat=new THREE.MeshStandardMaterial({color:0x050008,roughness:.9,metalness:.1});
  const floor=new THREE.Mesh(fGeo,fMat);
  floor.rotation.x=-Math.PI/2;
  floor.receiveShadow=true;
  scene.add(floor); arenaObjects.push(floor);
  // Grid lines
  const grid=new THREE.GridHelper(16,24,a.floor,a.floor);
  grid.material.transparent=true;
  grid.material.opacity=.18;
  scene.add(grid); arenaObjects.push(grid);
  // Back wall glow plane
  const wGeo=new THREE.PlaneGeometry(16,6);
  const wMat=new THREE.MeshBasicMaterial({color:a.light1,transparent:true,opacity:.04});
  const wall=new THREE.Mesh(wGeo,wMat);
  wall.position.set(0,3,-4);
  scene.add(wall); arenaObjects.push(wall);
  // Ambient
  const amb=new THREE.AmbientLight(0x111133,2.5);
  scene.add(amb); sceneLights.push(amb);
  // Player spotlight
  const sl=new THREE.SpotLight(a.light1,5,14,Math.PI/4,.6,1.5);
  sl.position.set(-3,7,3); sl.target.position.set(-2.5,0,0);
  sl.castShadow=true; scene.add(sl); scene.add(sl.target);
  sceneLights.push(sl,sl.target);
  // Enemy spotlight
  const sr=new THREE.SpotLight(a.light2,5,14,Math.PI/4,.6,1.5);
  sr.position.set(3,7,3); sr.target.position.set(2.5,0,0);
  sr.castShadow=true; scene.add(sr); scene.add(sr.target);
  sceneLights.push(sr,sr.target);
  // Center light
  const ctr=new THREE.PointLight(0xffffff,.8,8);
  ctr.position.set(0,4,1);
  scene.add(ctr); sceneLights.push(ctr);
}

function makeMat(c,bright){
  return new THREE.MeshStandardMaterial({color:c,emissive:c,emissiveIntensity:bright||.7,roughness:.2,metalness:.9});
}

function buildFighter(f,side){
  const g=new THREE.Group();
  const c=f.color, a=f.accent;
  const cm=makeMat(c,.7), am=makeMat(a,1.2);
  // Torso
  const torso=new THREE.Mesh(new THREE.BoxGeometry(.65,1.0,.32),cm);
  torso.position.y=1.12; torso.castShadow=true; g.add(torso);
  // Neck
  const neck=new THREE.Mesh(new THREE.BoxGeometry(.22,.18,.22),cm);
  neck.position.y=1.69; g.add(neck);
  // Head
  const head=new THREE.Mesh(new THREE.BoxGeometry(.44,.44,.32),cm);
  head.position.y=1.95; head.castShadow=true; g.add(head);
  // Eye slit
  const eye=new THREE.Mesh(new THREE.BoxGeometry(.28,.07,.05),am);
  eye.position.set(0,1.97,.19); g.add(eye);
  // Shoulders
  [-1,1].forEach(sx=>{
    const sh=new THREE.Mesh(new THREE.BoxGeometry(.2,.2,.2),am);
    sh.position.set(sx*.44,1.56,0); g.add(sh);
  });
  // Arms
  const armL=new THREE.Mesh(new THREE.BoxGeometry(.22,.68,.22),cm);
  armL.position.set(-.44,1.12,0); g.add(armL);
  const armR=new THREE.Mesh(new THREE.BoxGeometry(.22,.68,.22),cm);
  armR.position.set(.44,1.12,0); g.add(armR);
  // Fists
  const fistL=new THREE.Mesh(new THREE.BoxGeometry(.26,.22,.26),am);
  fistL.position.set(-.44,.73,0); g.add(fistL);
  const fistR=new THREE.Mesh(new THREE.BoxGeometry(.26,.22,.26),am);
  fistR.position.set(.44,.73,0); g.add(fistR);
  // Belt
  const belt=new THREE.Mesh(new THREE.BoxGeometry(.7,.15,.34),am);
  belt.position.y=.59; g.add(belt);
  // Legs
  const legL=new THREE.Mesh(new THREE.BoxGeometry(.27,.82,.27),cm);
  legL.position.set(-.18,.4,0); g.add(legL);
  const legR=new THREE.Mesh(new THREE.BoxGeometry(.27,.82,.27),cm);
  legR.position.set(.18,.4,0); g.add(legR);
  // Boots
  const bL=new THREE.Mesh(new THREE.BoxGeometry(.3,.2,.34),am);
  bL.position.set(-.18,.0,0); g.add(bL);
  const bR=new THREE.Mesh(new THREE.BoxGeometry(.3,.2,.34),am);
  bR.position.set(.18,.0,0); g.add(bR);
  // Aura light
  const light=new THREE.PointLight(a,2.5,4.5);
  light.position.set(0,1.2,.6); g.add(light);
  g.position.x=side==='left'?-2.5:2.5;
  if(side==='right') g.rotation.y=Math.PI;
  g.castShadow=true;
  scene.add(g);
  return {group:g,torso,head,armL,armR,fistL,fistR,legL,legR,belt,light,
    origX:g.position.x,anim:null,animT:0,animDur:0,onDone:null,
    torsoOrigY:torso.position.y,armLOrigX:armL.position.x,armROrigX:armR.position.x,
    legLOrigY:legL.position.y,legROrigY:legR.position.y,
    fistLOrigX:fistL.position.x,fistROrigX:fistR.position.x
  };
}

function spawnBurst(x,y,z,hex,count){
  const r=parseInt(hex.slice(1,3),16)/255;
  const g2=parseInt(hex.slice(3,5),16)/255;
  const b=parseInt(hex.slice(5,7),16)/255;
  let spawned=0;
  for(let i=0;i<ptcls.length&&spawned<count;i++){
    const p=ptcls[i];
    if(!p.active){
      p.active=true; p.x=x; p.y=y; p.z=z;
      const spd=1.2+Math.random()*2.5;
      const th=Math.random()*Math.PI*2;
      const ph=Math.random()*Math.PI;
      p.vx=Math.sin(ph)*Math.cos(th)*spd;
      p.vy=Math.sin(ph)*Math.sin(th)*spd+.5;
      p.vz=Math.cos(ph)*spd*.4;
      p.life=0; p.maxLife=.4+Math.random()*.5;
      p.r=r; p.g=g2; p.b=b;
      spawned++;
    }
  }
}

function updatePtcls(dt){
  const pos=ptclGeo.attributes.position.array;
  const col=ptclGeo.attributes.color.array;
  const siz=ptclGeo.attributes.size.array;
  for(let i=0;i<ptcls.length;i++){
    const p=ptcls[i], idx=p.i*3;
    if(!p.active){pos[idx]=pos[idx+1]=pos[idx+2]=0;siz[p.i]=0;continue}
    p.life+=dt; p.vy-=4*dt;
    p.x+=p.vx*dt; p.y+=p.vy*dt; p.z+=p.vz*dt;
    const t=1-p.life/p.maxLife;
    pos[idx]=p.x; pos[idx+1]=p.y; pos[idx+2]=p.z;
    col[idx]=p.r; col[idx+1]=p.g; col[idx+2]=p.b;
    siz[p.i]=t*.12;
    if(p.life>=p.maxLife) p.active=false;
  }
  ptclGeo.attributes.position.needsUpdate=true;
  ptclGeo.attributes.color.needsUpdate=true;
  ptclGeo.attributes.size.needsUpdate=true;
}

// Simple tween animations per fighter
function startAnim(m,type,onDone){
  m.anim=type; m.animT=0;
  m.animDur=type==='light'?.22:type==='heavy'?.35:type==='kick'?.32:type==='hurt'?.28:type==='ult'?.6:.25;
  m.onDone=onDone||null;
}

function tickAnim(m,dt){
  if(!m.anim) return;
  m.animT+=dt;
  const t=Math.min(m.animT/m.animDur,1);
  const ease=t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
  const sin=Math.sin(ease*Math.PI);
  if(m.anim==='light'){
    // quick right punch
    m.armR.position.z=sin*0.5;
    m.fistR.position.z=sin*0.5;
  } else if(m.anim==='heavy'){
    // full body lunge + left arm
    m.group.position.z=m.anim==='heavy'?sin*.25:0;
    m.armL.position.z=sin*.7;
    m.fistL.position.z=sin*.7;
    m.torso.rotation.y=sin*.3;
  } else if(m.anim==='kick'){
    m.legR.position.z=sin*.6;
    m.legR.position.y=m.legROrigY+sin*.3;
  } else if(m.anim==='hurt'){
    m.group.position.x=m.origX+(t<.5?-sin*.25:sin*.15);
    m.torso.rotation.z=sin*.22*(m.origX>0?1:-1);
  } else if(m.anim==='ult'){
    const sc=1+sin*.35;
    m.group.scale.set(sc,sc,sc);
    m.light.intensity=2.5+sin*8;
  } else if(m.anim==='block'){
    m.armL.position.x=m.armLOrigX+(m.origX<0?.15:-.15);
    m.armR.position.x=m.armROrigX+(m.origX<0?-.15:.15);
    m.armL.position.z=sin*.2;
    m.armR.position.z=sin*.2;
  }
  if(t>=1){
    // reset
    m.armR.position.set(m.armROrigX,1.12,0);
    m.fistR.position.set(m.fistROrigX,.73,0);
    m.armL.position.set(m.armLOrigX,1.12,0);
    m.fistL.position.set(m.fistLOrigX,.73,0);
    m.legR.position.set(.18,m.legROrigY,0);
    m.legL.position.set(-.18,m.legLOrigY,0);
    m.group.position.x=m.origX;
    m.group.position.z=0;
    m.group.scale.set(1,1,1);
    m.torso.rotation.y=0;
    m.torso.rotation.z=0;
    m.light.intensity=2.5;
    const cb=m.onDone; m.anim=null; m.onDone=null;
    if(cb) cb();
  }
}

function idleTick(m,t){
  if(m.anim) return;
  const b=Math.sin(t*1.4)*.012;
  m.torso.scale.y=1+b;
  m.head.position.y=1.95+b*.5;
  m.light.intensity=2.2+Math.sin(t*2)*.6;
}

function shakeCam(intensity){
  shakeX=(Math.random()-.5)*intensity;
  shakeY=(Math.random()-.5)*intensity*.5;
  shakeDecay=intensity;
}

function doFlash(hex,ms){
  const el=document.getElementById('flash');
  el.style.background=hex; el.style.opacity='.45';
  setTimeout(()=>el.style.opacity='0',ms||120);
}

// ─── UI HELPERS ─────────────────────────────────────────────────────────
function hpColor(hp){return hp>55?'#00FF77':hp>28?'#FFD700':'#FF3B3B'}
function pct(v){return Math.max(0,Math.min(100,v))+'%'}

function updateHUD(){
  document.getElementById('pHp').style.width=pct(pHP);
  document.getElementById('pHp').style.background=hpColor(pHP);
  document.getElementById('eHp').style.width=pct(eHP);
  document.getElementById('eHp').style.background=hpColor(eHP);
  document.getElementById('pPw').style.width=pct(pPow);
  document.getElementById('ePw').style.width=pct(ePow);
  document.getElementById('hRound').textContent='R'+round;
  document.getElementById('ultBtn').classList.toggle('dim',pPow<100);
  document.getElementById('ultE').textContent=pF.ultE;
  // win pips
  ['pPips','ePips'].forEach((id,pi)=>{
    const wins=pi===0?pWins:eWins;
    const el=document.getElementById(id);
    el.innerHTML='';
    for(let i=0;i<wins;i++){
      const d=document.createElement('div');
      d.className='h-pip';
      d.style.background=pi===0?'#00FF77':'#FF3B3B';
      el.appendChild(d);
    }
  });
}

function showHitMsg(txt,col){
  if(hitTimer) clearTimeout(hitTimer);
  const el=document.getElementById('hitMsg');
  el.textContent=txt; el.style.color=col||'#FFD700'; el.style.opacity='1';
  hitTimer=setTimeout(()=>el.style.opacity='0',1000);
}

function showComboAnim(n){
  if(comboTimer) clearTimeout(comboTimer);
  const el=document.getElementById('comboDiv');
  el.textContent=n+'× COMBO';
  el.style.opacity='1';
  el.style.transform='translate(-50%,-50%) scale(1.5)';
  el.style.transition='transform .2s';
  requestAnimationFrame(()=>{ el.style.transform='translate(-50%,-50%) scale(1)'; });
  comboTimer=setTimeout(()=>el.style.opacity='0',1200);
}

// ─── DAMAGE ─────────────────────────────────────────────────────────────
function applyDmg(toPlayer,raw,unblockable){
  let dmg=raw;
  if(toPlayer){
    if(dodging) dmg=0;
    else if(blocking&&!unblockable) dmg=Math.max(1,Math.round(raw*.12));
    pHP=Math.max(0,pHP-dmg);
    if(dmg>0){ startAnim(pMesh,'hurt'); doFlash('#FF0000',100); shakeCam(.25); }
  } else {
    if(dmg>0){ startAnim(eMesh,'hurt'); doFlash(pF.hex,100); spawnBurst(eMesh.group.position.x+.3,1.4,.5,pF.hex,30); }
    eHP=Math.max(0,eHP-dmg);
  }
  updateHUD();
  return dmg;
}

// ─── PLAYER MOVES ────────────────────────────────────────────────────────
function doAttack(type){
  if(phase!=='fight'||busy) return;
  if(type==='grab') blocking=false;
  busy=true;
  const raw=pF[type]||pF.light;
  const newCombo=combo+1;
  const mult=newCombo<=1?1:newCombo<=3?1.15:newCombo<=5?1.3:1.5;
  const final=Math.round(raw*(1+(newCombo-1)*.08)*mult);
  startAnim(pMesh,type==='kick'?'kick':type==='heavy'?'heavy':'light',()=>{
    applyDmg(false,final,type==='grab');
    pPow=Math.min(100,pPow+(type==='light'?8:type==='heavy'?16:12));
    setCombo(newCombo);
    showHitMsg(newCombo>=3?newCombo+'× COMBO — '+final+' DMG!':type.toUpperCase()+' — '+final+' DMG',pF.hex);
    updateHUD(); busy=false; checkEnd();
  });
}

function doBlock(){
  if(phase!=='fight') return;
  blocking=true; setCombo(0);
  startAnim(pMesh,'block');
  showHitMsg('BLOCKING ✦','#00FF77');
  pPow=Math.min(100,pPow+5); updateHUD();
  setTimeout(()=>{ blocking=false; },800);
}

function doDodge(){
  if(phase!=='fight'||busy) return;
  dodging=true;
  showHitMsg('DODGE!','#FFD700');
  pPow=Math.min(100,pPow+6); updateHUD();
  setTimeout(()=>{ dodging=false; },600);
}

function doCounter(){
  if(phase!=='fight'||busy) return;
  if(Date.now()-lastHit<650){
    busy=true;
    const raw=Math.round(pF.heavy*1.6);
    startAnim(pMesh,'heavy',()=>{
      applyDmg(false,raw); pPow=Math.min(100,pPow+22);
      doFlash('#FFFFFF',180); shakeCam(.4);
      showHitMsg('COUNTER! '+raw+' DMG!','#FFD700');
      updateHUD(); busy=false; checkEnd();
    });
  } else showHitMsg('TOO SLOW!','#FF6B00');
}

function doUltimate(){
  if(phase!=='fight'||pPow<100) return;
  busy=true; pPow=0;
  doFlash(pF.aHex,300); shakeCam(.8);
  startAnim(pMesh,'ult',()=>{
    spawnBurst(eMesh.group.position.x,1.4,.5,pF.hex,80);
    applyDmg(false,pF.ult,true);
    showHitMsg(pF.ultName.toUpperCase()+'! '+pF.ult+' DMG','#FF00CC');
    setCombo(0); updateHUD(); busy=false; checkEnd();
  });
}

function setCombo(n){ combo=n; if(n>1) showComboAnim(n); }

// ─── AI ─────────────────────────────────────────────────────────────────
function scheduleAI(){
  if(aiTO) clearTimeout(aiTO);
  const delay=900+Math.random()*900;
  aiTO=setTimeout(aiAction,delay);
}

function aiAction(){
  if(phase!=='fight') return;
  const roll=Math.random();
  const lowHP=eHP<30;
  if(ePow>=100&&roll<.15){
    // AI ultimate
    doFlash(eF.hex,250); shakeCam(.6);
    startAnim(eMesh,'ult',()=>{
      spawnBurst(pMesh.group.position.x-.3,1.4,.5,eF.hex,60);
      lastHit=Date.now();
      applyDmg(true,eF.ult,true);
      ePow=0; setCombo(0);
      showHitMsg('ENEMY: '+eF.ultName.toUpperCase()+'!','#FF3B3B');
      updateHUD(); checkEnd();
    });
  } else if(lowHP&&roll<.3){
    // block or dodge
    if(roll<.15){ /* ai dodges (visual only) */ }
    else startAnim(eMesh,'block');
  } else if(roll<.45){
    const raw=eF.light+Math.floor(Math.random()*4);
    startAnim(eMesh,'light',()=>{
      lastHit=Date.now();
      const dmg=applyDmg(true,raw); ePow=Math.min(100,ePow+8);
      setCombo(0); if(dmg>0) showHitMsg('ENEMY STRIKE! '+dmg,'#FF4444');
      updateHUD(); checkEnd();
    });
  } else if(roll<.7){
    const raw=eF.heavy+Math.floor(Math.random()*5);
    startAnim(eMesh,'heavy',()=>{
      lastHit=Date.now();
      const dmg=applyDmg(true,raw); ePow=Math.min(100,ePow+16);
      setCombo(0); if(dmg>0){ shakeCam(.2); showHitMsg('ENEMY HEAVY! '+dmg,'#FF4444'); }
      updateHUD(); checkEnd();
    });
  } else if(roll<.85){
    const raw=eF.kick+Math.floor(Math.random()*4);
    startAnim(eMesh,'kick',()=>{
      lastHit=Date.now();
      const dmg=applyDmg(true,raw); ePow=Math.min(100,ePow+12);
      setCombo(0); if(dmg>0) showHitMsg('ENEMY KICK! '+dmg,'#FF4444');
      updateHUD(); checkEnd();
    });
  } else {
    startAnim(eMesh,'block');
  }
  scheduleAI();
}

// ─── ROUND LOGIC ─────────────────────────────────────────────────────────
function checkEnd(){
  if(pHP<=0) endRound('enemy');
  else if(eHP<=0) endRound('player');
}

function endRound(winner){
  if(aiTO) clearTimeout(aiTO);
  phase='ko';
  document.getElementById('koDiv').style.display='flex';
  setTimeout(()=>{
    document.getElementById('koDiv').style.display='none';
    if(winner==='player') pWins++; else eWins++;
    if(pWins>=2||eWins>=2){
      showGameOver(pWins>=2?'player':'enemy');
    } else {
      showRoundEnd(winner);
    }
  },2200);
}

function showRoundEnd(winner){
  phase='roundend';
  const won=winner==='player';
  const title=document.createElement('div');
  const overlay=document.createElement('div');
  overlay.style.cssText='position:fixed;inset:0;background:linear-gradient(180deg,#000,#0a001a);z-index:30;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px';
  overlay.innerHTML=
    '<div style="font-size:12px;color:#666;letter-spacing:3px;font-weight:700">ROUND '+round+' COMPLETE</div>'+
    '<div style="font-size:42px;font-weight:900;color:'+(won?'#00FF77':'#FF3B3B')+'">'+(won?'ROUND WIN!':'ROUND LOST')+'</div>'+
    '<div style="display:flex;gap:24px;align-items:center">'+
      '<div style="text-align:center">'+
        '<div style="font-size:14px;color:#fff;font-weight:700">'+pF.emoji+' You</div>'+
        '<div style="color:#00FF77;font-size:22px;font-weight:900">'+pWins+'</div>'+
      '</div>'+
      '<div style="color:#444;font-size:18px">&#8212;</div>'+
      '<div style="text-align:center">'+
        '<div style="font-size:14px;color:#fff;font-weight:700">'+eF.emoji+' Enemy</div>'+
        '<div style="color:#FF3B3B;font-size:22px;font-weight:900">'+eWins+'</div>'+
      '</div>'+
    '</div>'+
    '<button onclick="this.parentElement.remove();nextRound()" style="background:linear-gradient(90deg,#6C63FF,#FF00CC);border:none;color:#fff;font-size:14px;font-weight:900;padding:14px 32px;border-radius:14px;letter-spacing:2px;cursor:pointer;margin-top:8px;width:100%;max-width:280px">ROUND '+(round+1)+' &mdash; FIGHT &rarr;</button>';
  document.body.appendChild(overlay);
}

function nextRound(){
  round++;
  pHP=100; eHP=100; pPow=0; ePow=0;
  combo=0; blocking=false; dodging=false; busy=false;
  updateHUD();
  startCountdown();
}

function showGameOver(winner){
  phase='over';
  document.getElementById('ctrl').style.display='none';
  document.getElementById('hud').style.display='none';
  const ov=document.getElementById('overDiv');
  const won=winner==='player';
  document.getElementById('ovT').textContent=won?'VICTORY!':'DEFEATED!';
  document.getElementById('ovT').style.color=won?'#FFD700':'#FF3B3B';
  document.getElementById('ovE').textContent=won?pF.emoji:eF.emoji;
  document.getElementById('ovN').textContent=won?pF.name:eF.name;
  document.getElementById('ovN').style.color=won?pF.hex:eF.hex;
  document.getElementById('ovS').textContent=won?
    'You claimed the Invisible War throne!\\nThe shadows bow before you.':
    'You were not strong enough.\\nTrain and return, warrior.';
  ov.style.display='flex';
}

function rematch(){
  document.getElementById('overDiv').style.display='none';
  pHP=100;eHP=100;pPow=0;ePow=0;pWins=0;eWins=0;
  round=1;combo=0;blocking=false;dodging=false;busy=false;
  buildArena(curArena);
  buildFighters();
  updateHUD();
  startCountdown();
}

// ─── SCREEN NAV ─────────────────────────────────────────────────────────
function showMenu(){
  phase='menu';
  document.getElementById('mScrn').classList.remove('off');
  document.getElementById('sScrn').classList.add('off');
  document.getElementById('aScrn').classList.add('off');
  document.getElementById('hud').style.display='none';
  document.getElementById('ctrl').style.display='none';
  document.getElementById('overDiv').style.display='none';
}

function showSelect(){
  document.getElementById('mScrn').classList.add('off');
  document.getElementById('sScrn').classList.remove('off');
  document.getElementById('aScrn').classList.add('off');
  renderSelCard();
  renderFGrid();
}

function showArenaSelect(){
  document.getElementById('sScrn').classList.add('off');
  document.getElementById('aScrn').classList.remove('off');
  renderArenas();
}

function startFight(){
  document.getElementById('aScrn').classList.add('off');
  buildArena(curArena);
  buildFighters();
  pHP=100;eHP=100;pPow=0;ePow=0;
  combo=0;blocking=false;dodging=false;busy=false;
  updateHUD();
  startCountdown();
}

function startCountdown(){
  phase='countdown';
  document.getElementById('cdDiv').style.display='flex';
  document.getElementById('hud').style.display='none';
  document.getElementById('ctrl').style.display='none';
  document.getElementById('cdF').textContent=pF.emoji+' VS '+eF.emoji;
  document.getElementById('cdR').textContent='ROUND '+round;
  let n=3;
  document.getElementById('cdN').textContent=n;
  document.getElementById('cdN').style.color=curArena.colors[0]==='#060022'?'#6C63FF':'#FF3B3B';
  const t=setInterval(()=>{
    n--;
    if(n<=0){
      clearInterval(t);
      document.getElementById('cdDiv').style.display='none';
      document.getElementById('hud').style.display='block';
      document.getElementById('ctrl').style.display='block';
      phase='fight';
      scheduleAI();
    } else {
      document.getElementById('cdN').textContent=n;
    }
  },900);
  setTimeout(()=>{
    if(n>0){/* already started */}
    else{
      document.getElementById('cdN').textContent='FIGHT!';
      document.getElementById('cdN').style.color='#FFD700';
    }
  },2700);
}

function buildFighters(){
  if(pMesh){scene.remove(pMesh.group);}
  if(eMesh){scene.remove(eMesh.group);}
  pMesh=buildFighter(pF,'left');
  // pick random enemy different from player
  if(eF.id===pF.id){
    eF=FIGHTERS.find(f=>f.id!==pF.id)||FIGHTERS[7];
  }
  eMesh=buildFighter(eF,'right');
  // update HUD portraits
  document.getElementById('pPort').textContent=pF.emoji;
  document.getElementById('pPort').style.borderColor=pF.hex;
  document.getElementById('ePort').textContent=eF.emoji;
  document.getElementById('ePort').style.borderColor=eF.hex;
  document.getElementById('pName').textContent=pF.name.toUpperCase();
  document.getElementById('eName').textContent=eF.name.toUpperCase();
}

// ─── SELECT UI ────────────────────────────────────────────────────────────
function renderSelCard(){
  document.getElementById('selCard').style.borderColor=pF.hex;
  document.getElementById('selCard').innerHTML=
    '<div class="sel-e">'+pF.emoji+'</div>'+
    '<div class="sel-i">'+
      '<div class="sel-n" style="color:'+pF.hex+'">'+pF.name+'</div>'+
      '<div class="sel-r">'+pF.title+'</div>'+
      '<div class="sel-q">"'+pF.tagline+'"</div>'+
      '<div class="sel-u">💥 '+pF.ultName+'</div>'+
      '<div class="sel-s">'+
        '<span>👊 '+pF.light+'</span>'+
        '<span>🤜 '+pF.heavy+'</span>'+
        '<span>🦵 '+pF.kick+'</span>'+
        '<span style="color:'+pF.hex+'">⚡ '+pF.ult+'</span>'+
      '</div>'+
    '</div>';
}

function renderFGrid(){
  const g=document.getElementById('fGrid');
  g.innerHTML=FIGHTERS.map(f=>
    '<button type="button" class="f-card'+(f.id===pF.id?' on':'')+'" onclick="selFighter(\''+f.id+'\')" style="'+(f.id===pF.id?'border-color:'+f.hex:'')+'">'+
      '<span class="f-card-e">'+f.emoji+'</span>'+
      '<span class="f-card-n" style="color:'+(f.id===pF.id?f.hex:'#888')+'">'+f.name.toUpperCase()+'</span>'+
    '</button>'
  ).join('');
}

function selFighter(id){
  pF=FIGHTERS.find(f=>f.id===id);
  eF=FIGHTERS.filter(f=>f.id!==id)[Math.floor(Math.random()*(FIGHTERS.length-1))];
  renderSelCard(); renderFGrid();
}

function renderArenas(){
  document.getElementById('aList').innerHTML=ARENAS.map((a,i)=>
    '<button type="button" class="a-card'+(a.name===curArena.name?' on':'')+'" style="width:100%;'+(a.name===curArena.name?'border-color:#'+a.floor.toString(16).padStart(6,'0'):'')+'" onclick="selArena('+i+')">'+
      '<span class="a-e">'+a.emoji+'</span>'+
      '<div>'+
        '<div class="a-n" style="color:#'+a.floor.toString(16).padStart(6,'0')+'">'+a.name+'</div>'+
        '<div class="a-b" style="background:#'+a.floor.toString(16).padStart(6,'0')+'"></div>'+
      '</div>'+
      (a.name===curArena.name?'<span class="a-sel" style="color:#'+a.floor.toString(16).padStart(6,'0')+'">✓ SELECTED</span>':'')+
    '</button>'
  ).join('');
}

function selArena(i){
  curArena=ARENAS[i];
  renderArenas();
  setTimeout(startFight,200);
}

// ─── MENU SETUP ──────────────────────────────────────────────────────────
document.getElementById('mBadges').innerHTML=FIGHTERS.map(f=>
  '<div class="m-badge" style="border-color:'+f.hex+'">'+f.emoji+'</div>'
).join('');

// ─── GAME LOOP ───────────────────────────────────────────────────────────
initGL();

function loop(){
  raf=requestAnimationFrame(loop);
  const dt=Math.min(clock.getDelta(),.05);
  const t=clock.elapsedTime;
  // Camera shake
  if(shakeDecay>0){
    camera.position.x=shakeX*(shakeDecay/1);
    camera.position.y=camBaseY+shakeY*(shakeDecay/1);
    shakeDecay=Math.max(0,shakeDecay-dt*3);
    if(shakeDecay<=0){ camera.position.set(0,camBaseY,camBaseZ); }
  }
  if(pMesh){ tickAnim(pMesh,dt); idleTick(pMesh,t); }
  if(eMesh){ tickAnim(eMesh,dt); idleTick(eMesh,t); }
  updatePtcls(dt);
  renderer.render(scene,camera);
}
loop();

// Post-load: build a preview scene so the 3D is visible on menu
buildArena(ARENAS[0]);
buildFighters();
showMenu();

// ─── TOUCH SETUP ─────────────────────────────────────────────────────────
// Bind touchstart (passive:false) so buttons fire instantly on iOS/Android WebView
function bindTouch(id, fn) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('touchstart', function(e) {
    e.preventDefault();
    fn();
  }, { passive: false });
}
function setupCtrlTouches() {
  bindTouch('btnLight',   () => doAttack('light'));
  bindTouch('btnHeavy',   () => doAttack('heavy'));
  bindTouch('btnKick',    () => doAttack('kick'));
  bindTouch('btnGrab',    () => doAttack('grab'));
  bindTouch('btnBlock',   () => doBlock());
  bindTouch('btnDodge',   () => doDodge());
  bindTouch('btnCounter', () => doCounter());
  bindTouch('ultBtn',     () => doUltimate());
}
setupCtrlTouches();
</script>
</body>
</html>`;

export default function InvisibleWar() {
  const insets = useSafeAreaInsets();
  const webRef = useRef<InstanceType<typeof WebView>>(null);

  // On web (browser preview), react-native-webview is not available — use a native iframe
  if (Platform.OS === "web") {
    return (
      <View style={styles.root}>
        {/* @ts-ignore — iframe is valid in React Native Web */}
        <iframe
          srcDoc={GAME_HTML}
          style={{ width: "100%", height: "100%", border: "none", backgroundColor: "#000", display: "block" }}
          title="Invisible War"
          allow="autoplay"
        />
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: Platform.OS === "android" ? insets.top : 0 }]}>
      <WebView
        ref={webRef}
        source={{ html: GAME_HTML }}
        style={styles.web}
        originWhitelist={["*"]}
        javaScriptEnabled
        scrollEnabled={false}
        bounces={false}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        mixedContentMode="always"
        onMessage={(e) => {
          if (e.nativeEvent.data === "back") router.back();
        }}
      />
      {/* Back arrow overlay */}
      <TouchableOpacity
        style={[styles.backBtn, { top: (Platform.OS === "android" ? insets.top : 0) + 10 }]}
        onPress={() => router.back()}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={styles.backTxt}>←</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: "#000" },
  web:     { flex: 1, backgroundColor: "#000" },
  backBtn: { position: "absolute", left: 12, zIndex: 100, backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 10, width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  backTxt: { color: "#888", fontSize: 18, fontFamily: "Inter_700Bold" },
});
