/**
 * aidlc-dashboard-panel — the MCP-UI panel HTML for the AI-DLC dashboard.
 *
 * Served by aidlc-dashboard-mcp.ts at `ui://aidlc/panel` (MIME text/html;profile=mcp-app).
 *
 * An editorial-schematic lifecycle map: phases are discovered from the data (NOT
 * hard-coded), drawn as a journey of dot+halo stage nodes connected by dotted
 * hairline rails. One rationed accent; the single active stage pulses. The whole
 * diagram is fit-to-frame (viewBox + preserveAspectRatio, scaled to the host's
 * container) so it always shows in full, edge/space-aware, at any canvas size.
 *
 * No build step: hand-authored HTML string. The host bridge is a vendored
 * (dependency-free) MCP-Apps protocol impl — reads theme/styleVariables/displayMode/
 * containerDimensions, receives tool results, toggles fullscreen↔inline, and
 * self-polls the tool so it reflects aidlc-state.md changes live.
 */

const STYLE = `
*{box-sizing:border-box}
:root{
  /* deliberate "warm graphite" surface — not the generic flat #181818 void */
  --paper:#15161a; --panel:#1b1d22; --raised:#24262c;
  --ink:#f4f2ee; --ink-2:rgba(244,242,238,.66); --ink-3:rgba(244,242,238,.40);
  --hair:rgba(244,242,238,.10); --hair-soft:rgba(244,242,238,.05);
  /* ONE rationed accent, used at many opacities */
  --accent:#ff7a2f; --accent-deep:#ff9354;
  --active:#3ecf8e; --active-glow:rgba(62,207,142,.5);
  --gate:#ffb454;
  --font:var(--vscode-font-family,-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,sans-serif);
  --mono:var(--vscode-editor-font-family,ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,monospace);
  --ease:cubic-bezier(.4,0,.2,1); --ease-decel:cubic-bezier(.16,1,.3,1);
}
:root[data-theme="light"]{
  --paper:#f5f3ef; --panel:#fbfaf8; --raised:#fff;
  --ink:#161d26; --ink-2:rgba(22,29,38,.66); --ink-3:rgba(22,29,38,.42);
  --hair:rgba(22,29,38,.10); --hair-soft:rgba(22,29,38,.06);
  --accent:#ff6200; --accent-deep:#c2410c; --active:#047857; --active-glow:rgba(16,185,129,.45); --gate:#e2820a;
}
@media (prefers-color-scheme: light){
  :root:not([data-theme="dark"]){
    --paper:#f5f3ef; --panel:#fbfaf8; --raised:#fff;
    --ink:#161d26; --ink-2:rgba(22,29,38,.66); --ink-3:rgba(22,29,38,.42);
    --hair:rgba(22,29,38,.10); --hair-soft:rgba(22,29,38,.06);
    --accent:#ff6200; --accent-deep:#c2410c; --active:#047857; --active-glow:rgba(16,185,129,.45); --gate:#e2820a;
  }
}
html,body{margin:0;height:100%}
body{background:var(--paper);color:var(--ink);font:13px/1.5 var(--font);
  -webkit-font-smoothing:antialiased;letter-spacing:-.1px;
  display:flex;flex-direction:column;height:100vh;overflow:hidden;position:relative}

/* ghost background glyph — depth without clutter */
.ghost{position:absolute;right:-2%;top:-6%;font:800 30vh/1 var(--font);color:var(--ink);
  opacity:.035;letter-spacing:-.04em;pointer-events:none;user-select:none;font-variant-numeric:tabular-nums;z-index:0}

.bar{position:relative;z-index:1;display:flex;align-items:center;gap:9px;padding:14px 18px 8px;flex:0 0 auto}
.mark{width:15px;height:15px;color:var(--accent);flex:0 0 15px}
.wordmark{font-size:12px;font-weight:700;letter-spacing:.04em}
.wordmark .dim{color:var(--ink-3);font-weight:500}
.bar .sp{flex:1}
.ctl{appearance:none;border:none;background:transparent;color:var(--ink-3);font:600 10px var(--font);
  letter-spacing:.12em;text-transform:uppercase;padding:5px 8px;cursor:pointer;border-radius:6px;
  transition:color .15s var(--ease),background-color .15s var(--ease)}
.ctl:hover{color:var(--ink);background:var(--hair-soft)}
.ctl:focus-visible{outline:none;box-shadow:0 0 0 1px var(--accent)}
.ctl.on{color:var(--accent)}

/* now strip: giant stage name vs tiny tracked meta */
.now{position:relative;z-index:1;flex:0 0 auto;padding:2px 18px 14px}
.now .ph{font-size:10px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:var(--accent)}
.now .stg{font-size:clamp(18px,3.4vw,28px);font-weight:800;letter-spacing:-.02em;line-height:1.05;margin-top:3px}
.now .meta{font-size:10.5px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-3);margin-top:6px}
.now .meta b{color:var(--ink-2);font-weight:600}
.now .meta .gated{color:var(--gate)}

/* the fit-to-frame canvas */
.canvas{position:relative;z-index:1;flex:1 1 auto;min-height:0;overflow:hidden;padding:0 14px 12px}
.canvas.scrollable{overflow:auto}
.canvas svg{display:block;width:100%;height:100%}
.canvas.scrollable svg{width:auto;height:auto}

/* schematic rail + nodes */
.rail{fill:none;stroke:var(--ink-3);stroke-width:1;stroke-dasharray:2 7;stroke-linecap:round;opacity:.5}
.edge{fill:none;stroke:var(--ink-3);stroke-width:1;stroke-dasharray:2 6;stroke-linecap:round;opacity:.38;
  transition:opacity .3s var(--ease),stroke .3s var(--ease)}
.edge.cur{stroke:var(--accent);opacity:.9;stroke-dasharray:none;stroke-width:1.4}
.edge.dim{opacity:.12}
.phase-label{font:700 10px var(--font);letter-spacing:.2em;text-transform:uppercase;fill:var(--ink-3)}
.tick{stroke:var(--hair);stroke-width:1}
.halo{opacity:0}
.node .dot{transition:r .2s var(--ease)}
.node .nm{font:700 8.5px var(--font);letter-spacing:.12em;text-transform:uppercase;fill:var(--ink-2)}
.node .num{font:600 7.5px var(--mono);fill:var(--ink-3)}
.node.cur .nm{fill:var(--ink)}
.node.skip .nm{fill:var(--ink-3);text-decoration:line-through}
.node.active-pulse .halo{opacity:1;animation:pulse 3.6s ease-in-out infinite}
@keyframes pulse{0%,100%{transform:scale(1);opacity:.85}50%{transform:scale(1.25);opacity:1}}
.empty{position:relative;z-index:1;margin:auto;color:var(--ink-3);font-size:12px;font-weight:600;
  letter-spacing:.06em;text-transform:uppercase;text-align:center;padding:48px 24px}
.detail{position:absolute;z-index:2;pointer-events:none;background:var(--raised);border:1px solid var(--hair);
  border-radius:8px;padding:7px 10px;font:600 9px var(--mono);letter-spacing:.04em;color:var(--ink-2);
  box-shadow:0 8px 24px rgba(0,0,0,.28);opacity:0;transition:opacity .12s var(--ease);max-width:220px}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
`;

