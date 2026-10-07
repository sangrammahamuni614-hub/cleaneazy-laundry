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
