/**
 * aidlc-dashboard-panel — the MCP-UI panel HTML for the AI-DLC dashboard.
 *
 * Served by aidlc-dashboard-mcp.ts at `ui://aidlc/panel` (MIME text/html;profile=mcp-app).
 *
 * A LINEAR status board (Linear/Jira sensibility), not a node graph. Position +
 * state-colour convey the pipeline — there are NO connector lines. It shows only
 * the phases this run actually reaches (scope-shaped): a skipped/un-reached phase
 * is hidden, not drawn as dead cells. The protagonist is the single "what's
 * blocking?" signal — is the AI working, or is it waiting on YOU.
 *
 * Per-run truth comes from the state file + audit.md (joined by the server).
 * Self-themed (host tokens applied if present). No build step; the host bridge
 * is a vendored MCP-Apps protocol impl.
 */

const STYLE = `
*{box-sizing:border-box}
:root{
  --bg:#0c0d11; --row:#111217; --chip:#14161d; --chip-hover:#191c25;
  --fg:#e9eaf0; --fg-2:#9aa0b0; --fg-3:#6b7185;
  --line:#1f2230; --line-2:#2a2e3f;
  --accent:#5b6cff; --accent-soft:rgba(91,108,255,.16);
  --done:#3ecf8e; --done-soft:rgba(62,207,142,.14);
  --gate:#f5b542; --gate-soft:rgba(245,181,66,.16);
  --rev:#c79bff;
  --font:var(--vscode-font-family,-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,sans-serif);
  --mono:var(--vscode-editor-font-family,ui-monospace,SFMono-Regular,"SF Mono",Menlo,monospace);
  --ease:cubic-bezier(.4,0,.2,1);
}
:root[data-theme="light"]{
  --bg:#fbfbfc; --row:#fff; --chip:#fff; --chip-hover:#f5f6f9;
  --fg:#16181d; --fg-2:#5b616a; --fg-3:#8b909c;
  --line:#e7e8ee; --line-2:#d8dae3;
  --accent:#4856e6; --accent-soft:rgba(72,86,230,.1);
  --done:#0a9d63; --done-soft:rgba(10,157,99,.1);
  --gate:#c77d10; --gate-soft:rgba(199,125,16,.12); --rev:#7c3aed;
}
@media (prefers-color-scheme:light){:root:not([data-theme="dark"]){
  --bg:#fbfbfc; --row:#fff; --chip:#fff; --chip-hover:#f5f6f9;
  --fg:#16181d; --fg-2:#5b616a; --fg-3:#8b909c; --line:#e7e8ee; --line-2:#d8dae3;
  --accent:#4856e6; --accent-soft:rgba(72,86,230,.1); --done:#0a9d63; --done-soft:rgba(10,157,99,.1);
  --gate:#c77d10; --gate-soft:rgba(199,125,16,.12); --rev:#7c3aed;
}}
html,body{margin:0;height:100%}
body{background:var(--bg);color:var(--fg);font:13px/1.45 var(--font);letter-spacing:-.01em;
  -webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums;
  display:flex;flex-direction:column;height:100vh;overflow:hidden}

/* header */
.hd{display:flex;align-items:center;gap:8px;padding:14px 18px 0}
.mark{width:15px;height:15px;color:var(--fg-2);flex:0 0 15px}
.brand{font-size:12.5px;font-weight:600;letter-spacing:.01em}
.hd .sp{flex:1}
.proj{font-size:11px;color:var(--fg-3);font-weight:500;max-width:46%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

/* status banner — the protagonist */
.banner{margin:12px 18px 2px;padding:12px 14px;border:1px solid var(--line);border-radius:10px;background:var(--row);
  display:flex;align-items:center;gap:12px}
.banner.gate{border-color:var(--gate);background:var(--gate-soft)}
.banner .icon{flex:0 0 auto;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  font-size:13px;font-weight:800;background:var(--accent-soft);color:var(--accent)}
.banner.gate .icon{background:var(--gate);color:#1a1206}
.banner.done .icon{background:var(--done-soft);color:var(--done)}
.banner .txt{min-width:0;flex:1}
.banner .lead{font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--fg-3)}
.banner.gate .lead{color:var(--gate)}
.banner .what{font-size:15px;font-weight:650;letter-spacing:-.02em;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.banner .sub{font-size:11px;color:var(--fg-2);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.banner .sub code{font-family:var(--mono);font-size:10.5px;color:var(--fg-2)}

/* phase rows */
.board{flex:1 1 auto;min-height:0;overflow-y:auto;padding:6px 18px 16px}
.phase{padding:11px 0;border-bottom:1px solid var(--line)}
.phase:last-child{border-bottom:0}
.phrow{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.phdot{width:8px;height:8px;border-radius:50%;background:var(--fg-3);flex:0 0 8px}
.phase.active .phdot{background:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
.phase.verified .phdot{background:var(--done)}
.phname{font-size:10.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--fg-2)}
.phase.active .phname{color:var(--fg)}
.phcount{margin-left:auto;font-size:10.5px;color:var(--fg-3)}
.phase.verified .phcount{color:var(--done)}

/* stage rail — pills, no connectors */
.rail{display:flex;flex-wrap:wrap;gap:6px;padding-left:16px}
.pill{display:inline-flex;align-items:center;gap:7px;max-width:100%;
  border:1px solid var(--line);background:var(--chip);border-radius:8px;padding:6px 11px 6px 9px;
  transition:border-color .12s var(--ease),background .12s var(--ease)}
.pill .dot{width:7px;height:7px;border-radius:50%;flex:0 0 7px;border:1.5px solid var(--fg-3);background:transparent}
.pill .nm{font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pill .num{font-family:var(--mono);font-size:9.5px;color:var(--fg-3);flex:0 0 auto}
.pill.completed{opacity:.55}
.pill.completed .dot{background:var(--done);border-color:var(--done)}
.pill.completed:hover{opacity:1}
.pill.in-progress{border-color:var(--accent);background:var(--accent-soft)}
.pill.in-progress .dot{background:var(--accent);border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
.pill.in-progress .nm{font-weight:600}
.pill.awaiting-approval{border-color:var(--gate);background:var(--gate-soft)}
.pill.awaiting-approval .dot{background:var(--gate);border-color:var(--gate)}
.pill.awaiting-approval .nm{font-weight:600}
.pill.revising{border-color:var(--rev)}.pill.revising .dot{background:var(--rev);border-color:var(--rev);animation:pulse 2.4s ease-in-out infinite}
.pill.pending{opacity:.85}
.tag{font-size:9px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;padding:1px 6px;border-radius:999px;flex:0 0 auto}
.tag.gate{background:var(--gate);color:#1a1206}
.tag.now{background:var(--accent);color:#fff}
@keyframes pulse{0%,100%{opacity:.55}50%{opacity:1}}

/* collapsed (verified) phase: just a summary line, no pills */
.phase.collapsed .rail{display:none}
/* skipped phases: not rendered at all */

.empty{margin:auto;color:var(--fg-3);font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;text-align:center;padding:48px}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
`;

