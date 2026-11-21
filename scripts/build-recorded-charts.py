# Extract the chosen melodic voices from the bundled original XM scores.
# This intentionally supports only the effects used in these excerpts, not arbitrary XM files.
import struct,json,pathlib,collections

def read(p):
 b=p.read_bytes();hs,length,restart,ch,npat,nins,flags,speed,bpm=struct.unpack_from('<I8H',b,60);order=list(b[80:80+length]);pos=60+hs;patterns=[]
 for _ in range(npat):
  size,packing,rows,packed=struct.unpack_from('<IBHH',b,pos);data=b[pos+size:pos+size+packed];pos+=size+packed;at=0;events=[]
  for row in range(rows):
   items=[]
   for channel in range(ch):
    v=[0]*5
    if at<len(data):
     mask=data[at];at+=1
     if mask&128:
      for k in range(5):
       if mask&(1<<k):v[k]=data[at];at+=1
     else:v=[mask]+list(data[at:at+4]);at+=4
    items.append(v)
   events.append(items)
  patterns.append(events)
 instruments=[]
 for i in range(nins):
  size=struct.unpack_from('<I',b,pos)[0];name=b[pos+4:pos+26].split(b'\0')[0].decode('latin1');ns=struct.unpack_from('<H',b,pos+27)[0];sh=struct.unpack_from('<I',b,pos+29)[0] if ns else 0
  info={'id':i+1,'name':name,'samples':ns,'voltype':b[pos+233] if size>233 else 0};pos+=size;samplebytes=0;types=[]
  for _ in range(ns):samplebytes+=struct.unpack_from('<I',b,pos)[0];types.append(b[pos+14]);pos+=sh
  pos+=samplebytes;info['types']=types;instruments.append(info)
 return dict(channels=ch,order=order,speed=speed,bpm=bpm,patterns=patterns,instruments=instruments)

ROOT=pathlib.Path(__file__).resolve().parents[1]
# The released Ogg exports run about 0.227% faster than the nominal XM grid.
# Calibrated against attacks throughout both source recordings (see CREDITS.md).
RECORDING_RATE=44000/44100
charts={}
for name,start,length in [('street',20,45),('raspberry',17.142857142857,51.42857142857)]:
 d=read(ROOT/'assets/music/scores'/('my-street.xm' if name=='street' else 'raspberry-jam.xm'));time=0.;channels=d['channels'];active=[None]*channels;instrument=[0]*channels;events=[];speed=d['speed'];bpm=d['bpm'];selectedOrders={}
 for order,patid in enumerate(d['order']):
  pat=d['patterns'][patid]
  selectedOrders[order]=0 if name=='street' else (9 if any(0<r[9][0]<97 for r in pat) else 7)
  for row,cells in enumerate(pat):
   for channel,e in enumerate(cells):
    note,ins,volume,fx,param=e
    if ins:instrument[channel]=ins
    if fx==15:
     if param<32:speed=param
     else:bpm=param
    at=time+(param%16*2.5/bpm if fx==14 and param>>4==13 else 0)
    if note:
     if active[channel]:active[channel]['end']=at;active[channel]=None
     if note<97 and fx!=3:
      event=dict(at=at,end=None,midi=note+11,channel=channel,ins=instrument[channel],row=row,order=order);events.append(event);active[channel]=event
   time+=speed*2.5/bpm
   if any(e[3]==13 for e in cells):break
  if time>start+length+10:break
 for e in events:
  if e['end'] is None:e['end']=time
 chosen=[e for e in events if e['channel']==selectedOrders[e['order']] and start-1e-6<=e['at']<start+length-.4]
 pitches=sorted(set(e['midi'] for e in chosen));free=[-1000]*4;notes=[]
 for e in chosen:
  at=round((e['at']-start)*1000*RECORDING_RATE,4);lane=min(3,int(pitches.index(e['midi'])*4/len(pitches)))
  # My Street's source instruments are plucks with sub-0.4-second envelopes.
  # Raspberry's synth/piano have sustained envelopes; holds end at the source note-off.
  duration=round((e['end']-e['at'])*1000*RECORDING_RATE,4) if name=='raspberry' and e['ins'] in (9,11,12) and .45<=e['end']-e['at']<=2.2 else 0
  if at+duration>length*1000-150:duration=0
  lanes=sorted(range(4),key=lambda l:abs(l-lane));lane=next((l for l in lanes if at>free[l]+85),None)
  if lane is None:continue
  notes.append(dict(at=at,lane=lane,midi=e['midi'],duration=duration,offbeat=e['row']%4!=0,sourceOrder=e['order'],sourceRow=e['row'],sourceChannel=e['channel']));free[lane]=at+duration
 charts[name]=dict(bpm=144 if name=='street' else 112,clipStart=start*RECORDING_RATE,clipDuration=length*RECORDING_RATE,recordingRate=RECORDING_RATE,notes=notes)
 print(name,'notes',len(notes),'holds',sum(n['duration']>0 for n in notes),'first',notes[:2])
(ROOT/'src/rhythm-recorded.json').write_text(json.dumps(charts,ensure_ascii=False,separators=(',',':'))+'\n')
