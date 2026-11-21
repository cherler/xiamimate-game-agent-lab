# Music assets

The following six recordings and the two original XM scores are supplied by their authors under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). Source pages checked 2026-11-21. The repository's code license does not replace these asset licenses.

| File | Original / author | Original source | Excerpt |
| --- | --- | --- | --- |
| street.mp3; scores/my-street.xm | My Street — congusbongus | https://opengameart.org/content/my-street | 19.954649–64.852608 s |
| raspberry.mp3; scores/raspberry-jam.xm | Raspberry Jam — congusbongus | https://opengameart.org/content/raspberry-jam | 17.103984–68.415938 s |
| raceway.mp3 | Pure Raceway — MintoDog | https://opengameart.org/content/pure-raceway | 0–48 s |
| skyline.mp3 | Sky Blue Street — MintoDog | https://opengameart.org/node/170985 | 0–46.545455 s |
| calm.mp3 | Calm Theme — pebonius | https://opengameart.org/content/calm-music-0 | 0–48 s |
| tension.mp3 | Tension — tapatilorenzo | https://opengameart.org/content/midi-2-tension-songs | 0–51 s |

`xiami.mp3` is a 50-second excerpt from the project owner's existing MiniMax Music 3.0 instrumental for the mirror-animation project (2026-07-23): playful xylophone, plucked strings and woodwind. It is reused with the owner's request; it is **not represented as a CC0 community recording**. It was reused without a new generation in the earlier music refresh.

Audio adaptations: stereo 44.1 kHz MP3 at 112 kbit/s, metadata removed, loudness normalization (`loudnorm=I=-18:TP=-2:LRA=11`). Background playback adds 12 ms boundary fades while retaining the original excerpt length. Rhythm gameplay plays the recording once without those fades or an additional synthesized melody.

Rebuild the two recorded-song charts with `python3 scripts/build-recorded-charts.py`. Source XM note-on/delay/note-off events determine timing. The two supplied Ogg exports run about 0.227% faster than their nominal XM grids; the compiler scales timings by 44000/44100, measured against note attacks across the excerpts. Excerpt trims use the same calibration so there is no cumulative drift. My Street's plucked voice has tap notes; Raspberry Jam's sustained lead includes holds. Short excerpts are intentional, not a claim of complete original songs.

The other four rhythm songs (bay, metro, forest, neon) are locally synthesized arrangements. Their audible melody and chart share the same selected notes; long notes use a sustained amplitude envelope. Legacy `rhythm-1` scores retain their earlier arrangement for replay compatibility.

## Rescue score — 2026-11-21

`rescue-siege.mp3` / **破晓救援 (Light Through the Siege)** is newly generated at the owner’s explicit request through MiniMax `music-3.0`, instrumental mode. It replaces Tension in rescue gameplay. The single generation returned a 163.317-second, stereo 44.1 kHz MP3. This is AI-generated project music, not a CC0 community recording. See `rescue-siege-generation.json` for the prompt and non-secret provenance.

Playback asset: full recording, 128 kbit/s MP3, metadata stripped, normalized to -16 LUFS / -2 dBTP, 30 ms entrance and 2-second ending fades. Other tracks retain their normalization above.
