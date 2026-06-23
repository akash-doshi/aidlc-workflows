/**
 * aidlc-dashboard-panel — the MCP-UI panel HTML for the AI-DLC dashboard.
 *
 * Served by aidlc-dashboard-mcp.ts at `ui://aidlc/panel` (MIME text/html;profile=mcp-app).
 * A flow-diagram visualization: phases as a connected spine, the active phase
 * expands into a numbered sub-flow of its stages, current stage emphasized.
 *
 * Theming: self-themed (the MCP sandbox does not reliably expose host --color-*
 * tokens, so we own the palette). Honors prefers-color-scheme; defaults to the
 * Codex dark register.
 *
 * State shape (structuredContent): { initialized, project, phase, currentStage,
 *   status, nextStage, phases[{name,status}], stages[{slug,state,suffix,number,name,phase}] }
 */

const STYLE = `
*{box-sizing:border-box}
:root{
  --bg:#0e0f11; --bg2:#16181b; --panel:#1b1e22;
  --fg:#f2f3f5; --fg2:#a8adb4; --fg3:#6b7077;
  --line:rgba(255,255,255,.08); --line2:rgba(255,255,255,.14);
  --accent:#4aa3ff; --accent-dim:rgba(74,163,255,.16);
  --ok:#2fb170; --ok-dim:rgba(47,177,112,.16);
  --warn:#f0883e; --warn-dim:rgba(240,136,62,.15);
  --rev:#a472f0; --rev-dim:rgba(164,114,240,.16);
  --font:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,sans-serif;
  --mono:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,monospace;
}
@media (prefers-color-scheme: light){
  :root{ --bg:#fbfbfc; --bg2:#fff; --panel:#fff; --fg:#16181b; --fg2:#5b616a;
    --fg3:#9aa0a8; --line:rgba(13,13,13,.09); --line2:rgba(13,13,13,.16); }
}
html,body{margin:0;height:100%}
body{background:var(--bg);color:var(--fg);font:13px/1.5 var(--font);
  -webkit-font-smoothing:antialiased;letter-spacing:-.1px;padding:20px 18px 28px}

.hd{margin-bottom:18px}
.kicker{font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--fg3)}
.title{font-size:17px;font-weight:680;letter-spacing:-.35px;margin:3px 0 0}
.nowcard{margin-top:14px;background:var(--panel);border:1px solid var(--line);
  border-radius:14px;padding:13px 15px;position:relative;overflow:hidden}
.nowcard::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--accent)}
.nowphase{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--accent)}
.nowstage{font-size:16px;font-weight:650;letter-spacing:-.3px;margin:2px 0 1px;display:flex;align-items:center;gap:8px}
.nowstage .pulse{width:7px;height:7px;border-radius:50%;background:var(--accent);
  box-shadow:0 0 0 0 var(--accent-dim);animation:pulse 2s infinite}
@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(74,163,255,.5)}70%{box-shadow:0 0 0 7px rgba(74,163,255,0)}100%{box-shadow:0 0 0 0 rgba(74,163,255,0)}}
.nowmeta{font-size:11.5px;color:var(--fg2)} .nowmeta b{color:var(--fg);font-weight:600}
@media (prefers-reduced-motion: reduce){.nowstage .pulse{animation:none}}

.gate{margin-top:12px;display:flex;align-items:center;gap:9px;background:var(--warn-dim);
  border:1px solid rgba(240,136,62,.4);border-radius:12px;padding:10px 13px;
  font-size:12px;font-weight:600;color:var(--warn)}
.gate .g-ic{flex:0 0 16px;width:16px;height:16px;border-radius:50%;background:var(--warn);
  color:var(--bg);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800}

.flow{margin-top:20px;position:relative}
.phase{position:relative;padding-left:30px;padding-bottom:6px}
.phase::before{content:"";position:absolute;left:10px;top:24px;bottom:-4px;width:2px;background:var(--line2)}
.phase:last-child::before{display:none}
.phase.done::before{background:var(--ok)}
.phase.active::before{background:linear-gradient(var(--accent) 40%,var(--line2))}
.phead{display:flex;align-items:center;gap:9px;min-height:26px}
.pnode{position:absolute;left:0;top:1px;width:22px;height:22px;border-radius:50%;
  display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;
  border:2px solid var(--fg3);color:var(--fg3);background:var(--bg)}
.phase.done .pnode{background:var(--ok);border-color:var(--ok);color:#06140d}
.phase.active .pnode{border-color:var(--accent);color:var(--accent);box-shadow:0 0 0 4px var(--accent-dim)}
.pname{font-size:13.5px;font-weight:650;letter-spacing:-.2px}
.phase:not(.active):not(.done) .pname{color:var(--fg3)}
.pbadge{font-size:9px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--fg3);
  border:1px solid var(--line2);border-radius:999px;padding:1px 7px}
.phase.active .pbadge{color:var(--accent);border-color:var(--accent-dim);background:var(--accent-dim)}
.phase.done .pbadge{color:var(--ok);border-color:var(--ok-dim);background:var(--ok-dim)}
.pcount{margin-left:auto;font-size:10.5px;color:var(--fg3);font-variant-numeric:tabular-nums}

.stages{margin:8px 0 16px;display:flex;flex-direction:column;gap:2px}
.snode{position:relative;display:flex;align-items:center;gap:10px;padding:6px 10px;border-radius:10px;border:1px solid transparent}
.snode.cur{background:var(--panel);border-color:var(--line2)}
.sdot{flex:0 0 18px;width:18px;height:18px;border-radius:50%;display:flex;align-items:center;
  justify-content:center;font-size:9px;font-weight:800;border:2px solid var(--fg3);color:var(--fg3);background:var(--bg2)}
.sdot.completed{background:var(--ok);border-color:var(--ok);color:#06140d}
.sdot.in-progress{border-color:var(--accent);color:var(--accent);box-shadow:0 0 0 3px var(--accent-dim)}
.sdot.awaiting-approval{background:var(--warn);border-color:var(--warn);color:var(--bg)}
.sdot.revising{border-color:var(--rev);color:var(--rev);box-shadow:0 0 0 3px var(--rev-dim)}
.sdot.skipped{border-style:dashed;opacity:.45}
.snum{font-family:var(--mono);font-size:10px;color:var(--fg3);flex:0 0 26px;font-variant-numeric:tabular-nums}
.sname{font-size:12.5px;letter-spacing:-.15px}
.snode.cur .sname{font-weight:650}
.sname.skipped{color:var(--fg3);text-decoration:line-through;text-decoration-thickness:1px}
.stag{margin-left:auto;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;padding:1px 6px;border-radius:999px}
.stag.awaiting-approval{color:var(--warn);background:var(--warn-dim)}
.stag.in-progress{color:var(--accent);background:var(--accent-dim)}
.stag.revising{color:var(--rev);background:var(--rev-dim)}

.empty{color:var(--fg3);font-size:13px;margin-top:28px;text-align:center}
`;

