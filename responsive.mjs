// Reserve the real fixed chrome size, including safe areas and enlarged text.
export function installResponsiveLayout(){
  const shell=document.querySelector('.app-shell');
  const nav=document.querySelector('#bottom-nav');
  const top=document.querySelector('.labbar');
  const root=document.documentElement;
  let frame=0;
  const update=()=>{
    frame=0;
    const bounds=shell.getBoundingClientRect();
    const values={
      '--app-width':bounds.width,
      '--app-left':bounds.left,
      '--nav-height':nav.getBoundingClientRect().height,
      '--top-obstruction':getComputedStyle(top).position==='sticky'?top.getBoundingClientRect().height:0
    };
    for(const [key,value] of Object.entries(values)){
      const px=`${Math.ceil(value)}px`;
      if(root.style.getPropertyValue(key)!==px)root.style.setProperty(key,px);
    }
  };
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(update);};
  const observer=new ResizeObserver(schedule);
  [shell,nav,top].forEach(element=>observer.observe(element));
  window.addEventListener('resize',schedule,{passive:true});
  document.fonts?.ready.then(schedule);
  update();
}
