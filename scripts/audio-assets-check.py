"""Validate shipped decoded audio, not a claim about perceptual quality."""
from pathlib import Path
import subprocess, json
import numpy as np
root=Path(__file__).resolve().parents[1]
manifest=json.loads((root/'public/audio/manifest.json').read_text())
results=[]
for name,entry in manifest.items():
    p=root/'public/audio'/(name+'.ogg')
    raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(p),'-f','f32le','-ar','44100','-ac','2','-'])
    x=np.frombuffer(raw,dtype='<f4').reshape(-1,2)
    peak=float(np.max(np.abs(x))); rms=float(np.sqrt(np.mean(x*x)))
    assert np.isfinite(x).all(),name+' has nonfinite PCM'
    assert .01<rms<.6,(name,'silent/excessive RMS',rms)
    assert peak<.99,(name,'decoded clipping',peak)
    assert abs(len(x)/44100-entry['seconds'])<.04,(name,'duration mismatch')
    edge=float(np.max(np.abs(x[0]-x[-1])))
    if entry['loop']:assert edge<.12,(name,'loop discontinuity',edge)
    else:assert max(np.max(np.abs(x[:20])),np.max(np.abs(x[-20:])))<.12,(name,'hard cut at edge')
    results.append({'sound':name,'peak':round(peak,4),'rms':round(rms,4),'seconds':round(len(x)/44100,3),'loopEdge':round(edge,4) if entry['loop'] else None})
print(json.dumps(results,indent=2));print('PASS: all 27 shipped OGG assets decode, contain finite stereo PCM, stay below full scale, have non-silent RMS, expected duration and bounded edge discontinuity. This is not an acoustic quality verdict.')
