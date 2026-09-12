"""Rebuild the original layered sound bank. Requires numpy and ffmpeg, no model/service.
Kenney CC0 source clips are retained in docs/audio-source/kenney with their license.
"""
from pathlib import Path
import json, subprocess, wave, hashlib
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/audio'
SRC = ROOT / 'docs/audio-source/kenney'
OUT.mkdir(parents=True, exist_ok=True)
RATE = 44100
rng = np.random.default_rng(3022026)
metrics = {}
clips = {}

def read(name):
    data = subprocess.check_output(['ffmpeg','-v','error','-i',str(SRC / (name+'.ogg')),'-f','f32le','-ac','1','-ar',str(RATE),'-'])
    return np.frombuffer(data,dtype='<f4').astype(np.float64)

def fit(x, seconds):
    n = round(seconds*RATE)
    return np.pad(x[:n], (0,max(0,n-len(x))))

def shift(x, seconds, length):
    return fit(np.pad(x,(round(seconds*RATE),0)),length)

def sweep(seconds, start, end, decay=5, amp=1):
    t = np.arange(round(seconds*RATE))/RATE
    f = end + (start-end)*np.exp(-t*8/max(.1,seconds))
    return np.sin(np.cumsum(f)*2*np.pi/RATE)*np.exp(-t*decay)*amp*(1-np.exp(-t*900))

def noise(seconds, lo, hi, decay=0):
    n=round(seconds*RATE);x=rng.standard_normal(n)
    freq=np.fft.rfftfreq(n,1/RATE)
    filt=(1-np.exp(-(freq/max(1,lo))**4))*np.exp(-(freq/hi)**4)
    x=np.fft.irfft(np.fft.rfft(x)*filt,n)
    x=x/max(.01,np.sqrt(np.mean(x*x)))
    return x*np.exp(-np.arange(n)/RATE*decay)

def bell(seconds, freq, decay):
    t=np.arange(round(seconds*RATE))/RATE
    return (np.sin(2*np.pi*freq*t)+.18*np.sin(2*np.pi*freq*2.76*t))*np.exp(-t*decay)*(1-np.exp(-t*400))

def tail(x, seconds, wet=.15):
    left=fit(x,seconds);right=left.copy()
    for dt,g in [(.037,.5),(.083,.3),(.139,.22),(.213,.12)]:
        left+=shift(x,dt,seconds)*g*wet
        right+=shift(x,dt*1.17,seconds)*g*wet
    return np.column_stack((left,right))

def emit(name,x,loop=False,peak=.78):
    if x.ndim==1:x=tail(x,len(x)/RATE+.15)
    x-=np.mean(x,axis=0)
    x=np.tanh(x*.85)
    if loop:
        # crossfade end into start, then choose the join inside this shared blend
        k=round(.15*RATE);r=np.linspace(0,1,k)[:,None]
        blend=x[-k:]*(1-r)+x[:k]*r
        x=np.vstack((blend,x[k:-k],blend[:1]))
    else:
        a=min(round(.006*RATE),len(x));b=min(round(.03*RATE),len(x))
        x[:a]*=np.linspace(0,1,a)[:,None];x[-b:]*=np.linspace(1,0,b)[:,None]
    x*=peak/max(.001,float(np.max(np.abs(x))))
    pcm=np.clip(x*32767,-32767,32767).astype('<i2')
    target=OUT/(name+'.ogg')
    subprocess.run(['ffmpeg','-v','error','-y','-f','s16le','-ar',str(RATE),'-ac','2','-i','-','-c:a','libvorbis','-q:a','4',str(target)],input=pcm.tobytes(),check=True)
    clips[name]=x
    metrics[name]={'seconds':len(x)/RATE,'peak':float(np.max(np.abs(x))),'rms':float(np.sqrt(np.mean(x*x))),'bytes':target.stat().st_size,'loop':loop}

# Cannon: a short energy crack, a low mechanical impulse, and a quieter resonant tail.
for i in range(3):
    dur=.75
    raw=fit(read('laserLarge_%03d'%i),dur)
    x=.6*raw+fit(sweep(.24,145,62,14,.45),dur)+.07*noise(dur,950,9000,23)
    emit('cannon-'+str(i),tail(x,dur+.16,.24),peak=.70)
    metal=fit(read('impactMetal_%03d'%i),.7)
    emit('hit-'+str(i),tail(.65*metal+fit(sweep(.14,410,160,25,.18),.7),.85,.3),peak=.57)
    exp=fit(read('explosionCrunch_%03d'%i),2.4)
    low=fit(read('lowFrequency_explosion_000'),2.4)
    body=.4*noise(2.4,35,620,2.8)
    x=.55*exp+.35*low+body+fit(sweep(1.7,92,32,2.8,.45),2.4)
    emit('explosion-'+str(i),tail(x,2.9,.42),peak=.86)

