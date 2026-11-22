// Pointer coordinates remain physical when the page uses a 90-degree view.
export function screenFraction(rect,point,rotated=false){
 const x=(point.clientX-rect.left)/rect.width,y=(point.clientY-rect.top)/rect.height;
 return rotated?{x:y,y:1-x}:{x,y};
}
export function screenDelta(x,y,rotated=false){return rotated?{x:y,y:-x}:{x,y};}
export function rotatedScreen(element){return !!element.closest('body.screen-rotated');}
