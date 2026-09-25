from pathlib import Path
import subprocess, json, numpy as np
from scipy.signal import correlate
p=Path(__file__).parent

def decode(f):
 return np.frombuffer(subprocess.check_output(['ffmpeg','-v','error','-i',str(f),'-ar','48000','-ac','1','-f','f32le','-']),dtype=np.float32)
out=decode(p/'out/promo.mp4')
rows=[]
for filename,target,peak in [('transition-soft.mp3',28,13.5),('paper-slide.mp3',420,10.65),('swoosh-quick.mp3',750,8.25)]:
 src=decode(p/'public/audio'/filename)[:16000]
 designed=int(np.floor(target-peak-1.274+.5))
 start=max(0,designed*1600-5000); window=out[start:start+len(src)+10000]
 lag=int(np.argmax(correlate(window,src,mode='valid',method='fft')))
 actual=(start+lag)/1600
 rows.append({'file':filename,'scheduledFrame':designed,'measuredStartFrame':round(actual,3),'outputOffsetFrames':round(actual-designed,3),'peakResidualFrames':round(actual+peak-target,3)})
result={'pipeline':'Remotion 4.0.484 / H.264 + AAC / 48000 Hz / MP4','date':'2026-09-09','duration':len(out)/48000,'maxVolumeDb':float(20*np.log10(max(abs(out)))),'probes':rows}
(p/'out/audio-output-analysis.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2))
