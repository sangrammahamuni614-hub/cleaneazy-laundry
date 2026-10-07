const menuButton = document.querySelector('.menu-toggle');
const nav = document.querySelector('.site-nav');
menuButton?.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? 'मेनू बंद करा' : 'मेनू उघडा');
});
nav?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
  nav.classList.remove('open');
  menuButton?.setAttribute('aria-expanded', 'false');
}));
document.querySelector('#year').textContent = new Date().getFullYear().toLocaleString('mr-IN');

const whatsappNumber = window.CLEANEAZY_SITE?.whatsappNumber || '';
const whatsappLink = document.querySelector('#whatsapp-contact');
if (/^91\d{10}$/.test(whatsappNumber) && whatsappLink) {
  whatsappLink.href = `https://wa.me/${whatsappNumber}`;
  whatsappLink.textContent = `WhatsApp वर चौकशी करा · +91 ${whatsappNumber.slice(2, 7)} ${whatsappNumber.slice(7)}`;
  whatsappLink.hidden = false;
}