const BODY = `
<div id="root">
  <div class="hd">
    <div class="kicker">Project</div>
    <div class="title" id="project">—</div>
    <div class="nowcard" id="nowcard">
      <div class="nowphase" id="nowphase"></div>
      <div class="nowstage"><span class="pulse"></span><span id="nowstage">—</span></div>
      <div class="nowmeta" id="nowmeta"></div>
    </div>
    <div id="gate"></div>
  </div>
  <div class="flow" id="flow"></div>
  <div class="empty" id="empty" hidden>AI-DLC workflow not initialized in this workspace.</div>
</div>`;

const SCRIPT = `
(function(){
  var PHASES=["Initialization","Ideation","Inception","Construction","Operation"];
  var GLY={completed:"\\u2713","awaiting-approval":"!","revising":"\\u21ba"};
  var TAG={"awaiting-approval":"gate","in-progress":"active","revising":"revising"};
  function esc(s){return String(s==null?"":s).replace(/[&<>]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;"}[c];});}
  function host(){return window.openai||window.oai||(window.mcp&&window.mcp.app)||{};}
  function data(){var o=host();return o.toolOutput||o.toolInput||o.widgetData||(o.hostContext&&o.hostContext.toolOutput)||null;}
  function render(){
    var d=data();
    var empty=document.getElementById("empty"),hd=document.querySelector(".hd"),flow=document.getElementById("flow");
    if(!d||!d.initialized){empty.hidden=false;hd.style.display="none";flow.innerHTML="";return;}
    empty.hidden=true;hd.style.display="";
    document.getElementById("project").textContent=d.project||"Untitled workflow";
    document.getElementById("nowphase").textContent=(d.phase||"").toUpperCase();
    var cur=(d.stages||[]).filter(function(s){return s.state==="in-progress"||s.state==="awaiting-approval";})[0];
    document.getElementById("nowstage").textContent=(cur&&cur.name)||d.currentStage||"—";
    var nextNode=(d.stages||[]).filter(function(s){return s.slug===d.nextStage;})[0];
    var nextLabel=(nextNode&&nextNode.name)||d.nextStage||"\\u2014";
    document.getElementById("nowmeta").innerHTML="<b>"+esc(d.status||"")+"</b> \\u00b7 next: "+esc(nextLabel);
    var awaiting=(d.stages||[]).filter(function(s){return s.state==="awaiting-approval";})[0];
    document.getElementById("gate").innerHTML=awaiting?
      ('<div class="gate"><span class="g-ic">!</span>Awaiting your approval \\u2014 '+esc(awaiting.name||awaiting.slug)+"</div>"):"";

    var phStatus={};(d.phases||[]).forEach(function(p){phStatus[p.name]=p.status;});
    var byPhase={};PHASES.forEach(function(p){byPhase[p]=[];});
    (d.stages||[]).forEach(function(s){if(byPhase[s.phase])byPhase[s.phase].push(s);});

    flow.innerHTML=PHASES.map(function(name){
      var st=phStatus[name]||"Pending",active=st==="Active",done=st==="Verified";
      var stages=byPhase[name]||[];
      var inScope=stages.filter(function(s){return s.state!=="skipped";}).length;
      var doneN=stages.filter(function(s){return s.state==="completed";}).length;
      var cls=done?"done":active?"active":"";
      var html='<div class="phase '+cls+'">'+
        '<span class="pnode">'+(done?GLY.completed:"")+'</span>'+
        '<div class="phead"><span class="pname">'+esc(name)+'</span>'+
        '<span class="pbadge">'+esc(st)+'</span>'+
        '<span class="pcount">'+doneN+'/'+inScope+'</span></div>';
      if(active){
        html+='<div class="stages">'+stages.map(function(s){
          var sc=s.state,curCls=(sc==="in-progress"||sc==="awaiting-approval")?" cur":"";
          var tag=TAG[sc]?'<span class="stag '+sc+'">'+TAG[sc]+'</span>':"";
          return '<div class="snode'+curCls+'">'+
            '<span class="sdot '+sc+'">'+(GLY[sc]||"")+'</span>'+
            '<span class="snum">'+esc(s.number||"")+'</span>'+
            '<span class="sname '+(sc==="skipped"?"skipped":"")+'">'+esc(s.name||s.slug)+'</span>'+
            tag+'</div>';
        }).join("")+'</div>';
      }
      return html+'</div>';
    }).join("");
  }
  render();
  ["openai:set_globals","openai:set_theme","openai:tool_response","set_globals","message"].forEach(function(ev){
    window.addEventListener(ev,render);
  });
})();
`;

export const PANEL_HTML =
  '<!doctype html><html><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
  '<meta name="color-scheme" content="dark light">' +
  "<style>" + STYLE + "</style></head><body>" + BODY +
  "<script>" + SCRIPT + "</scr" + "ipt></body></html>";
