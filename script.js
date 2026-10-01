const nav=document.getElementById('nav');
const onScroll=()=>nav.classList.toggle('solid',scrollY>40);
onScroll();addEventListener('scroll',onScroll,{passive:true});
document.getElementById('y').textContent=new Date().getFullYear();
// контакты пока не заполнены: заглушки не ведут никуда
document.querySelectorAll('[data-todo]').forEach(a=>a.addEventListener('click',e=>e.preventDefault()));
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{threshold:.12});
document.querySelectorAll('.section h2,.services li,.project,.card,.video-tile,.steps li,.about-text,.links').forEach(el=>{el.classList.add('reveal');io.observe(el)});

// Портфолио: окно со всеми работами серии
const MARKET='Карточки для маркетплейсов';
const PROJECTS={
  bag:{eyebrow:MARKET,title:'Сумка кросс-боди',items:[['bag-1.jpg','Главный слайд'],['bag-2.jpg','Детали'],['bag-3.jpg','Размеры'],['bag-4.jpg','На модели']]},
  candle:{eyebrow:MARKET,title:'Ароматическая свеча',items:[['candle-1.jpg','Главный слайд'],['candle-2.jpg','Ноты аромата'],['candle-3.jpg','Характеристики'],['candle-4.jpg','Атмосфера']]},
  sweater:{eyebrow:MARKET,title:'Свитер оверсайз',items:[['sweater-1.jpg','Главный слайд'],['sweater-2.jpg','Фактура'],['sweater-3.jpg','Размеры'],['sweater-4.jpg','На модели']]},
  cards:{eyebrow:'Цифровые открытки',title:'Все открытки',items:[['cards-cover.webp','Обложка серии'],['cards-birthday-her.webp','С Днём рождения'],['cards-birthday-him.webp','С Днём рождения, для него'],['cards-mom.webp','Любимой маме'],['cards-baby.webp','С рождением малыша'],['cards-newyear-cozy.webp','С наступающим Новым годом'],['cards-newyear-gold.webp','С Новым годом'],['cards-partners-navy.webp','Партнёрам, синяя'],['cards-partners-gold.webp','Партнёрам, золотая'],['cards-kids.webp','Детский день рождения']]}
};
const box=document.getElementById('lightbox');
const boxSlides=box.querySelector('.lightbox-slides');
document.querySelectorAll('[data-project]').forEach(btn=>btn.addEventListener('click',()=>{
  const p=PROJECTS[btn.dataset.project];
  box.querySelector('#lightbox-eyebrow').textContent=p.eyebrow;
  box.querySelector('#lightbox-title').textContent=p.title;
  boxSlides.classList.remove('single');
  boxSlides.classList.toggle('five',p.items.length>=5);
  boxSlides.innerHTML=p.items.map(([src,cap])=>`<figure><img src="assets/work/${src}" alt="${p.title}: ${cap}"><figcaption>${cap}</figcaption></figure>`).join('');
  box.showModal();
  // на телефоне сразу прокручиваем к выбранной работе
  const i=+btn.dataset.index||0;
  if(i)boxSlides.children[i].scrollIntoView({block:'nearest',inline:'center'});
}));
// Видео: открываем крупно со звуком
document.querySelectorAll('[data-video]').forEach(btn=>btn.addEventListener('click',()=>{
  box.querySelector('#lightbox-eyebrow').textContent='AI-видео';
  box.querySelector('#lightbox-title').textContent=btn.dataset.title;
  boxSlides.classList.remove('five');boxSlides.classList.add('single');
  const v=btn.dataset.video;
  boxSlides.innerHTML=`<video controls autoplay playsinline poster="${btn.dataset.poster}"><source src="${v}.mp4" type='video/mp4; codecs="avc1.64001F, mp4a.40.2"'><source src="${v}.webm" type='video/webm; codecs="vp9, opus"'></video>`;
  box.showModal();
}));
// Превью роликов играют без звука, только пока видны на экране
const vio=new IntersectionObserver(es=>es.forEach(e=>{const v=e.target;if(e.isIntersecting){v.play().catch(()=>{})}else v.pause()}),{threshold:.4});
document.querySelectorAll('.video-tile video').forEach(v=>vio.observe(v));
box.querySelector('.lightbox-close').addEventListener('click',()=>box.close());
// при закрытии окна останавливаем видео
box.addEventListener('close',()=>{boxSlides.classList.remove('single');boxSlides.innerHTML=''});
box.addEventListener('click',e=>{if(e.target===box)box.close()});

// Главный экран: заголовок виден, пока в видео пустой фон с точкой
// (начало и конец петли), и по буквам растворяется на время показа работ.
const hero=document.querySelector('.hero');
const heroVideo=hero.querySelector('.hero-video');
const h1=hero.querySelector('h1');
const heroLabel=h1.innerText.replace(/\s+/g,' ').trim();
let n=0;
(function split(node){
  [...node.childNodes].forEach(ch=>{
    if(ch.nodeType===3){
      const frag=document.createDocumentFragment();
      [...ch.textContent].forEach(c=>{
        if(c===' '){frag.append(' ');return}
        const s=document.createElement('span');s.className='ch';s.style.setProperty('--i',n++);s.textContent=c;frag.append(s);
      });
      ch.replaceWith(frag);
    }else if(ch.nodeName!=='BR')split(ch);
  });
})(h1);
h1.setAttribute('aria-label',heroLabel);
hero.querySelectorAll('.eyebrow,.sub,.btn').forEach(el=>el.classList.add('fade'));
const SHOW_UNTIL=3.6, SHOW_FROM=9.3;   // секунды в 10-секундной петле
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
function syncHeroText(){
  const t=heroVideo.currentTime, playing=!heroVideo.paused&&heroVideo.readyState>2;
  hero.classList.toggle('text-off',!reduce&&playing&&t>SHOW_UNTIL&&t<SHOW_FROM);
  requestAnimationFrame(syncHeroText);
}
requestAnimationFrame(syncHeroText);
