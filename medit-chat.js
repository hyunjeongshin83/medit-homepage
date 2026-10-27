/* MedIT 예약 채팅
 * 데모 시연 예약 · 약국 시범 이용 신청 · 문의를 채팅창에서 받는 위젯.
 * - 사람과 실시간으로 대화하는 창이 아니라, 정해진 순서로 접수를 돕는 안내 창입니다.
 * - 접수는 홈페이지 신청 폼과 같은 함수(demo-request)를 그대로 씁니다. 그래서 동의문, 보관 기간(3개월),
 *   접수 횟수 제한, 대표님 알림이 폼과 똑같이 적용됩니다.
 * - 대화 내용은 저장하지 않습니다. 마지막에 "접수하기"를 누른 신청서만 서버로 갑니다.
 * - 안내 시연이 가능한 요일·시간대는 아래 CFG 한 곳에서 바꿉니다.
 */
(function () {
  'use strict';
  if (window.__mcLoaded) return;
  window.__mcLoaded = true;

  var CFG = {
    endpoint: 'https://xaclqvveppvccdpebzsz.supabase.co/functions/v1/demo-request',
    mail: 'hyunjeong.shin@sookmyung.ac.kr',
    days: [2, 4],        // 안내 시연이 가능한 요일 (0=일 1=월 2=화 3=수 4=목 5=금 6=토)
    leadDays: 5,         // 오늘부터 며칠 뒤 날짜부터 고를 수 있는지 (일정 확정 안내를 보낼 시간)
    horizonDays: 56,     // 며칠 앞까지 보여줄지 (접수 함수의 한도는 89일)
    slots: [             // v 는 접수 함수가 받는 시간대 코드
      { v: 'am',  ko: '오전 10~12시', en: '10 AM – 12 PM' },
      { v: 'pm1', ko: '오후 1~3시',   en: '1 – 3 PM' }
    ],
    written: { v: 'written', ko: '서면으로 먼저 협의', en: 'Start in writing first' }
  };

  var TXT = {
    ko: {
      title: 'MedIT 예약 안내', sub: '데모 예약 · 약국 시범 이용',
      fab: '예약 채팅', openLabel: '예약 채팅 열기', close: '닫기', restart: '처음부터 다시',
      hello: '안녕하세요, MedIT입니다. 데모 시연 예약과 약국 시범 이용 신청을 이 창에서 받습니다.',
      note: '이 창은 정해진 순서로 접수를 돕는 자동 안내이며, 사람이 실시간으로 답하지 않습니다. 의학적 상담은 하지 않습니다. 대화 내용은 저장되지 않고, 마지막에 “접수하기”를 누른 신청서만 저장되며 3개월 뒤 자동 삭제됩니다.',
      menu: { demo: '데모 시연 예약', pilot: '약국 시범 이용 신청', watch: '시연 영상·체험판 보기', ask: '문의 남기기', mail: '이메일로 문의' },
      pickDate: '원하시는 날짜를 골라 주세요. 안내 시연은 화·목요일에 가능합니다.',
      noDate: '날짜는 나중에 정할게요',
      pickTime: function (d) { return d + ' 몇 시가 편하세요? (한국 시간)'; },
      formIntro: {
        demo: '마지막으로 연락받으실 정보를 적어 주세요.',
        pilot: '시범 이용 신청서를 적어 주세요. 약국 이름은 꼭 필요합니다.',
        ask: '궁금한 점과 답변받을 이메일을 남겨 주세요.'
      },
      f: {
        name: '이름 (필수)', org: '소속 (약국·기관명)', orgPh: '예: 숙명약국', email: '이메일 (필수)',
        phone: '전화번호 (선택)', phonePh: '010-0000-0000', msg: '문의 내용 (선택)', msgPh: '궁금한 점을 적어 주세요.',
        msgHint: '환자 개인정보나 건강정보는 적지 마세요.'
      },
      consent: '개인정보 수집·이용에 동의합니다. (필수)',
      detailTitle: '자세히 보기',
      detail: [
        '수집 항목: 이름, 이메일, (선택) 소속, 전화번호, 희망 날짜와 시간대, 문의 내용',
        '이용 목적: 데모 일정 조율과 시범 이용 안내 회신',
        '보유 기간: 접수일부터 3개월 뒤 자동 삭제합니다. 삭제를 원하시면 이메일로 알려 주세요.',
        '동의하지 않을 권리: 동의하지 않아도 됩니다. 이 경우 이메일로 직접 문의하실 수 있습니다.',
        '저장 위치: 클라우드 데이터베이스(Supabase, 일본 도쿄 리전). 제3자에게 제공하지 않습니다.'
      ],
      policy: '개인정보 처리방침',
      submit: '접수하기', sending: '보내는 중입니다.',
      err: {
        consent: '개인정보 수집·이용에 동의해 주세요.',
        name: '이름을 입력해 주세요.',
        email: '이메일 주소를 확인해 주세요.',
        org: '시범 이용은 약국 이름을 적어 주세요.',
        phone: '전화번호는 숫자와 하이픈으로 적어 주세요.',
        preferred_date: '희망 날짜를 다시 골라 주세요.',
        rate: '같은 이메일로는 하루 3건까지 접수됩니다. 아래 이메일로 직접 보내 주세요.',
        fast: '잠시 뒤에 다시 눌러 주세요.',
        server: '접수에 실패했습니다. 잠시 뒤 다시 시도하거나 이메일로 보내 주세요.',
        net: '연결에 실패했습니다. 아래 이메일로 직접 보내 주세요.'
      },
      mailLink: '이메일로 보내기',
      doneTitle: '접수되었습니다.',
      doneP1: '입력하신 이메일로 순서대로 안내드립니다.',
      doneP2: '며칠이 지나도 답이 없으면 아래 주소로 알려 주세요.',
      guideIntro: '일정 확정과 시스템·계약 상담은 아래 안내 페이지에서 바로 이어가실 수 있습니다. 이 주소는 신청하신 분만 보시도록 만든 개인용 주소이니 다른 분께 전달하지 마세요.',
      guideBtn: '예약 안내 · 계약 상담 열기',
      kindLabel: { demo: '데모 시연 예약', pilot: '약국 시범 이용 신청', ask: '문의' },
      watchIntro: '시연 영상과 체험판은 모두 가상 데이터입니다. 실제 환자 정보는 입력하지 마세요.',
      links: { video: '시연 영상 보기', pharm: '약사용 체험판', patient: '환자용 앱 체험판' },
      again: '처음으로',
      mailIntro: '이메일로 보내 주시면 순서대로 답변드립니다.',
      mailBtn: '이메일 쓰기', subj: '[MedIT] 데모 예약·시범 이용 문의',
      watchNow: '기다리는 동안 먼저 둘러보셔도 됩니다.',
      month: function (y, m) { return y + '년 ' + m + '월'; },
      wk: ['일', '월', '화', '수', '목', '금', '토'],
      dateFmt: function (y, m, d, w) { return m + '월 ' + d + '일(' + w + ')'; },
      dayAria: function (y, m, d, w) { return m + '월 ' + d + '일 ' + w + '요일 선택'; },
      prev: '이전 달', next: '다음 달', calLabel: '날짜 선택'
    },
    en: {
      title: 'MedIT booking assistant', sub: 'Demo booking · pharmacy pilot',
      fab: 'Book a demo', openLabel: 'Open the booking chat', close: 'Close', restart: 'Start over',
      hello: 'Hello, this is MedIT. You can book a demo or request a pharmacy pilot in this window.',
      note: 'This window is an automated guide that takes your request step by step; no person replies in real time. We do not give medical advice. The conversation is not stored; only the request you send with “Submit” is saved, and it is deleted automatically after 3 months.',
      menu: { demo: 'Book a demo', pilot: 'Request a pharmacy pilot', watch: 'Watch videos & try demos', ask: 'Leave a question', mail: 'Email us' },
      pickDate: 'Please pick a date. Guided demos are available on Tuesdays and Thursdays.',
      noDate: 'I will pick a date later',
      pickTime: function (d) { return 'What time works on ' + d + '? (Korea time)'; },
      formIntro: {
        demo: 'Last step: please enter your contact details.',
        pilot: 'Please fill in the pilot request. The pharmacy name is required.',
        ask: 'Please leave your question and an email address for the reply.'
      },
      f: {
        name: 'Name (required)', org: 'Organization (pharmacy / institution)', orgPh: 'e.g. Sookmyung Pharmacy', email: 'Email (required)',
        phone: 'Phone (optional)', phonePh: '+82 10-0000-0000', msg: 'Message (optional)', msgPh: 'Tell us what you would like to know.',
        msgHint: 'Please do not enter patient personal or health information.'
      },
      consent: 'I agree to the collection and use of my personal information. (required)',
      detailTitle: 'Details',
      detail: [
        'Collected: name, email, and (optional) organization, phone, preferred date and time slot, message',
        'Purpose: arranging the demo schedule and replying about the pilot',
        'Retention: automatically deleted 3 months after receipt. Email us if you want it deleted sooner.',
        'Right to refuse: you may decline; in that case you can email us directly.',
        'Storage: cloud database (Supabase, Tokyo region, Japan). Not provided to third parties.'
      ],
      policy: 'Privacy policy',
      submit: 'Submit', sending: 'Sending...',
      err: {
        consent: 'Please agree to the collection and use of personal information.',
        name: 'Please enter your name.',
        email: 'Please check your email address.',
        org: 'For a pharmacy pilot, please enter the pharmacy name.',
        phone: 'Please use digits and hyphens for the phone number.',
        preferred_date: 'Please pick the date again.',
        rate: 'Up to 3 requests per day are accepted for one email address. Please email us directly.',
        fast: 'Please try again in a moment.',
        server: 'Submission failed. Please try again shortly or email us.',
        net: 'Connection failed. Please email us directly.'
      },
      mailLink: 'Send by email',
      doneTitle: 'Request received.',
      doneP1: 'We will reply to the email you entered, in order of arrival.',
      doneP2: 'If you do not hear back after a few days, please write to the address below.',
      guideIntro: 'You can pick your time and ask system and contract questions on your own guide page (in Korean). The link is personal to you, so please do not share it.',
      guideBtn: 'Open my booking guide (Korean)',
      kindLabel: { demo: 'Demo booking', pilot: 'Pharmacy pilot request', ask: 'Question' },
      watchIntro: 'The videos and demos use fictional data only. Please do not enter real patient information.',
      links: { video: 'Watch the demo videos', pharm: 'Pharmacist demo', patient: 'Patient app demo' },
      again: 'Back to start',
      mailIntro: 'Email us and we will reply in order of arrival.',
      mailBtn: 'Write an email', subj: '[MedIT] Demo booking / pilot inquiry',
      watchNow: 'While you wait, feel free to look around.',
      month: function (y, m) {
        return ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][m - 1] + ' ' + y;
      },
      wk: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      dateFmt: function (y, m, d, w) { return w + ', ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1] + ' ' + d; },
      dayAria: function (y, m, d, w) { return 'Select ' + w + ', ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1] + ' ' + d; },
      prev: 'Previous month', next: 'Next month', calLabel: 'Choose a date'
    }
  };

  var CSS = [
    '.mc-root,.mc-root *{box-sizing:border-box}',
    '.mc-root{font-family:"Noto Sans KR",system-ui,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;color:#e8e4dc;cursor:auto}',
    '.mc-root button,.mc-root a,.mc-root label,.mc-root summary,.mc-root select{cursor:pointer}',
    '.mc-root input[type=text],.mc-root input[type=email],.mc-root input[type=tel],.mc-root textarea{cursor:text}',
    '.mc-fab{position:fixed;right:1.5rem;bottom:84px;z-index:1100;display:flex;align-items:center;gap:.5rem;min-height:48px;padding:0 1.15rem 0 .95rem;border-radius:999px;border:1px solid rgba(52,211,153,.55);background:#10B981;color:#0a0f1a;font-family:inherit;font-weight:700;font-size:.9rem;line-height:1;box-shadow:0 8px 28px rgba(0,0,0,.45);transition:transform .2s,background .2s}',
    '.mc-fab:hover{background:#34d399;transform:translateY(-1px)}',
    '.mc-fab svg{width:20px;height:20px;flex:none}',
    '.mc-root :focus-visible{outline:2px solid #6ee7b7;outline-offset:2px}',
    '.mc-panel{position:fixed;right:1.5rem;bottom:84px;z-index:1101;width:min(392px,calc(100vw - 24px));height:min(640px,calc(100vh - 110px));height:min(640px,calc(100dvh - 110px));display:none;flex-direction:column;background:#0e1626;border:1px solid #1f2b44;border-radius:18px;box-shadow:0 24px 80px rgba(0,0,0,.6);overflow:hidden}',
    '.mc-panel.mc-open{display:flex}',
    '@media(max-width:520px){.mc-fab{right:1rem;width:52px;height:52px;min-height:52px;padding:0;justify-content:center}.mc-fab span{display:none}.mc-fab svg{width:24px;height:24px}.mc-panel{right:0;left:0;bottom:0;width:100%;height:min(88vh,calc(100vh - 24px));height:min(88dvh,calc(100dvh - 24px));border-radius:18px 18px 0 0}}',
    '.mc-head{display:flex;align-items:center;gap:.65rem;padding:.7rem .6rem .7rem .9rem;border-bottom:1px solid #1a2336;background:#0b1220;flex:none}',
    '.mc-head img{width:34px;height:34px;border-radius:9px;flex:none}',
    '.mc-ht{flex:1;min-width:0}',
    '.mc-ht b{display:block;font-size:.95rem;color:#fff;line-height:1.3}',
    '.mc-ht span{display:block;font-size:.74rem;color:#9a9588;line-height:1.3}',
    '.mc-ib{width:44px;height:44px;flex:none;border:0;border-radius:10px;background:transparent;color:#b8b3a7;font-size:1.25rem;line-height:1;display:flex;align-items:center;justify-content:center;font-family:inherit}',
    '.mc-ib:hover{background:#17223a;color:#fff}',
    '.mc-log{flex:1;overflow-y:auto;padding:1rem .9rem 1.2rem;display:flex;flex-direction:column;gap:.6rem;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}',
    '.mc-b{max-width:90%;padding:.65rem .85rem;border-radius:14px;font-size:.9rem;line-height:1.65;word-break:keep-all;overflow-wrap:anywhere}',
    '.mc-bot{align-self:flex-start;background:#131c30;border:1px solid #1d2a44;border-top-left-radius:4px}',
    '.mc-me{align-self:flex-end;background:#10B981;color:#0a0f1a;font-weight:600;border-top-right-radius:4px}',
    '.mc-small{font-size:.78rem;color:#a9a498}',
    '.mc-wide{max-width:100%;width:100%}',
    '.mc-b a{color:#34d399}',
    '.mc-chips{display:flex;flex-wrap:wrap;gap:.45rem;align-self:flex-start;max-width:100%}',
    '.mc-chip{min-height:44px;padding:.5rem .95rem;border-radius:999px;border:1px solid #1b5a4a;background:#0d2a2c;color:#34d399;font-weight:600;font-size:.86rem;font-family:inherit;text-decoration:none;display:inline-flex;align-items:center;line-height:1.3;text-align:left}',
    '.mc-chip:hover{background:#12403f;color:#6ee7b7}',
    '.mc-chip.mc-fill{background:#10B981;border-color:#10B981;color:#0a0f1a}',
    '.mc-chip.mc-fill:hover{background:#34d399;color:#0a0f1a}',
    '.mc-chips.mc-used .mc-chip{opacity:.4;pointer-events:none}',
    '.mc-cal{align-self:flex-start;width:100%;background:#131c30;border:1px solid #1d2a44;border-radius:14px;padding:.7rem .7rem .8rem}',
    '.mc-cal-h{display:flex;align-items:center;justify-content:space-between;margin-bottom:.4rem}',
    '.mc-cal-t{font-weight:700;color:#fff;font-size:.95rem}',
    '.mc-nav{width:44px;height:36px;border:1px solid #243048;border-radius:9px;background:#0e1626;color:#e8e4dc;font-size:1.1rem;font-family:inherit}',
    '.mc-nav[disabled]{opacity:.3;cursor:default}',
    '.mc-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}',
    '.mc-wd{text-align:center;font-size:.72rem;color:#9a9588;padding:.15rem 0 .3rem}',
    '.mc-wd:first-child{color:#e0766d}',
    '.mc-day{height:40px;border-radius:9px;border:1px solid #131b2b;background:#0a0f1a;color:#5f6a7e;font-size:.86rem;font-family:inherit;display:flex;align-items:center;justify-content:center;padding:0}',
    '.mc-day.mc-av{background:#0d2a2c;border-color:#1b5a4a;color:#34d399;font-weight:700}',
    '.mc-day.mc-av:hover{background:#10B981;color:#0a0f1a}',
    '.mc-cal.mc-done .mc-day,.mc-cal.mc-done .mc-nav{pointer-events:none;opacity:.55}',
    '.mc-form label.mc-l{display:block;font-size:.78rem;color:#c2bdb1;margin:.6rem 0 .25rem}',
    '.mc-form input[type=text],.mc-form input[type=email],.mc-form input[type=tel],.mc-form textarea{width:100%;min-height:44px;padding:.55rem .7rem;border-radius:10px;border:1px solid #2a3855;background:#0a0f1a;color:#f1ede4;font-size:16px;font-family:inherit;line-height:1.4}',
    '.mc-form textarea{min-height:84px;resize:vertical}',
    '.mc-form input::placeholder,.mc-form textarea::placeholder{color:#6f7a8e}',
    '.mc-form .mc-err{border-color:#e0766d}',
    '.mc-hint{font-size:.74rem;color:#a9a498;margin-top:.25rem}',
    '.mc-hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}',
    '.mc-consent{display:flex;gap:.55rem;align-items:flex-start;margin:.8rem 0 .2rem;font-size:.84rem;line-height:1.5;color:#e8e4dc}',
    '.mc-consent input{width:22px;height:22px;margin:0;flex:none;accent-color:#10B981}',
    '.mc-det{margin:.35rem 0 0;font-size:.76rem;color:#b8b3a7}',
    '.mc-det summary{min-height:32px;display:flex;align-items:center;color:#34d399}',
    '.mc-det ul{margin:.2rem 0 0;padding-left:1.1rem}',
    '.mc-det li{margin:.15rem 0;line-height:1.55}',
    '.mc-submit{width:100%;min-height:46px;margin-top:.8rem;border:0;border-radius:11px;background:#10B981;color:#0a0f1a;font-weight:800;font-size:.95rem;font-family:inherit}',
    '.mc-submit:hover{background:#34d399}',
    '.mc-submit[disabled]{opacity:.6;cursor:default}',
    '.mc-status{min-height:1.2em;margin-top:.55rem;font-size:.8rem;line-height:1.55;color:#c2bdb1}',
    '.mc-status.mc-bad{color:#f19a92}',
    '.mc-done-t{font-weight:700;color:#34d399;font-size:1rem;margin-bottom:.25rem}',
    '.mc-sum{margin:.5rem 0 0;padding:.5rem .65rem;border-radius:10px;background:#0a0f1a;border:1px solid #1d2a44;font-size:.84rem;color:#e8e4dc}',
    '@media(prefers-reduced-motion:reduce){.mc-fab{transition:none}}'
  ].join('');

  var T, st, root, fab, panel, log;

  function lang() { return ((window.__BK_LANG || document.documentElement.lang || 'ko') === 'en') ? 'en' : 'ko'; }

  function h(tag, o, kids) {
    var e = document.createElement(tag), k, v;
    if (o) {
      for (k in o) {
        v = o[k];
        if (v == null) continue;
        if (k === 'class') e.className = v;
        else if (k === 'text') e.textContent = v;
        else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
        else e.setAttribute(k, v);
      }
    }
    (kids || []).forEach(function (c) {
      if (c == null) return;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return e;
  }

  // ---- 날짜 (한국 시간 기준)
  function kstToday() { return new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); }
  function addDays(iso, n) { var d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function wdOf(iso) { return new Date(iso + 'T00:00:00Z').getUTCDay(); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fmtDate(iso) {
    return T.dateFmt(+iso.slice(0, 4), +iso.slice(5, 7), +iso.slice(8, 10), T.wk[wdOf(iso)]);
  }
  function slotLabel(v) {
    var i, all = CFG.slots.concat([CFG.written]);
    for (i = 0; i < all.length; i++) if (all[i].v === v) return all[i][lang()];
    return '';
  }

  // ---- 대화 출력
  function scrollEnd() { log.scrollTop = log.scrollHeight; }
  function push(node) { log.appendChild(node); scrollEnd(); return node; }
  function bot(content, extra) {
    var b = h('div', { class: 'mc-b mc-bot' + (extra ? ' ' + extra : '') });
    if (typeof content === 'string') b.textContent = content; else if (content) b.appendChild(content);
    return push(b);
  }
  function me(text) { return push(h('div', { class: 'mc-b mc-me', text: text })); }
  function chips(list) {
    var box = h('div', { class: 'mc-chips' });
    list.forEach(function (c) {
      var el;
      if (c.href) {
        el = h('a', { class: 'mc-chip' + (c.fill ? ' mc-fill' : ''), href: c.href, target: c.href.charAt(0) === '#' ? null : '_blank', rel: 'noopener', text: c.label });
        if (c.onclick) el.addEventListener('click', c.onclick);
      } else {
        el = h('button', { type: 'button', class: 'mc-chip' + (c.fill ? ' mc-fill' : ''), text: c.label });
        el.addEventListener('click', function () { box.classList.add('mc-used'); c.fn(); });
      }
      box.appendChild(el);
    });
    return push(box);
  }

  function hasEl(id) { return !!document.getElementById(id); }
  function mailHref(body) {
    return 'mailto:' + CFG.mail + '?subject=' + encodeURIComponent(T.subj) + (body ? '&body=' + encodeURIComponent(body) : '');
  }
  function demoLinks() {
    var l = [];
    if (hasEl('demo-videos')) l.push({ label: T.links.video, href: '#demo-videos', fill: true, onclick: closePanel });
    l.push({ label: T.links.pharm, href: 'medit-app-dark.html' });
    l.push({ label: T.links.patient, href: 'medit-patient.html' });
    return l;
  }

  // ---- 흐름
  function start() {
    T = TXT[lang()];
    st = { mode: null, kind: null, date: '', slot: '' };
    log.innerHTML = '';
    bot(T.hello);
    bot(T.note, 'mc-small');
    menu();
  }

  function menu() {
    var m = T.menu;
    chips([
      { label: m.demo, fill: true, fn: function () { me(m.demo); pickMode('demo'); } },
      { label: m.pilot, fn: function () { me(m.pilot); pickMode('pilot'); } },
      { label: m.watch, fn: function () { me(m.watch); showWatch(); } },
      { label: m.ask, fn: function () { me(m.ask); pickMode('ask'); } },
      { label: m.mail, fn: function () { me(m.mail); showMail(); } }
    ]);
  }

  function again() {
    chips([{ label: T.again, fn: function () { start(); } }]);
  }

  function pickMode(mode) {
    st.mode = mode;
    st.kind = mode === 'pilot' ? 'pilot' : 'demo';
    st.date = ''; st.slot = '';
    if (mode === 'demo') askDate(); else askForm();
  }

  function showWatch() {
    bot(T.watchIntro);
    chips(demoLinks());
    again();
  }

  function showMail() {
    bot(T.mailIntro);
    chips([{ label: T.mailBtn + ' · ' + CFG.mail, href: mailHref(''), fill: true }]);
    again();
  }

  // 달력·신청서처럼 긴 말풍선은 안내 문구가 위에 보이도록 맞춘다.
  function showFromIntro(intro) { log.scrollTop = Math.max(0, intro.offsetTop - 8); }

  function askDate() {
    var intro = bot(T.pickDate);
    push(buildCal(function (iso) {
      st.date = iso;
      me(fmtDate(iso));
      askTime();
    }));
    showFromIntro(intro);
    chips([{ label: T.noDate, fn: function () { me(T.noDate); st.date = ''; askForm(); } }]);
  }

  function buildCal(onPick) {
    var today = kstToday(), minIso = addDays(today, CFG.leadDays), maxIso = addDays(today, CFG.horizonDays);
    function isAv(iso) { return iso >= minIso && iso <= maxIso && CFG.days.indexOf(wdOf(iso)) >= 0; }
    var first = minIso, i;
    for (i = 0; i <= CFG.horizonDays; i++) { var c = addDays(minIso, i); if (isAv(c)) { first = c; break; } }
    var y = +first.slice(0, 4), m = +first.slice(5, 7);
    var minY = +minIso.slice(0, 4), minM = +minIso.slice(5, 7), maxY = +maxIso.slice(0, 4), maxM = +maxIso.slice(5, 7);

    var wrap = h('div', { class: 'mc-cal', role: 'group', 'aria-label': T.calLabel });
    var title = h('div', { class: 'mc-cal-t', 'aria-live': 'polite' });
    var prev = h('button', { type: 'button', class: 'mc-nav', 'aria-label': T.prev, text: '‹' });
    var next = h('button', { type: 'button', class: 'mc-nav', 'aria-label': T.next, text: '›' });
    var grid = h('div', { class: 'mc-grid' });
    wrap.appendChild(h('div', { class: 'mc-cal-h' }, [prev, title, next]));
    wrap.appendChild(grid);

    function draw() {
      var offset = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
      var days = new Date(Date.UTC(y, m, 0)).getUTCDate();
      title.textContent = T.month(y, m);
      prev.disabled = (y < minY) || (y === minY && m <= minM);
      next.disabled = (y > maxY) || (y === maxY && m >= maxM);
      grid.innerHTML = '';
      T.wk.forEach(function (w) { grid.appendChild(h('div', { class: 'mc-wd', text: w })); });
      var k;
      for (k = 0; k < offset; k++) grid.appendChild(h('span'));
      for (k = 1; k <= days; k++) {
        (function (d) {
          var iso = y + '-' + pad(m) + '-' + pad(d);
          if (isAv(iso)) {
            grid.appendChild(h('button', {
              type: 'button', class: 'mc-day mc-av', text: String(d),
              'aria-label': T.dayAria(y, m, d, T.wk[wdOf(iso)]),
              onclick: function () { wrap.classList.add('mc-done'); onPick(iso); }
            }));
          } else {
            grid.appendChild(h('span', { class: 'mc-day', text: String(d), 'aria-hidden': 'true' }));
          }
        })(k);
      }
    }
    prev.addEventListener('click', function () { m--; if (m < 1) { m = 12; y--; } draw(); });
    next.addEventListener('click', function () { m++; if (m > 12) { m = 1; y++; } draw(); });
    draw();
    return wrap;
  }

  function askTime() {
    bot(T.pickTime(fmtDate(st.date)));
    var list = CFG.slots.map(function (s) {
      return { label: s[lang()], fn: function () { me(s[lang()]); st.slot = s.v; askForm(); } };
    });
    list.push({ label: CFG.written[lang()], fn: function () { me(CFG.written[lang()]); st.slot = CFG.written.v; askForm(); } });
    chips(list);
  }

  function askForm() {
    var intro = bot(T.formIntro[st.mode]);
    var t0 = Date.now();
    var f = h('form', { class: 'mc-b mc-bot mc-wide mc-form', novalidate: '', autocomplete: 'on' });
    var ids = 'mc' + Date.now();
    function row(key, label, input, hint) {
      var id = ids + key;
      input.id = id; input.name = key;
      f.appendChild(h('label', { class: 'mc-l', for: id, text: label }));
      f.appendChild(input);
      if (hint) f.appendChild(h('div', { class: 'mc-hint', text: hint }));
      return input;
    }
    var name = row('name', T.f.name, h('input', { type: 'text', maxlength: '60', autocomplete: 'name' }));
    var org = row('org', T.f.org, h('input', { type: 'text', maxlength: '100', autocomplete: 'organization', placeholder: T.f.orgPh }));
    var email = row('email', T.f.email, h('input', { type: 'email', maxlength: '120', autocomplete: 'email', inputmode: 'email' }));
    var phone = row('phone', T.f.phone, h('input', { type: 'tel', maxlength: '30', autocomplete: 'tel', placeholder: T.f.phonePh }));
    var msg = row('message', T.f.msg, h('textarea', { maxlength: '900', placeholder: T.f.msgPh }), T.f.msgHint);
    var hp = h('input', { type: 'text', name: 'website', tabindex: '-1', autocomplete: 'off' });
    f.appendChild(h('div', { class: 'mc-hp', 'aria-hidden': 'true' }, [hp]));
    var consent = h('input', { type: 'checkbox', id: ids + 'c' });
    f.appendChild(h('label', { class: 'mc-consent', for: ids + 'c' }, [consent, h('span', { text: T.consent })]));
    var det = h('details', { class: 'mc-det' }, [h('summary', { text: T.detailTitle }), h('ul', null, T.detail.map(function (x) { return h('li', { text: x }); }))]);
    if (hasEl('privacy')) {
      det.appendChild(h('div', null, [h('a', { href: '#privacy', text: T.policy, onclick: closePanel })]));
    }
    f.appendChild(det);
    var submit = h('button', { type: 'submit', class: 'mc-submit', text: T.submit });
    var status = h('div', { class: 'mc-status', role: 'status', 'aria-live': 'polite' });
    f.appendChild(submit); f.appendChild(status);
    push(f);
    showFromIntro(intro);
    try { name.focus({ preventScroll: true }); } catch (e) { /* ignore */ }

    function setStatus(text, bad, html) {
      status.className = 'mc-status' + (bad ? ' mc-bad' : '');
      if (html) status.innerHTML = html; else status.textContent = text || '';
    }
    function bad(el, key) {
      el.classList.add('mc-err');
      setStatus(T.err[key] || T.err.server, true);
      try { el.focus(); } catch (e) { /* ignore */ }
    }
    function mailFallback(p) {
      var body = [p.kind, p.name, p.org, p.email, p.phone, p.preferred_date, p.preferred_slot, p.message].filter(Boolean).join('\n');
      return ' <a href="' + mailHref(body).replace(/&/g, '&amp;') + '">' + T.mailLink + '</a> (' + CFG.mail + ')';
    }

    f.addEventListener('submit', function (e) {
      e.preventDefault();
      [name, org, email, phone, consent].forEach(function (x) { x.classList.remove('mc-err'); });
      setStatus('');
      var userMsg = msg.value.trim();
      var p = {
        kind: st.kind, name: name.value.trim(), org: org.value.trim(), email: email.value.trim(), phone: phone.value.trim(),
        preferred_date: st.date, preferred_slot: st.slot,
        message: ('[채팅] ' + userMsg).slice(0, 990),
        website: hp.value, consent: !!consent.checked, elapsed_ms: 0
      };
      if (!p.name) return bad(name, 'name');
      if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(p.email)) return bad(email, 'email');
      if (p.kind === 'pilot' && !p.org) return bad(org, 'org');
      if (p.phone && !/^[0-9+\-() ]{8,20}$/.test(p.phone)) return bad(phone, 'phone');
      if (!p.consent) return bad(consent, 'consent');

      submit.disabled = true;
      setStatus(T.sending);
      // 접수 함수는 입력 시간이 1.5초 미만이면 봇으로 본다. 자동 완성으로 아주 빨리 끝낸 경우를 위해 조금 기다린다.
      var wait = Math.max(0, 1700 - (Date.now() - t0));
      new Promise(function (res) { setTimeout(res, wait); }).then(function () {
        p.elapsed_ms = Date.now() - t0;
        return send(p);
      }).then(function (x) {
        if (x.j && x.j.ok) { finish(f, p, userMsg, x.j.token); return; }
        var j = x.j || {};
        if (x.s === 429 && j.error === 'too_fast') setStatus(T.err.fast, true);
        else if (x.s === 429) setStatus('', true, T.err.rate + mailFallback(p));
        else if (x.s === 400 && j.field === 'preferred_date') setStatus(T.err.preferred_date, true);
        else if (x.s === 400 && j.field && T.err[j.field]) {
          var el = { name: name, org: org, email: email, phone: phone }[j.field];
          if (el) bad(el, j.field); else setStatus(T.err[j.field], true);
        } else setStatus('', true, T.err.server + mailFallback(p));
        submit.disabled = false;
      }, function () {
        setStatus('', true, T.err.net + mailFallback(p));
        submit.disabled = false;
      });
    });
  }

  // 접수 서버는 한동안 쓰이지 않으면 첫 요청이 한 번 실패할 수 있다. 서버 오류(5xx)일 때만 1.5초 뒤 한 번 더 보낸다.
  function send(p) {
    function attempt() {
      var ctl = ('AbortController' in window) ? new AbortController() : null;
      var to = setTimeout(function () { if (ctl) ctl.abort(); }, 15000);
      return fetch(CFG.endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p),
        signal: ctl ? ctl.signal : undefined
      }).then(function (r) {
        return r.json().catch(function () { return { ok: false, error: 'server' }; }).then(function (j) { clearTimeout(to); return { s: r.status, j: j }; });
      }, function (err) { clearTimeout(to); throw err; });
    }
    return attempt().then(function (x) {
      if (!(x.j && x.j.ok) && x.s >= 500) return new Promise(function (res) { setTimeout(res, 1500); }).then(attempt);
      return x;
    });
  }

  function finish(form, p, userMsg, token) {
    var when = [p.preferred_date ? fmtDate(p.preferred_date) : '', p.preferred_slot ? slotLabel(p.preferred_slot) : ''].filter(Boolean).join(' · ');
    var kind = T.kindLabel[st.mode] || '';
    var box = h('div', null, [
      h('div', { class: 'mc-done-t', text: T.doneTitle }),
      h('div', { text: T.doneP1 }),
      h('div', { class: 'mc-sum', text: kind + (when ? ' · ' + when : '') }),
      h('div', { class: 'mc-small', style: 'margin-top:.55rem', text: T.doneP2 }),
      h('div', { style: 'margin-top:.2rem' }, [h('a', { href: 'mailto:' + CFG.mail, text: CFG.mail })])
    ]);
    var b = h('div', { class: 'mc-b mc-bot' }, [box]);
    log.replaceChild(b, form);
    scrollEnd();
    // 데모·시범 신청이면, 신청별 개인용 안내 페이지(일정 고르기·시스템/계약 상담)로 이어지는 버튼을 준다
    if ((st.mode === 'demo' || st.mode === 'pilot') && typeof token === 'string' && /^[0-9a-f]{32}$/.test(token)) {
      bot(T.guideIntro);
      chips([{ label: T.guideBtn, href: 'medit-booking.html?t=' + token, fill: true }]);
    }
    bot(T.watchNow + ' ' + T.watchIntro);
    chips(demoLinks());
    again();
  }

  // ---- 열고 닫기
  function openPanel() {
    if (!log.childNodes.length) start();
    panel.classList.add('mc-open');
    fab.style.display = 'none';
    fab.setAttribute('aria-expanded', 'true');
    scrollEnd();
    try { panel.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  }
  function closePanel() {
    panel.classList.remove('mc-open');
    fab.style.display = '';
    fab.setAttribute('aria-expanded', 'false');
  }

  function init() {
    T = TXT[lang()];
    var style = h('style', { id: 'mc-style' });
    style.textContent = CSS;
    document.head.appendChild(style);

    fab = h('button', { type: 'button', class: 'mc-fab', 'aria-label': T.openLabel, 'aria-expanded': 'false', 'aria-haspopup': 'dialog' });
    fab.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-3.6-.8L3 20l1.1-4.9A8.4 8.4 0 1 1 21 11.5z"/></svg>';
    fab.appendChild(h('span', { text: T.fab }));
    fab.addEventListener('click', openPanel);

    log = h('div', { class: 'mc-log', role: 'log', 'aria-live': 'polite', 'aria-label': T.title });
    var close = h('button', { type: 'button', class: 'mc-ib', 'aria-label': T.close, text: '×' });
    close.addEventListener('click', function () { closePanel(); fab.focus(); });
    var restart = h('button', { type: 'button', class: 'mc-ib', 'aria-label': T.restart, title: T.restart, text: '↺' });
    restart.addEventListener('click', start);
    var head = h('div', { class: 'mc-head' }, [
      h('img', { src: 'media/apple-touch-icon.png', alt: '', width: '34', height: '34' }),
      h('div', { class: 'mc-ht' }, [h('b', { text: T.title }), h('span', { text: T.sub })]),
      restart, close
    ]);
    panel = h('div', { class: 'mc-panel', role: 'dialog', 'aria-label': T.title, tabindex: '-1' }, [head, log]);
    panel.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { closePanel(); fab.focus(); }
    });

    root = h('div', { class: 'mc-root' }, [fab, panel]);
    document.body.appendChild(root);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
