/**
 * aidlc-dashboard-panel — the MCP-UI panel HTML for the AI-DLC dashboard.
 *
 * Served by aidlc-dashboard-mcp.ts at `ui://aidlc/panel` (MIME text/html;profile=mcp-app).
 *
 * Adaptive DAG flow diagram (inspired by the road-to-aidlc reference): phases as
 * banded columns, stages as nodes, curved requires_stage edges, current-focused.
 * Progressive disclosure: only in-scope (non-skipped) nodes by default; artifact
 * pills on hover; full graph + skipped on expand.
 *
 * No build step: this is a hand-authored HTML string. The "host bridge" below is
 * a vendored (hand-written, dependency-free) implementation of the MCP-Apps host
 * protocol — it reads theme / styleVariables / displayMode / containerDimensions
 * from the host, receives live tool results, and can request fullscreen. It does
 * NOT import @modelcontextprotocol/ext-apps (which would need a bundler).
 *
 * Sizing facts (from the Codex app): inline frame is ~768px wide, height clamped
 * to [200, 720] (we hint 560); fullscreen/side-panel ≈ 600px+ wide, full height.
 */

const STYLE = `
*{box-sizing:border-box}
:root{
  --bg:#0e0f11; --bg2:#16181b; --panel:#1b1e22;
  --fg:#f2f3f5; --fg2:#a8adb4; --fg3:#6b7077;
  --line:rgba(255,255,255,.08); --line2:rgba(255,255,255,.16);
  --accent:#4aa3ff; --accent-dim:rgba(74,163,255,.18);
  --ok:#2fb170; --warn:#f0883e; --rev:#a472f0;
  /* per-phase palette (from the reference DAG) */
  --p-init:#94a3b8; --p-ide:#6366f1; --p-inc:#f59e0b; --p-con:#10b981; --p-ops:#ec4899;
  --font:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,sans-serif;
  --mono:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,monospace;
}
@media (prefers-color-scheme: light){
  :root{ --bg:#fbfbfc; --bg2:#fff; --panel:#fff; --fg:#16181b; --fg2:#5b616a;
    --fg3:#9aa0a8; --line:rgba(13,13,13,.09); --line2:rgba(13,13,13,.18); }
}
html,body{margin:0;height:100%}
body{background:var(--bg);color:var(--fg);font:13px/1.5 var(--font);
  -webkit-font-smoothing:antialiased;letter-spacing:-.1px;display:flex;flex-direction:column;height:100vh;overflow:hidden}

/* top bar */
.bar{display:flex;align-items:center;gap:8px;padding:12px 16px 10px;flex:0 0 auto}
.mark{width:16px;height:16px;color:var(--accent);flex:0 0 16px}
.wordmark{font-size:13px;font-weight:700;letter-spacing:-.2px}
.wordmark .dim{color:var(--fg3);font-weight:600}
.bar .sp{flex:1}
.expand{appearance:none;border:1px solid var(--line2);background:var(--panel);color:var(--fg2);
  font:600 11px var(--font);border-radius:7px;padding:4px 10px;cursor:pointer;display:inline-flex;align-items:center;gap:5px}
.expand:hover{border-color:var(--accent);color:var(--accent)}
.toggle{font:600 10.5px var(--font);color:var(--fg3);cursor:pointer;user-select:none;display:inline-flex;align-items:center;gap:5px}
.toggle input{accent-color:var(--accent)}

/* now strip */
.now{flex:0 0 auto;padding:0 16px 10px;display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
.now .ph{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--accent)}
.now .stg{font-size:15px;font-weight:650;letter-spacing:-.3px}
.now .meta{font-size:11.5px;color:var(--fg2);margin-left:auto} .now .meta b{color:var(--fg);font-weight:600}
.gate{flex:0 0 auto;margin:0 16px 10px;display:flex;align-items:center;gap:8px;background:rgba(240,136,62,.14);
  border:1px solid rgba(240,136,62,.4);border-radius:10px;padding:8px 12px;font-size:12px;font-weight:600;color:var(--warn)}
.gate .ic{flex:0 0 15px;width:15px;height:15px;border-radius:50%;background:var(--warn);color:var(--bg);
  display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800}

/* the DAG canvas */
.canvas{flex:1 1 auto;min-height:0;overflow:auto;padding:4px 12px 14px;text-align:left}
.canvas svg{display:block;margin:0}
.phase-band{fill:rgba(255,255,255,.025)}
@media (prefers-color-scheme: light){.phase-band{fill:rgba(13,13,13,.03)}}
.phase-label{font:700 9.5px var(--font);letter-spacing:.06em;text-transform:uppercase}
.edge{fill:none;stroke:var(--line2);stroke-width:1.5;opacity:.6}
.edge.cur{stroke:var(--accent);opacity:.95;stroke-width:2}
.edge.dim{opacity:.12}
.node rect{rx:7;stroke-width:1.5}
.node .num{font:700 9px var(--mono);fill:var(--fg3)}
.node .nm{font:600 11px var(--font)}
.node.cur rect{stroke-width:2.5}
.node.cur .glow{filter:drop-shadow(0 0 6px var(--accent))}
.node.skip rect{opacity:.4;stroke-dasharray:4 3}
.node.skip .nm{text-decoration:line-through}
.node:hover .pills{opacity:1}
.pills{opacity:0;transition:opacity .12s}
.pill rect{fill:var(--panel);stroke:var(--line2);stroke-width:1;rx:6}
.pill text{font:600 8.5px var(--mono);fill:var(--fg2)}
.empty{margin:auto;color:var(--fg3);font-size:13px;text-align:center;padding:40px}
`;

