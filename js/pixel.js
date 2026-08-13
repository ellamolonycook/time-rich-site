/* Meta Pixel — Time Rich
   Loaded from every page via <script src="/js/pixel.js"></script> in the head.
   The pixel ID lives here and nowhere else: change it once, it changes site-wide.
   Until PIXEL_ID is a real numeric ID this file does nothing at all. */
(function () {

  var PIXEL_ID = '1790181495468842'; // Meta Events Manager > Data sources > Pixel ID

  if (!/^\d{6,}$/.test(PIXEL_ID)) return;

  !function(f,b,e,v,n,t,s)
  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
  n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t,s)}(window,document,'script',
  'https://connect.facebook.net/en_US/fbevents.js');

  fbq('init', PIXEL_ID);
  fbq('track', 'PageView');

})();
