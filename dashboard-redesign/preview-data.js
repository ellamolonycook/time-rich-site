/* Local design fixture based on the observed portal, NOT live account data.
   No API calls, sign-in, progress writes, or production credential storage. */
document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('[data-portal-name]').forEach(function (el) { el.textContent = 'Iltifat'; });
  var titles = ['Preparation: complete your Business COMPASS', 'Welcome to the Superhuman Accelerator', 'Business COMPASS', 'Answer the onboarding questions', 'Add every session to your calendar', 'Join the Superhuman WhatsApp group', 'How to install a skill', 'Lock down my Claude'];
  var dates = ['2026-10-26T16:00:00Z','2026-10-28T16:00:00Z','2026-10-30T16:00:00Z','2026-11-02T17:00:00Z','2026-11-06T17:00:00Z','2026-11-09T17:00:00Z','2026-11-13T17:00:00Z','2026-11-16T17:00:00Z','2026-11-18T17:00:00Z','2026-11-20T17:00:00Z'];
  var data = {weeks:[{id:0,title:'Start here',summary:'Preparation. Complete these before kickoff on Monday 26 October, starting with your Business COMPASS.',unlocked:true,items:titles.map(function(title,i){return {id:i+1,title:title,sort:i};})},{id:1,title:'Diagnose and train',unlocked:false},{id:2,title:'Your AI operating system',unlocked:false},{id:3,title:'Story and content',unlocked:false},{id:4,title:'Your unfair advantage',unlocked:false}],sessions:dates.map(function(date,i){return {id:i+1,title:i===0?'Open Business Surgery':'Program session',starts_at:date,join_url:'https://timerich.ai/portal/sessions.html',addevent_url:i===0?'https://www.addevent.com/event/wtdb8gcsbv7z':null};}),progress:{items:[],sessions:[]}};
  var names=['Open Business Surgery','Bonus: Multi-LLM & Setting Your Harness','Training Your Agent','Your AI Operating System','Expert Q&A','Storytelling for GTM','The AI Content Machine + Q&A','Unfair AI Advantage','Networking Session','Q&A: Exited Founder'];
  data.sessions.forEach(function(s,i){s.title=names[i];s.week_id=i<3?1:i<5?2:i<7?3:4;});
  data.weeks.forEach(function(w,i){if(i){w.release_at=['','2026-10-26T04:00:00Z','2026-11-02T05:00:00Z','2026-11-09T05:00:00Z','2026-11-16T05:00:00Z'][i];w.title='Week '+i+': '+w.title;}});
  data.weeks[0].items[2].kind='skill';data.weeks[0].items[2].url='compass-superhuman.zip';data.weeks[0].items[2].body='Builds your Business COMPASS from your own calls, docs and email, then fills the gaps with a short interview.';
  data.weeks[0].items[7].kind='skill';data.weeks[0].items[7].url='security-superhuman.zip';data.weeks[0].items[7].body='Three privacy settings in your AI, before you connect anything.';
  window.TR_PORTAL_DATA = data;
  document.dispatchEvent(new CustomEvent('trportal:data',{detail:data}));
  document.querySelectorAll('[data-portal-members-link]').forEach(function(el){el.hidden=false;});
  // The review link opens the real sessions page; it never joins a call.
  var join = document.querySelector('[data-dash-next] a');
  if(join) join.textContent = 'Join via Zoom';
  document.querySelectorAll('.trp-progress-note').forEach(function(el){el.textContent='Preview data · your account is unchanged';});
});
