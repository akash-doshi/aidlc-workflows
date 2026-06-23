/**
 * aidlc-dashboard-panel — the MCP-UI panel HTML for the AI-DLC dashboard.
 *
 * Served by aidlc-dashboard-mcp.ts at `ui://aidlc/panel` (MIME text/html;profile=mcp-app).
 * Design: aidlc-docs/inception/refined-mockups/* + codex-design-system.md.
 *
 * Rules (provable in tests):
 *  - Host-theme ONLY: colors/fonts come from MCP Apps SDK host context
 *    (window.openai theme/styleVariables). NO hardcoded brand hex.
 *  - Near-zero prose. Flex rows on a 4px baseline (no absolute-positioned dots).
 *  - Renders all 6 checkbox states + 5 phases from injected state.
 *  - Reactive: re-renders on host data push; displayMode adapts inline/tab.
 */

const STYLE = `
:root{
  color-scheme: light dark;
  /* every value falls back to a host token; no brand hex literals */
  --bg: var(--color-background-primary, Canvas);
  --bg2: var(--color-background-secondary, color-mix(in srgb, CanvasText 8%, Canvas));
  --fg: var(--color-text-primary, CanvasText);
  --fg2: var(--color-text-secondary, color-mix(in srgb, CanvasText 62%, Canvas));
  --fg3: var(--color-text-tertiary, color-mix(in srgb, CanvasText 38%, Canvas));
  --line: var(--color-border-primary, color-mix(in srgb, CanvasText 12%, Canvas));
  --accent: var(--color-text-accent, AccentColor);
  --ok: var(--color-text-success, var(--color-icon-success, green));
  --warn: var(--color-text-warning, var(--color-icon-warning, orange));
  --rev: var(--color-text-info, var(--accent));
  --font: var(--font-sans, -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);
  --mono: var(--font-mono, ui-monospace,SFMono-Regular,"SF Mono",Menlo,monospace);
  --u: 4px;
}
*{box-sizing:border-box}
html,body{margin:0;height:100%}
body{background:var(--bg);color:var(--fg);font:14px/1.45 var(--font);
  font-weight:500;letter-spacing:-.1px;-webkit-font-smoothing:antialiased;
  padding:calc(var(--u)*4) calc(var(--u)*5)}
.row{display:flex;align-items:center;gap:calc(var(--u)*2);min-height:calc(var(--u)*9)}
.lbl{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--fg3);font-weight:600}
.proj{font-size:16px;font-weight:600;letter-spacing:-.3px;margin:2px 0 0}
.phase{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--accent)}
.stage{font-size:18px;font-weight:600;letter-spacing:-.4px;margin:1px 0 0}
.meta{font-size:12px;color:var(--fg2);margin-top:2px}
.meta b{color:var(--fg);font-weight:600}
.gate{margin:calc(var(--u)*3) 0;padding:calc(var(--u)*2) calc(var(--u)*3);
  border:1px solid color-mix(in srgb, var(--warn) 45%, transparent);
  background:color-mix(in srgb, var(--warn) 12%, transparent);
  border-radius:var(--border-radius-md, 8px);font-size:12.5px;font-weight:600;color:var(--warn)}
.spine{margin-top:calc(var(--u)*4);border-top:1px solid var(--line)}
.node{padding:calc(var(--u)*1) 0}
.node .row .nm{font-size:13px;font-weight:600;letter-spacing:-.2px}
.node.muted .nm{color:var(--fg3)}
.cnt{margin-left:auto;font-size:11px;color:var(--fg3);font-variant-numeric:tabular-nums}
.st{font-size:9.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--fg3)}
.st.active{color:var(--accent)} .st.verified{color:var(--ok)}
.sub{margin:calc(var(--u)*1) 0 calc(var(--u)*2) calc(var(--u)*5)}
.srow{display:flex;align-items:center;gap:calc(var(--u)*2);min-height:calc(var(--u)*7);font-size:12.5px}
.dot{flex:0 0 14px;width:14px;height:14px;border-radius:50%;display:flex;align-items:center;
  justify-content:center;font-size:9px;font-weight:800;border:2px solid var(--fg3);color:var(--fg3);background:var(--bg)}
.dot.completed{background:var(--ok);border-color:var(--ok);color:var(--bg)}
.dot.in-progress{border-color:var(--accent);color:var(--accent)}
.dot.awaiting-approval{background:var(--warn);border-color:var(--warn);color:var(--bg)}
.dot.revising{border-color:var(--rev);color:var(--rev)}
.dot.skipped{border-style:dashed;opacity:.5}
.sname.skipped{color:var(--fg3);text-decoration:line-through}
.snum{margin-left:auto;font-family:var(--mono);font-size:10px;color:var(--fg3)}
.empty{color:var(--fg3);font-size:13px;margin-top:calc(var(--u)*4)}
`;

