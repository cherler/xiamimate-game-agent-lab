// Judge against sound reaching the output device, not the render queue ahead of it.
export function audibleTime(context,now=performance.now()){
 const current=context.currentTime,stamp=context.getOutputTimestamp?.();
 if(stamp&&stamp.contextTime>0&&Number.isFinite(stamp.performanceTime)&&now>=stamp.performanceTime&&now-stamp.performanceTime<500)return Math.max(0,Math.min(current,stamp.contextTime+(now-stamp.performanceTime)/1000));
 return Math.max(0,current-Math.max(0,Number(context.outputLatency)||Number(context.baseLatency)||0));
}
