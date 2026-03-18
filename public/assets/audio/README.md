# Audio Assets

The app ships with procedural fallback audio generated via Web Audio API (`src/audio/AudioManager.ts`), so static deployment works without binary audio files.

Optional local replacements can be added later:

- `ambient-cave-loop.ogg`
- `coin-collision-01.ogg`
- `coin-collision-02.ogg`
- `gem-select-rare.ogg`
- `legendary-select.ogg`
- `dragon-breath.ogg`
- `dragon-huff.ogg`
- `dragon-rumble.ogg`

Keep files in this folder and extend `AudioManager` to load them as progressive enhancement.
