# Audio upgrade · 2026-09-12

Ethan requested much better audio, generated locally or sourced free online. Implemented 27 stereo Ogg sounds (about 689 KiB), combining preserved Kenney CC0 textures with deterministic local synthesis. No AI audio model was used. Cannon, hit and explosion variations; missile, damage, UI, gate and mission cues; looped engine/boost beds; one cue for each powered move. Existing adaptive music remains, with quieter independent mix and stereo reflection.

## Review

Open `/audio-preview.html` to compare nine examples using the real game Audio class. New layered sounds / Original placeholders selects the sample bank or procedural fallback. The old palette has no dedicated powered-trick sound. The offline [27-second showcase](../audio-source/audio-showcase.wav) presents the authored bank, not a browser recording. Game settings under Esc → Sound mix persist master, effects, engine and ambient levels.

## Verification

All five commands passed; complete output is in [audio-upgrade-checks](audio-upgrade-checks): production build, audio scene/lifecycle/mix/fallback checks, decoded asset checks, sandbox handling and episode compatibility. Asset checks cover all 27 stereo files, finite samples, nonzero signal, headroom, duration and loop joins. Runtime checks cover replay timing, pause/unlock, scene cancellation, bounded voices, shot variations, moves and failed-download fallback.

Native in-app browser: Cannon, Gate crossing and Combat mix reported all 27 buffers decoded; original Cannon used synthesis; Stop canceled playback. Engine volume changed from 60% to 45%, survived reload and was restored to 60%. Sound room screenshot inspected. These establish wiring and UI behavior; perceived sound quality, headphone/speaker balance and normal-flight listening have not been verified by a human.

## Reproduction and provenance

`python scripts/build-audio.py` requires NumPy and ffmpeg. `python scripts/audio-assets-check.py` validates outputs. Source textures, license and SHA256 manifest are preserved in [audio-source](../audio-source); researched alternatives in [audio sources](../refs/audio-sources.md). Downloaded reference archives in the session cache can be recreated from those URLs; they contain no unique authored work. No deployment performed.