const BODY = `
<div class="bar">
  <svg class="mark" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M22.356 19.797H17.17M9.662 12.29l1.979 3.576a.511.511 0 0 1-.005.504l-1.974 3.409M30.758 16c0 8.15-6.607 14.758-14.758 14.758-8.15 0-14.758-6.607-14.758-14.758C1.242 7.85 7.85 1.242 16 1.242c8.15 0 14.758 6.608 14.758 14.758Z" stroke="currentColor" stroke-linecap="round" stroke-width="2.484"/></svg>
  <span class="wordmark">AI-DLC <span class="dim">· Lifecycle</span></span>
  <span class="sp"></span>
  <label class="toggle"><input type="checkbox" id="showAll"> show skipped</label>
  <button class="expand" id="expandBtn">⤢ Expand</button>
</div>
<div class="now" id="now"></div>
<div id="gate"></div>
<div class="canvas" id="canvas"><div class="empty" id="empty" hidden>AI-DLC workflow not initialized in this workspace.</div></div>`;

const SCRIPT = `
(function(){
  "use strict";
  var PHASES=["Initialization","Ideation","Inception","Construction","Operation"];
  var PVAR={Initialization:"--p-init",Ideation:"--p-ide",Inception:"--p-inc",Construction:"--p-con",Operation:"--p-ops"};
  var GLY={completed:"\\u2713","awaiting-approval":"!","revising":"\\u21ba"};
  var SVGNS="http://www.w3.org/2000/svg";
  function esc(s){return String(s==null?"":s).replace(/[&<>]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;"}[c];});}
  function el(n,a){var e=document.createElementNS(SVGNS,n);for(var k in (a||{}))e.setAttribute(k,a[k]);return e;}
  function cssv(v){return getComputedStyle(document.documentElement).getPropertyValue(v).trim()||v;}

  /* ---- vendored MCP-Apps host bridge (no SDK, no build) ---- */
  var Host={ state:null, ctx:{displayMode:"inline",maxWidth:768,maxHeight:560}, _port:null };
  function applyHostContext(c){
    if(!c)return;
    if(c.displayMode)Host.ctx.displayMode=c.displayMode;
    var dims=c.containerDimensions||c;
    if(dims&&dims.maxWidth)Host.ctx.maxWidth=dims.maxWidth;
    if(dims&&dims.maxHeight)Host.ctx.maxHeight=dims.maxHeight;
    // theme tokens (host may send VS Code-style vars)
    var vars=(c.styles&&c.styles.variables)||c.styleVariables;
    if(vars){var r=document.documentElement;for(var k in vars){if(k.indexOf("--")===0)r.style.setProperty(k,vars[k]);}}
    if(c.theme&&typeof c.theme==="string")document.documentElement.setAttribute("data-theme",c.theme);
  }
  function readGlobals(){
    var o=window.openai||window.oai||(window.mcp&&window.mcp.app)||{};
    Host.state=o.toolOutput||o.toolInput||o.widgetData||(o.hostContext&&o.hostContext.toolOutput)||Host.state;
    applyHostContext(o.hostContext||o);
  }
  // requestDisplayMode: try the known host call shapes, degrade silently.
  function requestFullscreen(){
    var o=window.openai||{};
    try{ if(typeof o.requestDisplayMode==="function"){o.requestDisplayMode({mode:"fullscreen"});return;} }catch(e){}
    try{ window.parent.postMessage({type:"mcp.requestDisplayMode",mode:"fullscreen"},"*"); }catch(e){}
    try{ window.parent.postMessage({method:"requestDisplayMode",params:{mode:"fullscreen"}},"*"); }catch(e){}
  }

  /* ---- adaptive DAG renderer ---- */
  function render(){
    readGlobals();
    var d=Host.state, empty=document.getElementById("empty");
    var showAll=document.getElementById("showAll").checked;
    if(!d||!d.initialized){empty.hidden=false;document.getElementById("now").innerHTML="";document.getElementById("gate").innerHTML="";return;}
    empty.hidden=true;

    // now strip
    var cur=(d.stages||[]).filter(function(s){return s.state==="in-progress"||s.state==="awaiting-approval";})[0];
    var nextNode=(d.stages||[]).filter(function(s){return s.slug===d.nextStage;})[0];
    document.getElementById("now").innerHTML=
      '<span class="ph">'+esc((d.phase||"").toUpperCase())+'</span>'+
      '<span class="stg">'+esc((cur&&cur.name)||d.currentStage||"\\u2014")+'</span>'+
      '<span class="meta"><b>'+esc(d.status||"")+'</b> \\u00b7 next: '+esc((nextNode&&nextNode.name)||d.nextStage||"\\u2014")+'</span>';
    var aw=(d.stages||[]).filter(function(s){return s.state==="awaiting-approval";})[0];
    document.getElementById("gate").innerHTML=aw?('<div class="gate"><span class="ic">!</span>Awaiting your approval \\u2014 '+esc(aw.name||aw.slug)+"</div>"):"";

    // which stages to show: in-scope (non-skipped) unless showAll
    var shown=(d.stages||[]).filter(function(s){return showAll||s.state!=="skipped";});
    var shownSet={};shown.forEach(function(s){shownSet[s.slug]=s;});

    // layout: phase columns × rows
    var COL_W=176, COL_GAP=26, NODE_W=150, NODE_H=34, ROW_H=42, PAD_T=30, PAD_L=22;
    var byPhase={};PHASES.forEach(function(p){byPhase[p]=[];});
    shown.forEach(function(s){if(byPhase[s.phase])byPhase[s.phase].push(s);});
    // keep only phases that have shown nodes (progressive disclosure of empty phases)
    var cols=PHASES.filter(function(p){return byPhase[p].length>0;});
    cols.forEach(function(p){byPhase[p].sort(function(a,b){return a.number.localeCompare(b.number,undefined,{numeric:true});});});
    var pos={};
    cols.forEach(function(p,ci){byPhase[p].forEach(function(s,ri){pos[s.slug]={x:PAD_L+ci*(COL_W+COL_GAP),y:PAD_T+ri*ROW_H};});});
    var maxRows=Math.max.apply(null,cols.map(function(p){return byPhase[p].length;}).concat([1]));
    var W=PAD_L+cols.length*COL_W+(cols.length-1)*COL_GAP+PAD_L;
    var H=PAD_T+maxRows*ROW_H+10;

    var svg=el("svg",{viewBox:"0 0 "+W+" "+H,width:W,height:H});
    // phase bands + labels
    cols.forEach(function(p,ci){
      var x=PAD_L+ci*(COL_W+COL_GAP)-6;
      svg.appendChild(el("rect",{x:x,y:PAD_T-8,width:COL_W+12,height:H-PAD_T+2,rx:8,class:"phase-band"}));
      var t=el("text",{x:x+(COL_W+12)/2,y:PAD_T-14,"text-anchor":"middle",class:"phase-label",fill:cssv(PVAR[p])});
      t.textContent=p; svg.appendChild(t);
    });
    // edges (requires_stage among shown nodes), current-focused
    var curSlug=cur&&cur.slug;
    shown.forEach(function(s){
      (s.requires_stage||[]).forEach(function(req){
        var f=pos[req],t=pos[s.slug]; if(!f||!t)return;
        var touchesCur=curSlug&&(s.slug===curSlug||req===curSlug);
        var cls="edge"+(touchesCur?" cur":(curSlug?" dim":""));
        var dd;
        if(Math.abs(f.x-t.x)<2){
          // same column → route down the LEFT gutter so it doesn't cross node text
          var gx=f.x-7, ya=f.y+NODE_H/2, yb=t.y+NODE_H/2;
          dd="M "+f.x+" "+ya+" C "+gx+" "+ya+", "+gx+" "+yb+", "+t.x+" "+yb;
        } else {
          // cross column → curve from right edge of source to left edge of target
          var x1=f.x+NODE_W,y1=f.y+NODE_H/2,x2=t.x,y2=t.y+NODE_H/2,dx=(x2-x1)*0.5;
          dd="M "+x1+" "+y1+" C "+(x1+dx)+" "+y1+", "+(x2-dx)+" "+y2+", "+x2+" "+y2;
        }
        svg.appendChild(el("path",{d:dd,class:cls}));
      });
    });
    // nodes
    shown.forEach(function(s){
      var p=pos[s.slug]; var pc=cssv(PVAR[s.phase]);
      var g=el("g",{class:"node "+s.state+(s.slug===curSlug?" cur":""),transform:"translate("+p.x+","+p.y+")"});
      var done=s.state==="completed", isCur=s.slug===curSlug, gate=s.state==="awaiting-approval";
      var fill = s.state==="skipped" ? "transparent" : (done? pc : isCur? cssv("--accent-dim") : gate? "rgba(240,136,62,.18)" : "var(--bg2)");
      var stroke = gate? cssv("--warn") : isCur? cssv("--accent") : done? pc : (s.state==="revising"? cssv("--rev"): cssv("--line2"));
      var rect=el("rect",{width:NODE_W,height:NODE_H,rx:7,fill:fill,stroke:stroke,"stroke-width":isCur||gate?2.5:1.5});
      if(isCur)rect.setAttribute("class","glow");
      g.appendChild(rect);
      var num=el("text",{x:9,y:14,class:"num"}); num.textContent=s.number; g.appendChild(num);
      var nm=el("text",{x:9,y:25,class:"nm",fill:done?cssv("--bg"):cssv("--fg")});
      var nmTxt=s.name||s.slug; if(nmTxt.length>20)nmTxt=nmTxt.slice(0,19)+"\\u2026";
      nm.textContent=nmTxt; g.appendChild(nm);
      // status glyph badge
      if(GLY[s.state]){var b=el("text",{x:NODE_W-13,y:23,"text-anchor":"middle",class:"num",fill:done?cssv("--bg"):stroke,"font-size":"11"});b.textContent=GLY[s.state];g.appendChild(b);}
      // artifact pills (hover, progressive disclosure) — show 'produces'
      if((s.produces||[]).length){
        var pg=el("g",{class:"pills"});
        s.produces.slice(0,3).forEach(function(art,i){
          var pw=Math.min(86,8+art.length*5.4), px=NODE_W-pw, py=NODE_H+4+i*16;
          var pp=el("g",{class:"pill",transform:"translate("+px+","+py+")"});
          pp.appendChild(el("rect",{width:pw,height:13,rx:6}));
          var pt=el("text",{x:6,y:9}); pt.textContent=art.length>11?art.slice(0,10)+"\\u2026":art; pp.appendChild(pt);
          pg.appendChild(pp);
        });
        g.appendChild(pg);
      }
      svg.appendChild(g);
    });
    var c=document.getElementById("canvas");
    var old=c.querySelector("svg"); if(old)old.remove();
    c.appendChild(svg);
    // scroll current into view only if it's outside the visible band (gentle)
    if(curSlug&&pos[curSlug]){
      var nx=pos[curSlug].x, vis=c.clientWidth, sl=c.scrollLeft;
      if(nx < sl+10 || nx+NODE_W > sl+vis-10){ c.scrollLeft=Math.max(0, nx-(vis-NODE_W)/2); }
    }
  }

  document.getElementById("expandBtn").addEventListener("click",requestFullscreen);
  document.getElementById("showAll").addEventListener("change",render);
  render();
  ["openai:set_globals","openai:set_theme","openai:tool_response","openai:host_context","set_globals","message"].forEach(function(ev){
    window.addEventListener(ev,function(e){ if(e&&e.data&&e.data.hostContext)applyHostContext(e.data.hostContext); render(); });
  });
  window.addEventListener("resize",render);
})();
`;

export const PANEL_HTML =
  '<!doctype html><html><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
  '<meta name="color-scheme" content="dark light">' +
  "<style>" + STYLE + "</style></head><body>" + BODY +
  "<script>" + SCRIPT + "</scr" + "ipt></body></html>";
