/* MedIT — 카카오톡 채널 버튼 (오른쪽 아래)
 * 버튼을 누르면 작은 메뉴가 열리고 '채팅 열기'와 '친구 추가' 중에서 고를 수 있습니다.
 * 고르면 카카오톡 채널 '메디아이티' 화면이 새 창으로 열립니다.
 * 이 스크립트는 외부 주소로 데이터를 보내지 않습니다. 링크를 누를 때에만 카카오로 이동합니다. */
(function () {
  'use strict';
  var BASE = 'https://pf.kakao.com/_xfxcxdQC';
  var URL_CHAT = BASE + '/chat';     // 1:1 채팅 열기
  var URL_FRIEND = BASE + '/friend'; // 채널 친구 추가
  var en = (document.documentElement.lang || 'ko').slice(0, 2) === 'en';
  var T = en
    ? {
        label: 'KakaoTalk chat',
        btnAria: 'KakaoTalk channel menu: open chat or add friend',
        btnTitle: 'KakaoTalk channel (open chat / add friend)',
        chat: 'Open chat',
        friend: 'Add friend',
        newWin: ' (opens in a new window)',
        note: 'Please do not send patient information.'
      }
    : {
        label: '카카오톡 채팅',
        btnAria: '카카오톡 채널 메뉴: 채팅 열기 또는 친구 추가',
        btnTitle: '카카오톡 채널 (채팅 열기 / 친구 추가)',
        chat: '채팅 열기',
        friend: '친구 추가',
        newWin: ' (새 창)',
        note: '환자 정보는 보내지 마세요.'
      };

  var INK = '#3c1e1e';
  var ICON_CHAT =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="' + INK + '" d="M12 3C6.48 3 2 6.58 2 11c0 2.86 1.88 5.37 4.7 6.78l-.95 3.5a.4.4 0 0 0 .6.44l4.1-2.72c.5.06 1.03.1 1.55.1 5.52 0 10-3.58 10-8S17.52 3 12 3z"/></svg>';
  var ICON_FRIEND =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="' + INK + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="8" r="4"/><path d="M3 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1"/><path d="M19 7v6M16 10h6"/></svg>';

  var CSS = [
    '.mk-wrap{position:fixed;right:1.5rem;bottom:144px;z-index:1100;font-family:"Noto Sans KR",system-ui,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif}',
    '.mk-btn{display:flex;align-items:center;gap:.5rem;min-height:48px;padding:0 1.15rem 0 .95rem;border-radius:999px;border:1px solid #ecd45a;background:#fff4b8;background-image:linear-gradient(135deg,#ffffff 0%,#fffadb 50%,#ffec8a 100%);color:' + INK + ';font-family:inherit;font-weight:700;font-size:.9rem;line-height:1;cursor:pointer;box-shadow:0 8px 24px rgba(60,50,0,.14);transition:transform .2s,box-shadow .2s}',
    '.mk-btn:hover{box-shadow:0 10px 28px rgba(60,50,0,.24);transform:translateY(-1px)}',
    '.mk-btn:focus-visible,.mk-item:focus-visible{outline:2px solid #00756a;outline-offset:2px}',
    '.mk-btn svg{width:20px;height:20px;flex:none}',
    '.mk-menu{position:absolute;right:0;bottom:calc(100% + 10px);min-width:210px;max-width:calc(100vw - 2rem);padding:.4rem;border-radius:18px;border:1px solid #ecd45a;background:#fff;box-shadow:0 12px 32px rgba(60,50,0,.2)}',
    '.mk-menu[hidden]{display:none}',
    '.mk-item{display:flex;align-items:center;gap:.65rem;min-height:46px;padding:0 .9rem;border-radius:12px;color:' + INK + ';font-weight:700;font-size:.92rem;text-decoration:none;white-space:nowrap}',
    '.mk-item:hover{background:#fffadb}',
    '.mk-item svg{width:20px;height:20px;flex:none}',
    '.mk-note{margin:.15rem .9rem .45rem;padding-top:.45rem;border-top:1px solid #f1e6a8;color:#5a4a1e;font-size:.76rem;line-height:1.4}',
    '@media(max-width:520px){.mk-wrap{right:1rem}.mk-btn{width:52px;height:52px;min-height:52px;padding:0;justify-content:center}.mk-btn span{display:none}.mk-btn svg{width:24px;height:24px}}',
    '@media(prefers-reduced-motion:reduce){.mk-btn{transition:none}}',
    '@media print{.mk-wrap{display:none}}'
  ].join('');

  function item(href, icon, text) {
    var a = document.createElement('a');
    a.className = 'mk-item';
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.setAttribute('aria-label', text + T.newWin);
    a.innerHTML = icon + '<span></span>';
    a.lastChild.textContent = text;
    return a;
  }

  function build() {
    if (document.getElementById('mk-btn')) return;
    var st = document.createElement('style');
    st.id = 'mk-style';
    st.textContent = CSS;
    document.head.appendChild(st);

    var wrap = document.createElement('div');
    wrap.id = 'mk-wrap';
    wrap.className = 'mk-wrap';

    var btn = document.createElement('button');
    btn.id = 'mk-btn';
    btn.className = 'mk-btn';
    btn.type = 'button';
    btn.setAttribute('aria-haspopup', 'true');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', 'mk-menu');
    btn.setAttribute('aria-label', T.btnAria);
    btn.title = T.btnTitle;
    btn.innerHTML = ICON_CHAT + '<span></span>';
    btn.lastChild.textContent = T.label;

    // 메뉴는 버튼 뒤에 두어 Tab 키로 버튼 → 메뉴 순서로 이동하게 함 (화면에서는 버튼 위에 뜸)
    var menu = document.createElement('div');
    menu.id = 'mk-menu';
    menu.className = 'mk-menu';
    menu.hidden = true;
    menu.appendChild(item(URL_CHAT, ICON_CHAT, T.chat));
    menu.appendChild(item(URL_FRIEND, ICON_FRIEND, T.friend));
    var note = document.createElement('p');
    note.className = 'mk-note';
    note.textContent = T.note;
    menu.appendChild(note);

    wrap.appendChild(btn);
    wrap.appendChild(menu);
    document.body.appendChild(wrap);

    function setOpen(open, refocus) {
      menu.hidden = !open;
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (!open && refocus) btn.focus();
    }
    btn.addEventListener('click', function () { setOpen(menu.hidden); });
    // 항목을 누르면 새 창이 열리므로 메뉴는 닫음
    menu.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('.mk-item')) setOpen(false);
    });
    document.addEventListener('click', function (e) {
      if (!menu.hidden && !wrap.contains(e.target)) setOpen(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !menu.hidden) setOpen(false, true);
    });
    wrap.addEventListener('focusout', function (e) {
      if (!menu.hidden && e.relatedTarget && !wrap.contains(e.relatedTarget)) setOpen(false);
    });

    // 예약 채팅 버튼이 없는 페이지(기술 자료)에서는 그 자리만큼 아래로 내림
    if (!document.querySelector('.mc-fab')) wrap.style.bottom = '84px';
  }

  function init() {
    build();
    // 예약 채팅 버튼은 medit-chat.js 가 늦게 만들 수 있어 한 번 더 맞춤
    setTimeout(function () {
      var w = document.getElementById('mk-wrap');
      if (w) w.style.bottom = document.querySelector('.mc-fab') ? '' : '84px';
    }, 1200);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
