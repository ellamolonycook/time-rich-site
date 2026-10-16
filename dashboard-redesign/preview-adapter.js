/* Local review only. No authentication, downloads, or remote account writes. */
window.TRPortal={
  setProgress:function(){return Promise.resolve(true);},
  skillButton:function(item){var b=document.createElement('button');b.type='button';b.textContent='Download skill';b.className='preview-download';b.disabled=true;b.title='Downloads are disabled in the local preview';return b;}
};
