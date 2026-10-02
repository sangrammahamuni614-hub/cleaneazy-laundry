(function(){
  'use strict';
  var menu=document.querySelector('.menu-toggle');
  var nav=document.querySelector('.site-nav');
  var toast=document.getElementById('booking-toast');
  var toastTimer;
  document.getElementById('year').textContent=String(new Date().getFullYear());
  function closeMenu(){if(!menu||!nav)return;menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label','Open navigation');nav.classList.remove('is-open');}
  if(menu&&nav){menu.addEventListener('click',function(){var open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'Close navigation':'Open navigation');nav.classList.toggle('is-open',open);});nav.querySelectorAll('a').forEach(function(link){link.addEventListener('click',closeMenu);});document.addEventListener('keydown',function(event){if(event.key==='Escape')closeMenu();});}
  function book(event){var config=window.CLEANEAZY_SITE||{};var number=String(config.whatsappNumber||'').replace(/\D/g,'');if(number.length>=10){event.preventDefault();var message=encodeURIComponent('Hello CleanEazy Laundry, I would like to book a pickup in Pune.');window.open('https://wa.me/'+number+'?text='+message,'_blank','noopener,noreferrer');return;}event.preventDefault();if(toast){toast.classList.add('is-visible');window.clearTimeout(toastTimer);toastTimer=window.setTimeout(function(){toast.classList.remove('is-visible');},6500);}}
  document.querySelectorAll('.js-book').forEach(function(link){link.addEventListener('click',book);});
  var dismiss=toast&&toast.querySelector('button');if(dismiss)dismiss.addEventListener('click',function(){toast.classList.remove('is-visible');});
})();