const BODY = `
<div class="hd">
  <svg class="mark" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M22.356 19.797H17.17M9.662 12.29l1.979 3.576a.511.511 0 0 1-.005.504l-1.974 3.409M30.758 16c0 8.15-6.607 14.758-14.758 14.758-8.15 0-14.758-6.607-14.758-14.758C1.242 7.85 7.85 1.242 16 1.242c8.15 0 14.758 6.608 14.758 14.758Z" stroke="currentColor" stroke-linecap="round" stroke-width="2.484"/></svg>
  <span class="brand">AI-DLC</span>
  <span class="sp"></span>
  <span class="proj" id="proj"></span>
</div>
<div class="banner" id="banner"></div>
<div class="board" id="board"><div class="empty" id="empty" hidden>workflow not initialized</div></div>`;

const SCRIPT = `
(function(){
  "use strict";
  function esc(s){return String(s==null?"":s).replace(/[&<>]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;"}[c];});}
  function pretty(a){if(!a)return"";if(a==="orchestrator")return"Orchestrator";
    return a.replace(/^aidlc-/,"").replace(/-agent$/,"").split("-").map(function(w){return w.charAt(0).toUpperCase()+w.slice(1);}).join(" ");}

  /* ---- vendored MCP-Apps host bridge ---- */
  var Host={state:null,mode:"inline"};
  function applyHostContext(c){
    if(!c)return;
    if(c.displayMode)Host.mode=c.displayMode;
    var vars=(c.styles&&c.styles.variables)||c.styleVariables;
    if(vars){var r=document.documentElement;for(var k in vars){if(k.indexOf("--")===0)r.style.setProperty(k,vars[k]);}}
    if(c.theme&&typeof c.theme==="string")document.documentElement.setAttribute("data-theme",c.theme.indexOf("light")>=0?"light":"dark");
  }
  function api(){return window.openai||window.oai||(window.mcp&&window.mcp.app)||{};}
  function readGlobals(){var o=api();Host.state=o.toolOutput||o.toolInput||o.widgetData||(o.hostContext&&o.hostContext.toolOutput)||Host.state;applyHostContext(o.hostContext||o);}
  function poll(){var o=api();if(typeof o.callServerTool==="function"){o.callServerTool({name:"aidlc_dashboard",arguments:{}}).then(function(r){var sc=r&&(r.structuredContent||(r.toolResult&&r.toolResult.structuredContent));if(sc){Host.state=sc;try{o.toolOutput=sc;}catch(e){}draw();}}).catch(function(){});}}

  function draw(){
    readGlobals();
    var d=Host.state, empty=document.getElementById("empty");
    if(!d||!d.initialized){empty.hidden=false;document.getElementById("banner").innerHTML="";document.getElementById("proj").textContent="";document.getElementById("board").querySelectorAll(".phase").forEach(function(n){n.remove();});return;}
    empty.hidden=true;
    document.getElementById("proj").textContent=d.project||"";

    var stages=d.stages||[];
    var cur=stages.filter(function(s){return s.state==="awaiting-approval";})[0]
          ||stages.filter(function(s){return s.state==="in-progress"||s.state==="revising";})[0];
    var agent=pretty(d.activeAgent);
    var inScope=stages.filter(function(s){return s.state!=="skipped";});
    var done=stages.filter(function(s){return s.state==="completed";}).length;

    // ── banner: the one "what's blocking?" signal ──
    var b=document.getElementById("banner"), kind, icon, lead, what, sub;
    var workflowDone=inScope.length>0 && done===inScope.length;
    if(cur&&cur.state==="awaiting-approval"){
      kind="gate"; icon="\\u25c6"; lead="needs you \\u00b7 approve to continue"; what=cur.name||cur.slug;
      sub=(agent?"by "+esc(agent)+" \\u00b7 ":"")+esc(d.phase||"");
    } else if(cur){
      kind=""; icon="\\u25b6"; lead=(agent?esc(agent)+" \\u00b7 working":"working"); what=cur.name||cur.slug;
      sub=esc(d.phase||"")+(d.lastArtifact?' \\u00b7 just wrote <code>'+esc(d.lastArtifact)+'</code>':'');
    } else if(workflowDone){
      kind="done"; icon="\\u2713"; lead="complete"; what="All stages approved"; sub=esc(d.phase||"");
    } else {
      kind=""; icon="\\u25b6"; lead=esc(d.status||"running"); what=(cur&&cur.name)||d.currentStage||d.phase||"\\u2014"; sub=esc(d.phase||"");
    }
    b.className="banner "+kind;
    b.innerHTML='<div class="icon">'+icon+'</div><div class="txt"><div class="lead">'+lead+'</div>'+
      '<div class="what">'+esc(what)+'</div><div class="sub">'+sub+'</div></div>';

    // ── phases: only those this run reaches (skip fully-skipped); current expanded, done collapsed ──
    var phases=(d.phases||[]);
    var board=document.getElementById("board");
    board.querySelectorAll(".phase").forEach(function(n){n.remove();});
    phases.forEach(function(p){
      if(p.status==="Skipped")return;                 // scope excluded → don't show at all
      var ps=stages.filter(function(s){return s.phase===p.name && s.state!=="skipped";});
      if(ps.length===0)return;                          // nothing in-scope here → skip
      var active=p.status==="Active", verified=p.status==="Verified";
      // a future (pending) phase the run hasn't reached: show as a thin collapsed header only
      var reached=active||verified||ps.some(function(s){return s.state!=="pending";});
      ps.sort(function(a,b2){return a.number.localeCompare(b2.number,undefined,{numeric:true});});
      var dn=ps.filter(function(s){return s.state==="completed";}).length;
      var collapsed=verified||!reached;
      var el=document.createElement("div");
      el.className="phase "+(active?"active":verified?"verified":"")+(collapsed?" collapsed":"");
      var head='<div class="phrow"><span class="phdot"></span><span class="phname">'+esc(p.name)+'</span>'+
        '<span class="phcount">'+(verified?"\\u2713 "+dn+" done":!reached?ps.length+" stages":dn+"/"+ps.length)+'</span></div>';
      var rail="";
      if(!collapsed){
        rail='<div class="rail">'+ps.map(function(s){
          var isCur=s.state==="in-progress"||s.state==="awaiting-approval";
          var tag=s.state==="awaiting-approval"?'<span class="tag gate">approve</span>':s.state==="in-progress"?'<span class="tag now">now</span>':"";
          return '<span class="pill '+s.state+'"><span class="dot"></span><span class="num">'+esc(s.number)+'</span>'+
            '<span class="nm">'+esc(s.name||s.slug)+'</span>'+tag+'</span>';
        }).join("")+'</div>';
      }
      el.innerHTML=head+rail;
      board.appendChild(el);
    });
  }

  document.addEventListener("DOMContentLoaded",draw);draw();
  ["openai:set_globals","openai:set_theme","openai:host_context","openai:tool_response","set_globals","message"].forEach(function(ev){
    window.addEventListener(ev,function(e){if(e&&e.data&&e.data.hostContext)applyHostContext(e.data.hostContext);draw();});
  });
  setInterval(poll,5000);
})();
`;

export const PANEL_HTML =
  '<!doctype html><html><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
  '<meta name="color-scheme" content="dark light">' +
  "<style>" + STYLE + "</style></head><body>" + BODY +
  "<script>" + SCRIPT + "</scr" + "ipt></body></html>";
