/* MedIT — 카카오톡 채널 채팅 버튼 (오른쪽 아래)
 * 누르면 카카오톡 채널 '메디아이티' 페이지가 새 창으로 열리고, 거기서 채팅을 시작할 수 있습니다.
 * 이 스크립트는 외부 주소로 데이터를 보내지 않습니다. 링크를 누를 때에만 카카오로 이동합니다. */
(function () {
  'use strict';
  var URL_CHAT = 'https://pf.kakao.com/_xfxcxdQC';
  var en = (document.documentElement.lang || 'ko').slice(0, 2) === 'en';
  var LABEL = en ? 'KakaoTalk chat' : '카카오톡 채팅';
  var ARIA = en
    ? 'Chat with MedIT on KakaoTalk (opens in a new window). Please do not send patient information.'
    : '카카오톡 채널 메디아이티와 채팅하기 (새 창). 환자 정보는 보내지 마세요.';

  var CSS = [
    '.mk-btn{position:fixed;right:1.5rem;bottom:144px;z-index:1100;display:flex;align-items:center;gap:.5rem;min-height:48px;padding:0 1.15rem 0 .95rem;border-radius:999px;border:1px solid #ecd45a;background:#fff4b8;background-image:linear-gradient(135deg,#ffffff 0%,#fffadb 50%,#ffec8a 100%);color:#3c1e1e;font-family:"Noto Sans KR",system-ui,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;font-weight:700;font-size:.9rem;line-height:1;text-decoration:none;cursor:pointer;box-shadow:0 8px 24px rgba(60,50,0,.14);transition:transform .2s,box-shadow .2s}',
    '.mk-btn:hover{box-shadow:0 10px 28px rgba(60,50,0,.24);transform:translateY(-1px)}',
    '.mk-btn:focus-visible{outline:2px solid #00756a;outline-offset:2px}',
    '.mk-btn svg{width:20px;height:20px;flex:none}',
    '@media(max-width:520px){.mk-btn{right:1rem;width:52px;height:52px;min-height:52px;padding:0;justify-content:center}.mk-btn span{display:none}.mk-btn svg{width:24px;height:24px}}',
    '@media(prefers-reduced-motion:reduce){.mk-btn{transition:none}}',
    '@media print{.mk-btn{display:none}}'
  ].join('');

  function build() {
    if (document.getElementById('mk-btn')) return;
    var st = document.createElement('style');
    st.id = 'mk-style';
    st.textContent = CSS;
    document.head.appendChild(st);

    var a = document.createElement('a');
    a.id = 'mk-btn';
    a.className = 'mk-btn';
    a.href = URL_CHAT;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.setAttribute('aria-label', ARIA);
    a.title = en ? 'KakaoTalk channel chat (no patient information, please)' : '카카오톡 채널 채팅 (환자 정보는 보내지 마세요)';
    a.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="#3c1e1e" d="M12 3C6.48 3 2 6.58 2 11c0 2.86 1.88 5.37 4.7 6.78l-.95 3.5a.4.4 0 0 0 .6.44l4.1-2.72c.5.06 1.03.1 1.55.1 5.52 0 10-3.58 10-8S17.52 3 12 3z"/></svg>' +
      '<span></span>';
    a.lastChild.textContent = LABEL;

    // 예약 채팅 버튼이 없는 페이지(기술 자료)에서는 그 자리만큼 아래로 내림
    document.body.appendChild(a);
    if (!document.querySelector('.mc-fab')) a.style.bottom = '84px';
  }

  function init() {
    build();
    // 예약 채팅 버튼은 medit-chat.js 가 늦게 만들 수 있어 한 번 더 맞춤
    setTimeout(function () {
      var a = document.getElementById('mk-btn');
      if (a) a.style.bottom = document.querySelector('.mc-fab') ? '' : '84px';
    }, 1200);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
