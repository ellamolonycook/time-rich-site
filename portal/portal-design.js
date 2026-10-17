/* Presentation enhancements over the current portal; original content and handlers stay intact. */
(function () {
  'use strict';
  var page = document.body.dataset.portalPage;
  var main = document.querySelector('main');
  if (!page || !main) return;
  function el(tag, cls, text) { var n=document.createElement(tag); n.className=cls||''; if(text)n.textContent=text; return n; }
  if(page==='dashboard') {
    var hero=main.querySelector('header'), copy=el('div','ui-hero-copy');
    hero.className='ui-hero';while(hero.firstChild)copy.append(hero.firstChild);
    var kicker=copy.querySelector('.trp-kicker'), greeting=copy.querySelector('h1');
    var program=el('h1','ui-program-title',kicker.textContent);kicker.replaceWith(program);
    var welcome=el('p','ui-welcome');while(greeting.firstChild)welcome.append(greeting.firstChild);greeting.replaceWith(welcome);
    var video=el('video');video.controls=true;video.preload='none';video.playsInline=true;video.poster='../accelerator/accelerator-promo-poster.jpg';video.src='assets/accelerator-promo.mp4';video.setAttribute('aria-label','Superhuman Accelerator introduction');
    hero.append(copy,video);
    var next=main.querySelector('[data-dash-next]'), progress=main.querySelector('[data-portal-progress]'), start=main.querySelector('[data-dash-start]');
    var focus=next.parentElement,support=start.parentElement;
    focus.className='ui-dashboard-focus';support.className='ui-dashboard-support';
    var learning=el('section','ui-learning');learning.setAttribute('aria-label','Your learning and progress');learning.append(start,progress);focus.prepend(learning);
    var connect=support.querySelector('.trp-connect'),helpCard=support.querySelector('.trp-aside');
    var side=el('aside','ui-dashboard-side');side.setAttribute('aria-label','Sessions and support');side.append(next,connect,helpCard);focus.append(side);support.remove();
    var shortcuts=el('nav','ui-shortcuts');shortcuts.setAttribute('aria-label','Portal shortcuts');
    [['curriculum','Curriculum'],['resources','Resources'],['prompts','Prompts']].forEach(function(pair,i){
      var a=el('a','');a.href=pair[0]+'.html';a.append(el('span','ui-shortcut-n','0'+(i+1)),document.createTextNode(pair[1]));
      var svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');
      var path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d','M5 12h14m-6-6 6 6-6 6');svg.append(path);a.append(svg);shortcuts.append(a);
    });focus.before(shortcuts);
  }
  var nav=document.querySelector('#top-nav nav');
  if(nav) document.querySelector('#top-nav').insertBefore(nav,document.querySelector('#top-nav').lastElementChild);
  var sponsor=document.querySelector('#top-nav .trp-powered');
  if(sponsor){
    document.querySelector('#top-nav > div').append(sponsor);
    sponsor.querySelectorAll('img').forEach(function(img){img.remove();});
    var logo=el('span','ui-stanley-clean');logo.setAttribute('role','img');logo.setAttribute('aria-label','Stanley');sponsor.append(logo);
  }
  var drawer=document.getElementById('mobile-menu'), menuButton=document.getElementById('mobile-menu-btn');
  if(drawer&&menuButton){
    var close=el('button','ui-drawer-close','×');close.type='button';close.setAttribute('aria-label','Close menu');drawer.prepend(close);
    close.addEventListener('click',function(){menuButton.click();});
    function syncDrawer(){var open=menuButton.getAttribute('aria-expanded')==='true';drawer.inert=!open;drawer.setAttribute('aria-hidden',String(!open));if(open)close.focus();else if(drawer.contains(document.activeElement))menuButton.focus();}
    new MutationObserver(syncDrawer).observe(menuButton,{attributes:true,attributeFilter:['aria-expanded']});syncDrawer();
    drawer.addEventListener('keydown',function(event){
      if(event.key!=='Tab')return;
      var items=Array.from(drawer.querySelectorAll('a[href],button')).filter(function(n){return !n.disabled&&n.getClientRects().length;});
      var first=items[0],last=items[items.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    });
  }

  // Use the existing theme handler so the stored preference and other controls agree.
  var select=document.querySelector('[data-theme-select]');
  if(select) {
    var toggle=el('button','ui-theme');toggle.type='button';toggle.setAttribute('role','switch');toggle.setAttribute('aria-label','Night mode');
    toggle.innerHTML='<span class="ui-theme-thumb"></span><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14a8 8 0 0 1-10-10 8.5 8.5 0 1 0 10 10Z"/></svg>';
    var media=window.matchMedia('(prefers-color-scheme: dark)');
    function dark(){var t=document.documentElement.dataset.theme;return t==='dark'||(t==='system'&&media.matches);}
    function paint(){toggle.setAttribute('aria-checked',String(dark()));toggle.title=dark()?'Switch to day mode':'Switch to night mode';}
    select.parentElement.after(toggle);select.parentElement.hidden=true;
    toggle.addEventListener('click',function(){select.value=dark()?'light':'dark';select.dispatchEvent(new Event('change',{bubbles:true}));paint();});
    new MutationObserver(paint).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});media.addEventListener('change',paint);paint();
  }
  var content=el('div','ui-content'), shell=el('div','ui-layout');
  while(main.firstChild)content.append(main.firstChild);
  var rail=el('aside','ui-rail');
  rail.append(el('p','ui-eyebrow','SUPERHUMAN ACCELERATOR'));
  rail.append(el('h2','',({dashboard:'Your workspace',curriculum:'Your learning path',sessions:'Your live sessions',resources:'Your toolkit',prompts:'Your prompt library',members:'Your community'})[page]));
  var jumps=el('nav','ui-jumps');jumps.setAttribute('aria-label','On this page');rail.append(jumps);
  var help=el('a','ui-help','Need a hand? ↗');help.href='mailto:emc@timerich.ai';rail.append(help);
  shell.append(rail,content);main.append(shell);
  var input,status;
  if(page==='prompts'||page==='resources') {
    var tools=el('div','ui-library-tools');var label=el('label','ui-search');
    label.append(el('span','sr-only',page==='prompts'?'Search prompts':'Search resources'));
    input=el('input');input.type='search';input.placeholder=page==='prompts'?'Search prompts, skills or phrases…':'Search skills, templates and guides…';
    label.append(input);status=el('p','ui-search-status');status.setAttribute('role','status');
    tools.append(label,status);var header=content.querySelector('header');if(header)header.after(tools);
    input.addEventListener('input',filter);
  }
  function filter(){
    if(!input)return;
    var query=input.value.trim().toLowerCase(), total=0, shown=0;
    var cards=content.querySelectorAll(page==='prompts'?'.trp-ptemplate,.trp-pcard':'.trp-rrow,section[aria-labelledby="agents-heading"],.trp-faq details');
    cards.forEach(function(card){total++;var match=card.textContent.toLowerCase().includes(query);card.hidden=!match;if(match)shown++;});
    if(page==='resources')content.querySelectorAll('.trp-wkcard').forEach(function(group){
      var rows=Array.from(group.querySelectorAll('.trp-rrow'));
      if(rows.length)group.hidden=rows.every(function(row){return row.hidden;});
    });
    if(page==='resources') {
      content.querySelectorAll('section').forEach(function(section){
        var results=Array.from(section.querySelectorAll('.trp-rrow,.trp-faq details'));
        if(results.length)section.hidden=results.every(function(row){return row.hidden;});
      });
      content.querySelectorAll('.trp-coming').forEach(function(card){card.hidden=!!query;});
    }
    status.textContent=shown?shown+' of '+total+' '+(page==='prompts'?'prompts':'resources'):'No matches. Try a different search.';
    jumps.querySelectorAll('a').forEach(function(a){var target=document.getElementById(a.hash.slice(1));a.hidden=!!(target&&target.closest('[hidden]'));});
  }
  var serial=0;
  function enhance(){
    content.querySelectorAll('.ui-learning .trp-progress-track').forEach(function(track){
      var max=Number(track.getAttribute('aria-valuemax')),value=Number(track.getAttribute('aria-valuenow'));
      var percent=max?Math.max(0,Math.min(100,Math.round(value/max*100))):0;
      track.style.setProperty('--ui-progress',percent+'%');track.dataset.percent=percent+'%';
      if(!track.querySelector('svg')){
        var ring=document.createElementNS('http://www.w3.org/2000/svg','svg');ring.setAttribute('viewBox','0 0 100 100');ring.setAttribute('aria-hidden','true');ring.classList.add('ui-progress-ring');
        ['ui-ring-base','ui-ring-value'].forEach(function(cls){var circle=document.createElementNS(ring.namespaceURI,'circle');circle.setAttribute('cx','50');circle.setAttribute('cy','50');circle.setAttribute('r','44');circle.setAttribute('pathLength','100');circle.setAttribute('class',cls);ring.append(circle);});track.append(ring);
      }
      track.querySelector('.ui-ring-value').style.strokeDashoffset=String(100-percent);
    });
    // Current curriculum cards and session/resource groups use native disclosures.
    content.querySelectorAll('.trp-check,.trp-wkcard:not(.is-locked)').forEach(function(card){
      if(card.dataset.designReady)return;
      var head=card.querySelector('.trp-check-head,.trp-wkcard-head');if(!head)return;
      card.dataset.designReady='true';
      var details=el('details','ui-accordion');details.open=true;
      var summary=el('summary','ui-summary');summary.append(head,el('span','ui-chevron'));
      var body=el('div','ui-accordion-body');while(card.firstChild)body.append(card.firstChild);
      details.append(summary,body);card.append(details);
      summary.addEventListener('click',function(event){
        if(event.target.closest('a,button,input'))return;
        if(!details.animate||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
        event.preventDefault();
        var next=!details.open;
        var from=details.getBoundingClientRect().height;
        if(details._animation){next=!details._desired;details._animation.cancel();}
        details._desired=next;details.open=true;
        var to=next?details.scrollHeight:summary.getBoundingClientRect().height;
        details.style.overflow='hidden';summary.setAttribute('aria-expanded',String(next));
        details._animation=details.animate([{height:from+'px'},{height:to+'px'}],{duration:230,easing:'cubic-bezier(.2,.8,.2,1)'});
        details._animation.onfinish=function(){details.open=next;details.style.overflow='';details._animation=null;summary.removeAttribute('aria-expanded');};
      });
    });
    jumps.replaceChildren();
    var targets=content.querySelectorAll(page==='prompts'?'.trp-ptemplate .trp-pcard-name,.trp-pcard-name':page==='members'?'.members-search':'h2');
    targets.forEach(function(target){
      if(target.closest('[hidden]')||target.closest('.ui-shortcuts'))return;
      var anchor=target.closest('[data-portal-setup]')||target;
      if(!anchor.id)anchor.id='ui-section-'+(++serial);
      var a=el('a','',target.textContent);a.href='#'+anchor.id;
      a.addEventListener('click',function(){var details=target.closest('details');if(details&&!details.open)details.open=true;});jumps.append(a);
    });
    filter();
  }
  document.addEventListener('trportal:data',function(){queueMicrotask(enhance);});
  document.addEventListener('trportal:progress',function(){queueMicrotask(enhance);});
  enhance();
})();