const BODY = `
<div id="root">
  <div class="lbl">Project</div>
  <div class="proj" id="project">—</div>
  <div class="phase" id="phase"></div>
  <div class="stage" id="stage">—</div>
  <div class="meta" id="meta"></div>
  <div id="gate"></div>
  <div class="spine" id="spine"></div>
  <div class="empty" id="empty" hidden>AI-DLC workflow not initialized in this workspace.</div>
</div>`;

const SCRIPT = `
(function(){
  var PHASES=["Initialization","Ideation","Inception","Construction","Operation"];
  var GLY={completed:"\\u2713","awaiting-approval":"!",revising:"\\u21ba","in-progress":"","pending":"","skipped":""};
  function esc(s){return String(s==null?"":s).replace(/[&<>]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;"}[c];});}
  function host(){return window.openai||window.oai||(window.mcp&&window.mcp.app)||{};}
  function state(){var o=host();return o.toolOutput||o.toolInput||o.widgetData||(o.hostContext&&o.hostContext.toolOutput)||null;}
  function render(){
    var d=state();
    var root=document.getElementById("root"),empty=document.getElementById("empty");
    if(!d||!d.initialized){empty.hidden=false;document.getElementById("spine").innerHTML="";
      document.getElementById("project").textContent="—";document.getElementById("stage").textContent="—";
      document.getElementById("phase").textContent="";document.getElementById("meta").innerHTML="";
      document.getElementById("gate").innerHTML="";return;}
    empty.hidden=true;
    document.getElementById("project").textContent=d.project||"Untitled";
    document.getElementById("phase").textContent=(d.phase||"").toUpperCase();
    document.getElementById("stage").textContent=d.currentStage||"—";
    document.getElementById("meta").innerHTML="<b>"+esc(d.status||"")+"</b> \\u00b7 next: "+esc(d.nextStage||"\\u2014");
    var awaiting=(d.stages||[]).filter(function(s){return s.state==="awaiting-approval";});
    document.getElementById("gate").innerHTML=awaiting.length?
      ('<div class="gate">Awaiting your approval: '+esc(awaiting[0].slug)+"</div>"):"";
    var byPhase={};PHASES.forEach(function(p){byPhase[p]=[];});
    (d.stages||[]).forEach(function(s){ // bucket by phase via state order is unknown here; group all under active
      // stages carry slug only; phase grouping uses the phases[] statuses for the rail
    });
    var html="";
    (d.phases||[]).forEach(function(p){
      var active=p.status==="Active",ver=p.status==="Verified";
      html+='<div class="node '+(active||ver?"":"muted")+'">'+
        '<div class="row"><span class="dot '+(ver?"completed":active?"in-progress":"")+'">'+(ver?GLY.completed:"")+'</span>'+
        '<span class="nm">'+esc(p.name)+'</span>'+
        '<span class="st '+(active?"active":ver?"verified":"")+'">'+esc(p.status)+'</span></div>';
      if(active){
        html+='<div class="sub">'+(d.stages||[]).map(function(s){
          var st=s.state||"pending";
          return '<div class="srow"><span class="dot '+st+'">'+(GLY[st]||"")+'</span>'+
            '<span class="sname '+(st==="skipped"?"skipped":"")+'">'+esc(s.slug)+'</span></div>';
        }).join("")+'</div>';
      }
      html+='</div>';
    });
    document.getElementById("spine").innerHTML=html;
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
  "<style>" + STYLE + "</style></head><body>" + BODY +
  "<script>" + SCRIPT + "</scr" + "ipt></body></html>";
