/** Self-contained HTML for the `/dev/phone` fake iMessage thread. No framework, no build step. */
export function renderDevPhonePage(defaultPhone: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Dev Phone</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; background: #e5e5ea; height: 100vh; display: flex; flex-direction: column; }
  header { background: #f7f7f8; border-bottom: 1px solid #d1d1d6; padding: 10px 14px; display: flex; align-items: center; gap: 10px; }
  header .avatar { width: 34px; height: 34px; border-radius: 50%; background: #34c759; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 600; }
  header .name { font-weight: 600; font-size: 15px; }
  header input { margin-left: auto; font-size: 12px; padding: 5px 8px; border-radius: 6px; border: 1px solid #d1d1d6; width: 150px; }
  #thread { flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 6px; }
  .bubble { max-width: 72%; padding: 8px 12px; border-radius: 18px; font-size: 15px; line-height: 1.3; white-space: pre-wrap; word-break: break-word; }
  .bubble img { max-width: 220px; display: block; border-radius: 12px; margin-top: 4px; }
  .row { display: flex; }
  .row.out { justify-content: flex-end; }
  .row.in { justify-content: flex-start; }
  .out .bubble { background: #0b93f6; color: #fff; }
  .in .bubble { background: #e5e5ea; color: #000; }
  .row.reaction .bubble { background: transparent; color: #8e8e93; font-size: 12px; padding: 0; }
  .typing { align-self: flex-start; background: #e5e5ea; border-radius: 18px; padding: 8px 14px; width: fit-content; }
  .typing span { display: inline-block; width: 6px; height: 6px; margin: 0 1px; border-radius: 50%; background: #8e8e93; animation: bounce 1.2s infinite ease-in-out; }
  .typing span:nth-child(2) { animation-delay: 0.15s; }
  .typing span:nth-child(3) { animation-delay: 0.3s; }
  @keyframes bounce { 0%, 60%, 100% { transform: translateY(0); opacity: .4; } 30% { transform: translateY(-4px); opacity: 1; } }
  footer { background: #f7f7f8; border-top: 1px solid #d1d1d6; padding: 8px 10px; display: flex; gap: 8px; align-items: flex-end; }
  footer textarea { flex: 1; resize: none; border: 1px solid #d1d1d6; border-radius: 18px; padding: 8px 12px; font-size: 15px; font-family: inherit; max-height: 90px; }
  footer button { border: none; background: #0b93f6; color: #fff; border-radius: 18px; padding: 9px 16px; font-size: 14px; cursor: pointer; }
  footer button.secondary { background: #8e8e93; }
  footer button:disabled { opacity: .5; cursor: default; }
  .meta { font-size: 10px; color: #8e8e93; margin-top: 2px; text-align: right; }
</style>
</head>
<body>
<header>
  <div class="avatar" id="avatar">A</div>
  <div class="name" id="agent-name">Agent</div>
  <input id="phone" value="${defaultPhone}" title="Student phone (E.164)" />
</header>
<div id="thread"></div>
<footer>
  <input id="photo-input" type="file" accept="image/*" style="display:none" />
  <button class="secondary" id="photo-btn" type="button">📷</button>
  <textarea id="composer" rows="1" placeholder="iMessage"></textarea>
  <button id="send-btn" type="button">Send</button>
</footer>
<script>
(function () {
  var threadEl = document.getElementById('thread');
  var phoneEl = document.getElementById('phone');
  var composerEl = document.getElementById('composer');
  var sendBtn = document.getElementById('send-btn');
  var photoBtn = document.getElementById('photo-btn');
  var photoInput = document.getElementById('photo-input');
  var agentNameEl = document.getElementById('agent-name');
  var avatarEl = document.getElementById('avatar');
  var pendingMedia = [];

  function url(path) {
    var u = new URL(path, window.location.origin);
    return u.toString();
  }

  function render(state) {
    agentNameEl.textContent = state.agentName || 'Agent';
    avatarEl.textContent = (state.agentName || 'A').slice(0, 1).toUpperCase();
    threadEl.innerHTML = '';
    (state.messages || []).forEach(function (m) {
      var row = document.createElement('div');
      var isOut = m.direction === 'outbound';
      row.className = 'row ' + (isOut ? 'out' : 'in') + (m.kind === 'reaction' ? ' reaction' : '');
      var bubble = document.createElement('div');
      bubble.className = 'bubble';
      if (m.kind === 'reaction') {
        bubble.textContent = (isOut ? 'You' : 'Them') + ' reacted ' + (m.reaction || '');
      } else {
        if (m.body) bubble.appendChild(document.createTextNode(m.body));
        (m.media || []).forEach(function (media) {
          if (media.url && /^image\\//.test(media.content_type || '')) {
            var img = document.createElement('img');
            img.src = media.url;
            bubble.appendChild(img);
          }
        });
      }
      row.appendChild(bubble);
      threadEl.appendChild(row);
    });
    if (state.typing) {
      var typingRow = document.createElement('div');
      typingRow.className = 'row in';
      var typing = document.createElement('div');
      typing.className = 'typing';
      typing.innerHTML = '<span></span><span></span><span></span>';
      typingRow.appendChild(typing);
      threadEl.appendChild(typingRow);
    }
    threadEl.scrollTop = threadEl.scrollHeight;
  }

  function poll() {
    fetch(url('/dev/phone/state?phone=' + encodeURIComponent(phoneEl.value)))
      .then(function (r) { return r.json(); })
      .then(render)
      .catch(function () {});
  }

  function send() {
    var body = composerEl.value.trim();
    if (!body && pendingMedia.length === 0) return;
    sendBtn.disabled = true;
    fetch(url('/dev/phone/send'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone: phoneEl.value, body: body, mediaUrls: pendingMedia }),
    })
      .then(function () {
        composerEl.value = '';
        pendingMedia = [];
        poll();
      })
      .finally(function () { sendBtn.disabled = false; });
  }

  sendBtn.addEventListener('click', send);
  composerEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  });
  photoBtn.addEventListener('click', function () { photoInput.click(); });
  photoInput.addEventListener('change', function () {
    var file = photoInput.files[0];
    if (!file) return;
    var form = new FormData();
    form.append('file', file);
    fetch(url('/dev/phone/upload'), { method: 'POST', body: form })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.url) { pendingMedia.push(data.url); send(); }
      })
      .finally(function () { photoInput.value = ''; });
  });
  phoneEl.addEventListener('change', poll);

  poll();
  setInterval(poll, 1500);
})();
</script>
</body>
</html>
`;
}
