// ═══════════════════════════════════════════════════════════
// PatternFlow - the /artnet console page
//
// A PROGMEM literal served uncompressed (PFSend::progmem). Small on purpose:
// it is not gzipped, and on a slow Wi-Fi hop every kilobyte is time. It
// polls /api/artnet every two seconds, one request at a time - the console's
// server takes a single connection (docs/rest-api.md).
//
// License: MIT
// ═══════════════════════════════════════════════════════════
#pragma once
#include <pgmspace.h>

static const char ARTNET_INDEX_HTML[] PROGMEM = R"HTML(<!doctype html>
<html lang="en">
<head><meta charset="utf-8">
<script src="/pf-console.js"></script>
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Patternflow - Art-Net</title>
<style>
:root{--bg:#0C0B09;--ink:#EDE7DB;--muted:#8A8272;--faint:#5A5546;--rule:#242118;--led:#FF5C2E;--ok:#57B87F;--warn:#D9A03F;--panel:#131110;
--sans:ui-sans-serif,system-ui,sans-serif;--mono:ui-monospace,SFMono-Regular,Menlo,monospace}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--sans);line-height:1.5}
.wrap{max-width:760px;margin:0 auto;padding:28px 16px 64px}
h1{font-size:15px;font-weight:600;margin:0 0 4px}
h2{font-size:11px;font-weight:600;letter-spacing:.09em;text-transform:uppercase;color:var(--muted);margin:26px 0 8px}
.sub{font-family:var(--mono);font-size:11px;color:var(--faint)}
.row{display:flex;align-items:center;gap:12px;min-height:36px;flex-wrap:wrap}
.row>label{flex:0 0 150px;font-size:13px;color:var(--muted)}
input,select,button{font:inherit;font-size:13px;color:var(--ink);background:var(--panel);border:1px solid var(--rule);border-radius:2px;height:32px;padding:0 8px}
input[type=number]{width:110px}
input[type=checkbox]{height:auto}
button{cursor:pointer}
button.on{border-color:var(--led)}
.note{font-size:12px;color:var(--faint);margin:6px 0 0}
table{border-collapse:collapse;font-family:var(--mono);font-size:12px;width:100%}
td{padding:4px 8px 4px 0;border-bottom:1px solid var(--rule)}
td:first-child{color:var(--muted);width:45%}
.ok{color:var(--ok)}.warn{color:var(--warn)}
</style>
</head>
<body><div class="wrap">
<h1>Art-Net</h1>
<div class="sub" id="sub">UDP 6454</div>

<h2>Receiver</h2>
<div class="row"><label>Receive</label><button id="on" type="button">-</button></div>
<div class="row"><label for="mode">Mode</label><select id="mode"><option value="replace">replace - the stream instead of the pattern</option><option value="overlay">overlay - the stream where it is lit</option></select></div>
<div class="row"><label for="thr">Overlay threshold</label><input id="thr" type="number" min="0" max="255"></div>
<div class="row"><label for="timeout">Timeout (ms)</label><input id="timeout" type="number" min="100" max="60000"></div>
<div class="row"><label for="gap">Frame gap (ms)</label><input id="gap" type="number" min="2" max="200"></div>
<div class="row"><label for="rx">Receive path</label><select id="rx"><option value="socket">socket - pf-artnet task</option><option value="raw">raw - inside lwIP's tcpip thread</option></select><span class="sub" id="rxnow"></span></div>
<div class="row"><label>Wi-Fi buffers</label><label><input id="wifibuf" type="checkbox"> static (experiment, about 19 KB internal RAM)</label><span class="sub" id="wbnow"></span></div>
<p class="note">Timeout: no frame for this long and the pattern returns. Frame gap: without ArtSync, a frame still missing universes is shown once no packet has arrived for this long. Receive path and Wi-Fi buffers: apply after a reboot.</p>

<h2>Mapping</h2>
<div class="row"><label for="uni">Start universe</label><input id="uni" type="number" min="0" max="32767"><span class="sub" id="span"></span></div>
<div class="row"><label for="ppu">Pixels / universe</label><input id="ppu" type="number" min="16" max="170"></div>
<div class="row"><label for="order">Channel order</label><select id="order"><option>RGB</option><option>RBG</option><option>GRB</option><option>GBR</option><option>BRG</option><option>BGR</option></select></div>
<div class="row"><label for="rot">Rotation</label><select id="rot"><option value="0">0 - wide, 128 x 64</option><option value="1">90 - upright, 64 x 128</option><option value="2">180</option><option value="3">270</option></select></div>
<div class="row"><label>Rows</label><label><input id="serp" type="checkbox"> serpentine</label><label><input id="fx" type="checkbox"> mirror X</label><label><input id="fy" type="checkbox"> mirror Y</label></div>
<p class="note">Pixel 0 is the top-left of the sender's image; rows run left to right. Mirrors apply to the sender's image, rotation then turns it onto the panel.</p>