metal=fit(read('impactMetal_001'),.9)
emit('damage',tail(metal*.7+fit(sweep(.45,110,34,7,.7),.9),1.1,.15))
x=.2*noise(1.1,90,2300,3)+sweep(1.1,260,65,5,.35)
x+=fit(read('thrusterFire_000')[:round(1.1*RATE)],1.1)*.55
emit('missile',tail(x,1.4,.2))
for name,freq in [('ui',880),('lock',1175),('ring',660),('chevron',340)]:
    dur=.65 if name!='ui' else .24
    x=.24*bell(dur,freq,9 if name!='ui' else 23)
    x+=shift(bell(dur,freq*1.5,11)*.13,.08,dur)
    if name=='chevron':x+=fit(read('impactMetal_002'),dur)*.35
    emit(name,tail(x,dur+.18,.6),peak=.35 if name=='ui' else .52)
emit('chevron-lock',tail(fit(read('impactMetal_000'),1.2)*.65+fit(sweep(.8,115,40,4,.55),1.2),1.4,.4))
for name,chord in [('win',[0,4,7,12]),('lose',[0,-3,-7])]:
    dur=2.5;x=np.zeros(round(dur*RATE))
    for i,note in enumerate(chord):x+=shift(bell(1.6,330*2**(note/12),2.4)*.3,i*.16,dur)
    emit(name,tail(x,3,.55),peak=.58)

# Gate aperture: reverse intake, broad pressure release, metallic resonance and sub decay.
dur=3.2;t=np.arange(round(dur*RATE))/RATE
wash=noise(dur,50,4500)*np.exp(-np.maximum(0,t-.3)*1.7)*np.minimum(1,t/.16)
x=.30*wash+shift(read('explosionCrunch_001')*.5,.19,dur)+shift(sweep(2.8,94,28,1.7,.65),.14,dur)
x+=.11*bell(dur,117,1.1)
emit('gate-open',tail(x,3.8,.65),peak=.86)
# Continuous crossing: soft ramp into layered turbulence and rising harmonic shimmer.
dur=4.4;t=np.arange(round(dur*RATE))/RATE;env=np.sin(np.pi*t/dur)**.65
wash=noise(dur,80,2600)*(.32+.09*np.sin(t*3.1))
hum=sweep(dur,58,42,.05,.2)+.10*np.sin(np.cumsum(190+90*np.sin(t/dur*np.pi))*2*np.pi/RATE)
emit('wormhole',tail((wash+hum)*env,4.55,.5),peak=.76)

for name,clip,colour in [('engine','spaceEngineLow_000',.05),('boost','spaceEngineLarge_000',.08)]:
    x=read(clip);dur=len(x)/RATE;t=np.arange(len(x))/RATE
    x=x*.7+colour*np.sin(2*np.pi*48*t)+noise(dur,75,1400)*.025
    emit(name,np.column_stack((x,np.roll(x,round(.009*RATE)))),loop=True,peak=.48)
emit('boost-start',tail(.3*noise(.8,120,2200,4)+sweep(.8,120,38,5,.35),1,.25),peak=.67)
for name,freq,dur in [('cobra',250,2.3),('vortex',150,2.1),('sidewinder-left',330,2.5),('sidewinder-right',330,2.5)]:
    t=np.arange(round(dur*RATE))/RATE
    body=.16*noise(dur,120,2500)*np.sin(np.pi*t/dur)**.7
    body+=sweep(dur,freq,42,1.4,.3)
    body+=shift(sweep(.7,100,35,5,.45),dur-.8,dur)
    pair=tail(body,dur+.15,.35)
    if 'sidewinder' in name:
        pan=np.sin(np.pi*np.minimum(1,t/dur))*.55*(1 if name.endswith('right') else -1)
        pair[:len(t),0]*=1-pan;pair[:len(t),1]*=1+pan
    emit('move-'+name,pair,peak=.65)

# An audible reel, with breathing room between families. Not an in-game loudness measurement.
reel=np.zeros((round(27*RATE),2))
for name,at,g in [('engine',0,.5),('boost-start',3,.7),('boost',3,.35),('cannon-0',8,.8),('cannon-1',8.45,.8),('cannon-2',8.9,.8),('missile',10.1,.85),('explosion-1',11.3,.9),('chevron',15,.8),('chevron-lock',15.6,.8),('gate-open',16.4,.9),('wormhole',20,.7),('move-vortex',24,.85)]:
    start=round(at*RATE);n=min(len(clips[name]),len(reel)-start);reel[start:start+n]+=clips[name][:n]*g
reel=np.tanh(reel);reel*=.86/max(.01,np.max(np.abs(reel)))
reel_path=ROOT/'docs/audio-source/audio-showcase.wav'
with wave.open(str(reel_path),'wb') as f:f.setnchannels(2);f.setsampwidth(2);f.setframerate(RATE);f.writeframes((reel*32767).astype('<i2').tobytes())
(OUT/'manifest.json').write_text(json.dumps(metrics,indent=2)+'\n')
(SRC.parent/'sources.json').write_text(json.dumps({'pack':'Kenney Sci-Fi Sounds 1.0','license':'CC0-1.0','url':'https://opengameart.org/sites/default/files/sci-fi_sounds.zip','sourceFiles':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in SRC.glob('*.ogg')},'generator':'scripts/build-audio.py','sampleRate':RATE},indent=2)+'\n')
print(json.dumps({'sounds':len(metrics),'bytes':sum(m['bytes'] for m in metrics.values()),'maxPeak':max(m['peak'] for m in metrics.values()),'showcase':str(reel_path)},indent=2))
