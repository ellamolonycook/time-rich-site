/* Shared UI only: navigation, client-side filtering, and accessible accordions.
   All original content nodes and their existing event handlers are retained. */
(function(){
  'use strict';
  var page=document.body.dataset.portalPage;
  var main=document.querySelector('main');
  var rail, jump, status;
  if(page&&main){
    var shell=document.createElement('div');shell.className='portal-layout';
    var content=document.createElement('div');content.className='portal-content';
    while(main.firstChild)content.append(main.firstChild);
    rail=document.createElement('aside');rail.className='portal-rail';
    var label=document.createElement('p');label.className='rail-label';label.textContent='SUPERHUMAN ACCELERATOR';rail.append(label);
    var heading=document.createElement('h2');heading.textContent={curriculum:'Your learning path',sessions:'Your live sessions',resources:'Your toolkit',prompts:'Your prompt library',members:'Your community'}[page];rail.append(heading);
    var rule=document.createElement('div');rule.className='rail-rule';rail.append(rule);
    jump=document.createElement('nav');jump.setAttribute('aria-label','On this page');rail.append(jump);
    var help=document.createElement('a');help.href='mailto:emc@timerich.ai';help.className='rail-help';help.textContent='Need help? ↗';rail.append(help);
    shell.append(rail,content);main.append(shell);
    if(document.body.hasAttribute('data-local-preview')){
      var note=document.createElement('p');note.className='preview-notice';
      note.textContent=page==='members'?'Local preview · fictional profiles for design review.':'Local preview · sample content; your account is unchanged.';
      content.prepend(note);
    }
    if(page==='prompts'||page==='resources'){
      var header=content.querySelector('header');var bar=document.createElement('div');bar.className='library-tools';
      var label2=document.createElement('label');label2.className='library-search';
      var caption=document.createElement('span');caption.textContent=page==='prompts'?'Search prompts':'Search resources';caption.className='sr-only';
      var input=document.createElement('input');input.type='search';input.placeholder=page==='prompts'?'Search by skill or phrase…':'Search skills and templates…';
      label2.append(caption,input);status=document.createElement('p');status.className='filter-status';status.setAttribute('role','status');
      bar.append(label2,status);header.after(bar);
      input.addEventListener('input',function(){filter(input.value);});
    }
  }
  function filter(value){
    var selector=page==='prompts'?'.trp-pcard':'#skill-library .trp-wkcard';
    var cards=Array.from(document.querySelectorAll(selector));var shown=0;
    cards.forEach(function(card){var match=card.textContent.toLowerCase().includes(value.trim().toLowerCase());card.hidden=!match;if(match)shown++;});
    if(jump)jump.querySelectorAll('a').forEach(function(link){var target=document.getElementById(link.hash.slice(1));link.hidden=!!(target&&target.closest('[hidden]'));});
    if(status)status.textContent=shown?shown+' '+(page==='prompts'?'prompt':'group')+(shown===1?'':'s'):'No matches. Try a different search.';
  }
  var serial=0;
  function enhance(){
    document.querySelectorAll('.trp-wkcard:not(.is-locked):not([data-ui-ready])').forEach(function(card){
      var head=card.querySelector('.trp-wkcard-head'),rows=card.querySelector('.trp-srows,.trp-rrows');
      if(!head||!rows)return;card.dataset.uiReady='true';
      var details=document.createElement('details');details.className='portal-accordion';
      details.open=page!=='sessions'||!card.parentElement.querySelector('details');
      var summary=document.createElement('summary');summary.className='portal-summary';
      summary.append(head);var arrow=document.createElement('span');arrow.className='accordion-chevron';arrow.setAttribute('aria-hidden','true');summary.append(arrow);
      details.append(summary,rows);card.append(details);
    });
    // Replace the original click-only installation panel with native details.
    document.querySelectorAll('main [onclick]').forEach(function(panel){
      if(!panel.getAttribute('onclick').includes('is-open'))return;
      var ol=panel.querySelector('ol');if(!ol)return;
      var details=document.createElement('details');details.className='trp-acc install-accordion';
      var sum=document.createElement('summary');sum.className='trp-acc-head';
      var title=panel.querySelector('h3');sum.textContent=title?title.textContent:'How to add a skill';
      var arrow=document.createElement('span');arrow.className='accordion-chevron';sum.append(arrow);
      var body=document.createElement('div');body.className='trp-acc-body';
      var intro=panel.querySelector('h3 + p');if(intro)body.append(intro);body.append(ol);
      details.append(sum,body);panel.replaceWith(details);
    });
    document.querySelectorAll('main details:not([data-smooth])').forEach(smooth);
    if(jump){
      jump.replaceChildren();
      var targets=page==='curriculum'||page==='sessions'?document.querySelectorAll('.trp-wkcard'):page==='resources'?document.querySelectorAll('.trp-section-title,.install-accordion>summary'):page==='prompts'?document.querySelectorAll('.trp-pcard-name'):document.querySelectorAll('.members-search');
      targets.forEach(function(target,i){
        if(target.closest('[hidden]'))return;
        if(!target.id)target.id='portal-section-'+(++serial);
        var a=document.createElement('a');a.href='#'+target.id;
        a.addEventListener('click',function(){var detail=target.matches('summary')?target.parentElement:target.querySelector('details');if(detail&&!detail.open)detail.querySelector('summary').click();});
        var title=target.querySelector('.trp-tag');a.textContent=title?title.textContent:page==='members'?'Find a member':target.textContent;
        var number=document.createElement('span');number.textContent=String(i+1).padStart(2,'0');a.prepend(number);jump.append(a);
      });
    }
    if(status)filter(document.querySelector('.library-search input').value);
  }
  var accordionControls=new Map();
  function smooth(details){
    var summary=details.querySelector(':scope > summary');if(!summary)return;details.dataset.smooth='true';
    var animation=null,desired=details.open;
    summary.setAttribute('aria-expanded',String(details.open));
    details.addEventListener('toggle',function(){if(!animation)summary.setAttribute('aria-expanded',String(details.open));});
    function setOpen(open){
      var from=details.getBoundingClientRect().height;desired=open;
      if(animation){animation.cancel();animation=null;}
      summary.setAttribute('aria-expanded',String(desired));
      if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){
        details.open=desired;details.style.height='';details.style.overflow='';return;
      }
      details.open=true;details.style.height='';details.style.overflow='hidden';
      var style=getComputedStyle(details);
      var borders=parseFloat(style.borderTopWidth)+parseFloat(style.borderBottomWidth);
      var to=desired?details.getBoundingClientRect().height:summary.getBoundingClientRect().height+borders;
      animation=details.animate([{height:from+'px'},{height:to+'px'}],{duration:240,easing:'cubic-bezier(.2,.8,.2,1)'});
      summary.setAttribute('aria-expanded',String(desired));
      animation.onfinish=function(){details.open=desired;details.style.height='';details.style.overflow='';animation=null;};
    }
    accordionControls.set(details,setOpen);
    summary.addEventListener('click',function(e){
      if(e.target.closest('a,button,input'))return;
      e.preventDefault();
      var open=animation?!desired:!details.open;
      var group=details.closest('.trp-connect');
      if(open&&group){
        group.querySelectorAll('details.trp-acc').forEach(function(other){
          if(other!==details&&other.open&&accordionControls.has(other))accordionControls.get(other)(false);
        });
      }
      setOpen(open);
    });
  }
  document.addEventListener('trportal:data',function(){queueMicrotask(enhance);});
  document.addEventListener('DOMContentLoaded',enhance);
  if(document.readyState!=='loading')enhance();
})();
