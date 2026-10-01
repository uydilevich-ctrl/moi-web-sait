const nav=document.getElementById('nav');
const onScroll=()=>nav.classList.toggle('solid',scrollY>40);
onScroll();addEventListener('scroll',onScroll,{passive:true});
document.getElementById('y').textContent=new Date().getFullYear();
// контакты пока не заполнены: заглушки не ведут никуда
document.querySelectorAll('[data-todo]').forEach(a=>a.addEventListener('click',e=>e.preventDefault()));
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{threshold:.12});
document.querySelectorAll('.section h2,.services li,.project,.steps li,.about-text,.links').forEach(el=>{el.classList.add('reveal');io.observe(el)});

// Портфолио: окно со всеми слайдами серии
const PROJECTS={
  bag:{title:'Сумка кросс-боди',slides:['Главный слайд','Детали','Размеры','На модели']},
  candle:{title:'Ароматическая свеча',slides:['Главный слайд','Ноты аромата','Характеристики','Атмосфера']},
  sweater:{title:'Свитер оверсайз',slides:['Главный слайд','Фактура','Размеры','На модели']}
};
const box=document.getElementById('lightbox');
const boxSlides=box.querySelector('.lightbox-slides');
document.querySelectorAll('[data-project]').forEach(btn=>btn.addEventListener('click',()=>{
  const key=btn.dataset.project,p=PROJECTS[key];
  box.querySelector('#lightbox-title').textContent=p.title;
  boxSlides.innerHTML=p.slides.map((cap,i)=>`<figure><img src="assets/work/${key}-${i+1}.jpg" alt="${p.title}: ${cap}"><figcaption>${cap}</figcaption></figure>`).join('');
  box.showModal();
}));
box.querySelector('.lightbox-close').addEventListener('click',()=>box.close());
box.addEventListener('click',e=>{if(e.target===box)box.close()});
