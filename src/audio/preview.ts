import { Audio } from '@/audio/audio';

const audio = new Audio();
const status = document.querySelector<HTMLElement>('#status')!;
const style = document.querySelector<HTMLSelectElement>('#style')!;
const volume = document.querySelector<HTMLInputElement>('#volume')!;
const timers: ReturnType<typeof setTimeout>[] = [];
let active: HTMLElement | null = null, request = 0;
let start = 0, seconds = 0;
const later = (time: number, fn: () => void) => timers.push(setTimeout(fn, time * 1000));
function stop(): void {
  request++;
  for (const timer of timers) clearTimeout(timer);
  timers.length = 0;
  audio.setScene('hub');
  audio.setScene('paused');
  active?.classList.remove('playing'); active = null;
  status.textContent = 'Stopped · choose another sound.';
}
function mix(engines = 0, music = 0): void {
  audio.setMix({master:Number(volume.value), effects:.85, engines, music});
}
const examples = [
  {title:'Cannon', note:'Three energy cracks with different transients and mechanical weight.', seconds:2, play:() => { audio.cannon(); later(.18,()=>audio.cannon()); later(.36,()=>audio.cannon()); }},
  {title:'Missile & explosion', note:'Launch pressure, a heavy impact and a textured debris tail.', seconds:5, play:() => { audio.launch(); later(1,()=>audio.explosion(1.3)); }},
  {title:'Hull & hit feedback', note:'Small metallic hits separated from the heavier damage response.', seconds:3, play:() => { audio.hit(); later(.5,()=>audio.hit()); later(1.1,()=>audio.damage()); }},
  {title:'Engines & boost', note:'Idle texture builds into thrust, ignition and the sustained boost bed.', seconds:8, play:() => { mix(.6); audio.update(.15,false); later(2,()=>audio.update(.6,false)); later(4,()=>audio.update(1,true)); later(6.5,()=>audio.update(.5,false)); }},
  {title:'Gate crossing', note:'Chevron locks, the aperture pressure release and the wormhole wash.', seconds:9, play:() => { audio.setScene('travel'); for(let n=0;n<7;n++)later(n*.19,()=>audio.chevron(n+1,n===6)); later(1.6,()=>audio.kawoosh()); later(3.7,()=>audio.wormhole(4.4)); }},
  {title:'Powered tricks', note:'Cobra pressure sweep, Vortex drive and a directional Sidewinder exit.', seconds:8.5, play:() => { audio.move(null); audio.move('cobra'); later(2.7,()=>audio.move('lunge')); later(5.3,()=>audio.move('scissor-left')); }},
  {title:'Lock & mission cues', note:'Rounded confirmation sounds with a resonant success phrase.', seconds:4, play:() => { audio.lock(); later(.8,()=>audio.ring()); later(1.5,()=>audio.win()); }},
  {title:'Ambient bed', note:'The quiet existing adaptive score, from open space into combat tension.', seconds:9, play:() => { mix(0,.65); audio.setMood('calm'); later(3,()=>audio.setMood('combat')); later(7,()=>audio.setMood('win')); }},
  {title:'Combat mix', note:'Hear engines, short weapon bursts and an explosion together.', seconds:7, play:() => { mix(.6,.35); audio.setMood('combat'); audio.update(.6,false); for(let n=0;n<10;n++)later(.6+n*.13,()=>audio.cannon()); later(2.2,()=>audio.launch()); later(3.4,()=>audio.explosion(1.4)); later(4.7,()=>audio.update(1,true)); }},
];
for (const example of examples) {
  const card = document.createElement('section'); card.className = 'card';
  const title = document.createElement('h2'); title.textContent = example.title;
  const note = document.createElement('p'); note.textContent = example.note;
  const button = document.createElement('button'); button.textContent = `Play ${example.title}`;
  const progress = document.createElement('div'); progress.className='progress';progress.innerHTML='<i></i>';
  button.addEventListener('click', async () => {
    stop(); const token = request;
    audio.setScene('flight'); audio.unlock(); mix();
    status.textContent = 'Preparing sound bank…';
    await audio.bank.ready;
    if (token !== request) return;
    audio.setCinematic(style.value === 'new');
    active=card; card.classList.add('playing'); start=performance.now(); seconds=example.seconds;
    status.textContent=`Playing ${example.title} · ${style.value==='new' ? audio.bank.status : 'Original synthesis'}`;
    example.play(); later(example.seconds,()=>{stop();status.textContent='Finished · compare another sound set or fly the sandbox.';});
  });
  card.append(title,note,button,progress);document.querySelector('#sounds')!.append(card);
}
document.querySelector('#stop')!.addEventListener('click',stop);
style.addEventListener('change',stop);
volume.addEventListener('input',()=>{ document.querySelector<HTMLOutputElement>('#volume-label')!.value=`${Math.round(Number(volume.value)*100)}%`;stop(); });
window.addEventListener('pagehide',stop);
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
setInterval(()=>{
  if(active)active.querySelector<HTMLElement>('.progress i')!.style.width=`${Math.min(100,(performance.now()-start)/(seconds*10))}%`;
},80);