const BODY = `
<div class="ghost" id="ghost"></div>
<div class="bar">
  <svg class="mark" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M22.356 19.797H17.17M9.662 12.29l1.979 3.576a.511.511 0 0 1-.005.504l-1.974 3.409M30.758 16c0 8.15-6.607 14.758-14.758 14.758-8.15 0-14.758-6.607-14.758-14.758C1.242 7.85 7.85 1.242 16 1.242c8.15 0 14.758 6.608 14.758 14.758Z" stroke="currentColor" stroke-linecap="round" stroke-width="2.484"/></svg>
  <span class="wordmark">AI-DLC <span class="dim">/ lifecycle</span></span>
  <span class="sp"></span>
  <button class="ctl" id="showAll">skipped</button>
  <button class="ctl" id="expandBtn"><span id="expandLbl">expand</span></button>
</div>
<div class="now" id="now"></div>
<div class="canvas" id="canvas"><div class="empty" id="empty" hidden>workflow not initialized</div></div>
<div class="detail" id="detail"></div>`;

const SCRIPT = `
(function(){
  "use strict";
  var SVGNS="http://www.w3.org/2000/svg";
  var GLY={completed:"\\u2713","awaiting-approval":"!","revising":"\\u21ba"};
  function esc(s){return String(s==null?"":s).replace(/[&<>]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;"}[c];});}
  function el(n,a){var e=document.createElementNS(SVGNS,n);for(var k in (a||{}))e.setAttribute(k,a[k]);return e;}
  function cssv(v){return getComputedStyle(document.documentElement).getPropertyValue(v).trim()||v;}

  /* ---- vendored MCP-Apps host bridge ---- */
  var Host={ state:null, mode:"inline", maxW:768, maxH:520 };
  function applyHostContext(c){
    if(!c)return;
    if(c.displayMode)Host.mode=c.displayMode;
    var dims=c.containerDimensions||c;
    if(dims&&dims.maxWidth)Host.maxW=dims.maxWidth;
    if(dims&&dims.maxHeight)Host.maxH=dims.maxHeight;
    var vars=(c.styles&&c.styles.variables)||c.styleVariables;
    if(vars){var r=document.documentElement;for(var k in vars){if(k.indexOf("--")===0)r.style.setProperty(k,vars[k]);}}
    if(c.theme&&typeof c.theme==="string")document.documentElement.setAttribute("data-theme",c.theme.indexOf("light")>=0?"light":"dark");
  }
  function api(){return window.openai||window.oai||(window.mcp&&window.mcp.app)||{};}
  function readGlobals(){
    var o=api();
    Host.state=o.toolOutput||o.toolInput||o.widgetData||(o.hostContext&&o.hostContext.toolOutput)||Host.state;
    applyHostContext(o.hostContext||o);
  }
  function setMode(mode){
    var o=api();
    try{ if(typeof o.requestDisplayMode==="function"){o.requestDisplayMode({mode:mode});} }catch(e){}
    try{ window.parent.postMessage({type:"mcp.requestDisplayMode",mode:mode},"*"); }catch(e){}
    try{ window.parent.postMessage({method:"requestDisplayMode",params:{mode:mode}},"*"); }catch(e){}
    Host.mode=mode; syncExpand(); draw();
  }
  function toggleMode(){ setMode(Host.mode==="fullscreen"?"inline":"fullscreen"); }
  function syncExpand(){ document.getElementById("expandLbl").textContent = Host.mode==="fullscreen"?"collapse":"expand"; }
  // self-poll so the panel reflects aidlc-state.md changes without a manual tool call.
  function poll(){
    var o=api();
    if(typeof o.callServerTool==="function"){
      o.callServerTool({name:"aidlc_dashboard",arguments:{}}).then(function(r){
        var sc=r&&(r.structuredContent||(r.toolResult&&r.toolResult.structuredContent));
        if(sc){ Host.state=sc; try{o.toolOutput=sc;}catch(e){} draw(); }
      }).catch(function(){});
    }
  }

  var showAll=false;

  /* ---- the schematic lifecycle map ---- */
  function draw(){
    readGlobals();
    var d=Host.state, empty=document.getElementById("empty"), canvas=document.getElementById("canvas");
    if(!d||!d.initialized){empty.hidden=false;document.getElementById("now").innerHTML="";document.getElementById("ghost").textContent="";var oc=canvas.querySelector("svg");if(oc)oc.remove();return;}
    empty.hidden=true;

    var phases=(d.phases||[]).map(function(p){return p.name;}); // DISCOVERED, not hard-coded
    var cur=(d.stages||[]).filter(function(s){return s.state==="in-progress"||s.state==="awaiting-approval";})[0];
    var nextNode=(d.stages||[]).filter(function(s){return s.slug===d.nextStage;})[0];
    var aw=(d.stages||[]).filter(function(s){return s.state==="awaiting-approval";})[0];

    // now strip
    document.getElementById("ghost").textContent=(d.phase||"").slice(0,4).toUpperCase();
    var done=(d.stages||[]).filter(function(s){return s.state==="completed";}).length;
    var total=(d.stages||[]).filter(function(s){return s.state!=="skipped";}).length;
    document.getElementById("now").innerHTML=
      '<div class="ph">'+esc(d.phase||"")+'</div>'+
      '<div class="stg">'+esc((cur&&cur.name)||d.currentStage||"\\u2014")+'</div>'+
      '<div class="meta">'+(aw?'<span class="gated">\\u25c6 awaiting approval</span>':'<b>'+esc(d.status||"")+'</b>')+
        ' \\u00b7 '+done+'/'+total+' done \\u00b7 next: '+esc((nextNode&&nextNode.name)||d.nextStage||"\\u2014")+'</div>';

    var stages=(d.stages||[]).filter(function(s){return showAll||s.state!=="skipped";});
    var byPhase={};phases.forEach(function(p){byPhase[p]=[];});
    stages.forEach(function(s){if(byPhase[s.phase])byPhase[s.phase].push(s);});
    var cols=phases.filter(function(p){return byPhase[p].length>0;});
    cols.forEach(function(p){byPhase[p].sort(function(a,b){return a.number.localeCompare(b.number,undefined,{numeric:true});});});

    // content-coordinate layout; SVG scales to the frame via viewBox.
    var COL_W=150, COL_GAP=20, ROW_H=40, PAD_T=26, PAD_L=18, DOT_X=14;
    var pos={};
    cols.forEach(function(p,ci){byPhase[p].forEach(function(s,ri){
      pos[s.slug]={x:PAD_L+ci*(COL_W+COL_GAP), y:PAD_T+ri*ROW_H, col:ci, row:ri};
    });});
    var maxRows=Math.max.apply(null,cols.map(function(p){return byPhase[p].length;}).concat([1]));
    var W=PAD_L+cols.length*COL_W+(cols.length-1)*COL_GAP+PAD_L;
    var H=PAD_T+maxRows*ROW_H+10;
    var curSlug=cur&&cur.slug;

    var svg=el("svg",{viewBox:"0 0 "+W+" "+H,preserveAspectRatio:"xMidYMin meet"});

    // phase column rails + labels + ticks (schematic chrome)
    cols.forEach(function(p,ci){
      var cx=PAD_L+ci*(COL_W+COL_GAP)+DOT_X;
      var n=byPhase[p].length;
      var y0=PAD_T+ROW_H/2, y1=PAD_T+(n-1)*ROW_H+ROW_H/2;
      // vertical dotted rail through the column's dots
      svg.appendChild(el("path",{d:"M "+cx+" "+y0+" L "+cx+" "+Math.max(y1,y0),class:"rail"}));
      var lbl=el("text",{x:PAD_L+ci*(COL_W+COL_GAP)+DOT_X+14,y:PAD_T-12,class:"phase-label"});
      lbl.textContent=p; svg.appendChild(lbl);
    });

    // edges: the reference keeps connections QUIET — nodes carry the weight.
    // We draw only the edges touching the current stage (its dependency path),
    // plus same-column sequence bows. Everything else stays implied by the rails.
    // This kills cross-column spaghetti while still showing the live dependency flow.
    stages.forEach(function(s){
      (s.requires_stage||[]).forEach(function(req){
        var f=pos[req],t=pos[s.slug]; if(!f||!t)return;
        var touchesCur=curSlug&&(s.slug===curSlug||req===curSlug);
        var sameCol=f.col===t.col;
        if(!touchesCur && !sameCol) return; // hide cross-column non-current edges
        var fx=f.x+DOT_X, fy=f.y+ROW_H/2, tx=t.x+DOT_X, ty=t.y+ROW_H/2;
        var cls="edge"+(touchesCur?" cur":"");
        var dd;
        if(sameCol){
          var gx=fx-9;
          dd="M "+fx+" "+fy+" C "+gx+" "+fy+", "+gx+" "+ty+", "+tx+" "+ty;
        } else {
          var k=26;
          dd="M "+fx+" "+fy+" C "+(fx+k)+" "+fy+", "+(tx-k)+" "+ty+", "+tx+" "+ty;
        }
        svg.appendChild(el("path",{d:dd,class:cls}));
      });
    });

    // nodes: dot + halo + tracked label (NOT boxes)
    stages.forEach(function(s){
      var p=pos[s.slug], st=s.state, isCur=s.slug===curSlug, done=st==="completed", gate=st==="awaiting-approval";
      var cx=p.x+DOT_X, cy=p.y+ROW_H/2;
      var color = gate?cssv("--gate") : isCur?cssv("--active") : done?cssv("--accent") : st==="revising"?cssv("--accent-deep") : st==="skipped"?cssv("--ink-3") : cssv("--ink-3");
      var g=el("g",{class:"node "+st+(isCur?" cur":"")+(isCur?" active-pulse":""),"data-slug":s.slug,transform:"translate(0,0)"});
      // halo (only meaningful on active; sized for all but invisible unless .active-pulse)
      var halo=el("circle",{class:"halo",cx:cx,cy:cy,r:13,fill:"url(#haloGrad)"});
      g.appendChild(halo);
      // tick
      g.appendChild(el("line",{class:"tick",x1:cx-5,y1:cy,x2:cx-9,y2:cy}));
      // dot
      var rad = done?4 : (isCur||gate)?5 : 3.2;
      var dot=el("circle",{class:"dot",cx:cx,cy:cy,r:rad,fill:(st==="skipped"||(!done&&!isCur&&!gate&&st!=="revising"))?"none":color,
        stroke:color,"stroke-width":(st==="pending"||st==="skipped")?1.3:0,"stroke-dasharray":st==="skipped"?"2 2":"0"});
      dot.setAttribute("style","filter:"+(isCur?"drop-shadow(0 0 6px "+cssv("--active-glow")+")":"none"));
      g.appendChild(dot);
      // paper-ring (punches dot off the rail)
      if(!(st==="pending"||st==="skipped")) g.appendChild(el("circle",{cx:cx,cy:cy,r:rad+2.2,fill:"none",stroke:cssv("--paper"),"stroke-width":2.2}));
      g.appendChild(dot); // re-add on top of ring
      // glyph in dot for done/gate/rev
      if(GLY[st]){var gl=el("text",{x:cx,y:cy+2.6,"text-anchor":"middle",fill:cssv("--paper"),"font-size":"6.5","font-weight":"800"});gl.textContent=GLY[st];g.appendChild(gl);}
      // label
      var num=el("text",{x:cx+12,y:cy-2,class:"num"}); num.textContent=s.number; g.appendChild(num);
      var nm=el("text",{x:cx+12,y:cy+7,class:"nm"});
      var t=s.name||s.slug; if(t.length>16)t=t.slice(0,15)+"\\u2026"; nm.textContent=t; g.appendChild(nm);
      // hover detail (produces) via a real DOM tooltip, positioned over the canvas
      g.style.cursor="default";
      g.addEventListener("mouseenter",function(){ showDetail(s, cx, cy); });
      g.addEventListener("mouseleave",hideDetail);
      svg.appendChild(g);
    });

    // halo gradient def
    var defs=el("defs",{});
    var rg=el("radialGradient",{id:"haloGrad"});
    rg.appendChild(el("stop",{offset:"0%","stop-color":cssv("--active"),"stop-opacity":"0.32"}));
    rg.appendChild(el("stop",{offset:"70%","stop-color":cssv("--active"),"stop-opacity":"0"}));
    defs.appendChild(rg); svg.insertBefore(defs,svg.firstChild);

    var old=canvas.querySelector("svg"); if(old)old.remove();
    canvas.appendChild(svg);

    // FIT-TO-FRAME: scale check. If content fits the host frame, let viewBox scale it
    // to 100%. If it can't fit legibly (scale would shrink below ~0.62), allow scroll.
    var availW=Host.maxW-28, availH=(Host.maxH||canvas.clientHeight||520)-10;
    var scale=Math.min(availW/W, availH/H, 1.4);
    if(scale < 0.6){ canvas.classList.add("scrollable"); svg.setAttribute("width",W); svg.setAttribute("height",H);
      if(curSlug&&pos[curSlug]){ /* one-time center, only when scrollable */ }
    } else { canvas.classList.remove("scrollable"); svg.removeAttribute("width"); svg.removeAttribute("height"); }
  }

  function showDetail(s,cx,cy){
    var det=document.getElementById("detail");
    var arts=(s.produces||[]);
    det.innerHTML='<div style="color:var(--ink);font-weight:700;letter-spacing:.04em">'+esc(s.number)+' '+esc(s.name||s.slug)+'</div>'+
      (arts.length?'<div style="margin-top:3px;color:var(--ink-3)">produces: '+esc(arts.join(", "))+'</div>':'');
    det.style.opacity="1";
    // position near top-left of canvas (simple, avoids overlap math)
    det.style.left="22px"; det.style.bottom="16px"; det.style.top="auto";
  }
  function hideDetail(){ document.getElementById("detail").style.opacity="0"; }

  document.getElementById("expandBtn").addEventListener("click",toggleMode);
  document.getElementById("showAll").addEventListener("click",function(){showAll=!showAll;this.classList.toggle("on",showAll);draw();});
  syncExpand(); draw();
  ["openai:set_globals","openai:set_theme","openai:host_context","openai:tool_response","set_globals","message"].forEach(function(ev){
    window.addEventListener(ev,function(e){ if(e&&e.data&&e.data.hostContext)applyHostContext(e.data.hostContext); syncExpand(); draw(); });
  });
  window.addEventListener("resize",draw);
  setInterval(poll, 5000); // reflect aidlc-state.md changes live
})();
`;

export const PANEL_HTML =
  '<!doctype html><html><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
  '<meta name="color-scheme" content="dark light">' +
  "<style>" + STYLE + "</style></head><body>" + BODY +
  "<script>" + SCRIPT + "</scr" + "ipt></body></html>";