<h2>Now</h2>
<table id="stats"></table>
<h2>Missing universes</h2>
<p class="note">Per universe, how many published frames went without it. High counts only at the end: bursts lose their tail.</p>
<div class="sub" id="miss" style="word-break:break-all"></div>
<div class="row"><button id="reset" type="button">Reset counters</button></div>
<p class="note">Stream at the pattern's pace: the panel shows a new stream frame when the running pattern presents one. Pick the <b>Art-Net</b> pattern to stream at full rate.</p>
</div>
<script>
function $(i){return document.getElementById(i)}
var S=null,busy=false;
function post(body){
  busy=true;
  fetch('/api/artnet',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body})
  .then(function(r){return r.json()}).then(show).catch(function(){}).then(function(){busy=false});
}
function field(id,key){
  $(id).addEventListener('change',function(){
    var el=$(id),v=el.type=='checkbox'?(el.checked?1:0):el.value;
    post(key+'='+encodeURIComponent(v));
  });
}
['mode','thr','timeout','gap','uni','ppu','order','rot','serp','fx','fy'].forEach(function(k){field(k,k=='timeout'?'timeout':k)});
$('on').onclick=function(){post('on='+(S&&S.on?0:1))};
$('reset').onclick=function(){post('reset=1')};
$('rx').addEventListener('change',function(){post('rx='+$('rx').value)});
$('wifibuf').addEventListener('change',function(){post('wifibuf='+($('wifibuf').checked?1:0))});
function setv(id,v){var el=$(id);if(document.activeElement===el)return;if(el.type=='checkbox')el.checked=!!v;else el.value=v}
function show(d){
  if(!d||!d.ok)return;S=d;
  $('on').textContent=d.on?'on':'off';$('on').className=d.on?'on':'';
  ['mode','thr','timeout','gap','uni','ppu','order','rot','serp','fx','fy'].forEach(function(k){setv(k,d[k])});
  $('span').textContent='universes '+d.uni+' - '+(d.uni+d.universes-1)+' ('+d.universes+')';
  setv('rx',d.rxNext);setv('wifibuf',d.wifibufNext);
  $('wbnow').textContent='now: '+(d.wifiStatic?'static':'default')+(d.wifiStatic!=d.wifibufNext?' - reboot to switch':'');
  $('rxnow').textContent='now: '+d.rx+(d.rx!=d.rxNext?' - reboot to switch':'');
  $('miss').textContent=(d.miss||[]).map(function(n,i){return (d.uni+i)+':'+n}).join('  ');
  $('sub').textContent='UDP '+d.port+' - '+d.w+' x '+d.h+' - '+(d.listening?'listening':'not listening');
  var rows=[
    ['state',d.active?'<span class=ok>receiving</span>':(d.on?'waiting':'off')],
    ['sync',d.sync?'ArtSync':'free-running'],
    ['frames/s in',d.fps],['frames/s on panel',d.shownFps],['packets/s',d.pps],
    ['frames',d.frames],['incomplete',d.incomplete],['skipped (panel slower)',d.skipped],
    ['packets',d.packets],['ignored',d.ignored],['polls answered',d.polls],
    ['last sender',d.sender||'-'],['last frame',d.ageMs<0?'never':d.ageMs+' ms ago'],
    ['receive path',d.rx],
    ['per packet (avg / max)',d.procUs+' / '+d.procUsMax+' us'],
    ['burst, first to last packet (avg / max)',(d.burstUs/1000).toFixed(1)+' / '+(d.burstUsMax/1000).toFixed(1)+' ms'],
    ['incomplete frames with Core 0 idle in the burst',d.lossyIdle+' of '+d.lossy]];
  if(d.rx=='socket')rows.push(['socket queue, most waiting (see README)',d.queueMax]);
  if(d.rx=='raw')rows.push(['tcpip stack free (min)',d.tcpipStackMin+' B']);
  $('stats').innerHTML=rows.map(function(r){return '<tr><td>'+r[0]+'</td><td>'+r[1]+'</td></tr>'}).join('');
}
function poll(){
  if(busy||document.hidden){setTimeout(poll,2000);return}
  fetch('/api/artnet').then(function(r){return r.json()}).then(show).catch(function(){}).then(function(){setTimeout(poll,2000)});
}
poll();
</script>
</body></html>
)HTML";
