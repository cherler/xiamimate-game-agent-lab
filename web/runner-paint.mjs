export function poly(c,color,pts){c.fillStyle=color;c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();}
export function oval(c,color,x,y,rx,ry){c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();}
export function box(c,color,x,y,w,h,r=0){c.fillStyle=color;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();}
export function stroke(c,color,width,points){c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();}
export function star(c,x,y,size,color){poly(c,color,Array.from({length:10},(_,i)=>{const a=i*Math.PI/5-Math.PI/2,r=i%2?size*.45:size;return [x+Math.cos(a)*r,y+Math.sin(a)*r];}));}
export function blend(a,b,t){return '#'+[1,3,5].map(i=>Math.round(parseInt(a.slice(i,i+2),16)*(1-t)+parseInt(b.slice(i,i+2),16)*t).toString(16).padStart(2,'0')).join('');}
export const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
