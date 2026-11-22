// Rotate the overview on tall canvases; rules, routes and saves stay in 24 × 16.
export function rescueToCanvas(point,width,height){
 return height>width?{x:(1-point.y/16)*width,y:point.x/24*height}:{x:point.x/24*width,y:point.y/16*height};
}
export function rescueFromCanvas(point,width,height){
 return height>width?{x:point.y*24,y:(1-point.x)*16}:{x:point.x*24,y:point.y*16};
}
export function rescueTransform(width,height){return height>width?[0,height/24,-width/16,0,width,0]:[width/24,0,0,height/16,0,0];}
