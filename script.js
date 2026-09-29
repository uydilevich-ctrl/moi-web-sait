const nav=document.getElementById('nav');
const onScroll=()=>nav.classList.toggle('solid',scrollY>40);
onScroll();addEventListener('scroll',onScroll,{passive:true});
document.getElementById('y').textContent=new Date().getFullYear();
// контакты пока не заполнены: заглушки не ведут никуда
document.querySelectorAll('[data-todo]').forEach(a=>a.addEventListener('click',e=>e.preventDefault()));
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{threshold:.12});
document.querySelectorAll('.section h2,.services li,.work,.steps li,.about-text,.links').forEach(el=>{el.classList.add('reveal');io.observe(el)});
