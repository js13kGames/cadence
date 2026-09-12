# Unicorn Launcher

An entry for [js13kGames 2026](https://js13kgames.com/), theme **"Unicorns and Rainbows"**.
The whole game — code, graphics, sound — fits in a 13 kB zip. Nothing is loaded from
the network and there are no image or audio files: every sprite is drawn with canvas
paths and every sound is synthesised at runtime.

Fire a unicorn out of a cannon, then surf the rainbow hills for as long as you can
while a storm rolls in behind you.

## How to play

### 1. Aim

The barrel sweeps up and down. Press **SPACE** (or tap) to lock the angle.

### 2. Light the fuse

A power meter runs back and forth. Press **SPACE** again to stop it. Stopping it in
the green zone near the top is a **perfect ignition** and adds 22% to your launch
speed. Stopping it low still fires — there is no such thing as a wasted shot.

### 3. Surf

This is the whole game. You are never in the air for long, and every landing matters.

| Key | Action |
| --- | --- |
| **→** (or **D**) | Gallop. Tap it once per beat, when the ring closes |
| **SPACE** | Jump; with Double Jump, press again in midair for one extra jump |
| **W** or **↑** | Jump; with wings, hold to glide and tap on the beat to flap |
| **S** or **↓** (hold) | Dive. The unicorn gets heavy and drops fast |
| **M** | Mute |

On a narrow screen the camera pulls back so you see more of the world than the
width alone would allow, the unicorn sits lower the taller the screen is, so
grass cannot fill the bottom half, and long prompts shrink to fit the width.

On a touch screen: tap anywhere to gallop, and **drag downward** to dive. Use the **JUMP / FLAP** button to jump or flap;
hold it with wings to glide.

**Soundtrack.** Music starts after your first key press or tap. A gentle synth tune
adds bright arpeggios as the unicorn becomes happy, then shifts into minor harmony
and a low pulse when it is scared. The same mood drives its face and the music.
A quieter variation plays after a run. **M** mutes music and effects; background
music pauses when the window loses focus or the tab is hidden.

**Jumping.** A normal jump is always available on the ground and costs no breath.
The mint double-chevron pickup grants **12 seconds of Double Jump**: one extra
midair jump, restored by landing. Holding a jump key does not trigger more jumps.

**Wings.** A winged-unicorn pickup grants **12 seconds of wings** as well as its
initial lift. Hold **W / ↑** for a slow glide. In the air the beat moves from **→**
to **↑**: a fresh press on the beat is a flap that lifts you *and* pushes you forward,
building combo just like a gallop step. Flying costs no breath, but an off-beat press
does nothing and costs combo. Release to fall normally, or hold **S / ↓** to dive. With both power-ups, **SPACE** uses the
extra jump and **W / ↑** flaps. Collecting another pickup refreshes its timer.

**The beat.** A ring closes in around the unicorn every 0.42 seconds and a metronome
clicks, accented every fourth beat. Press **→** as the ring meets the inner circle:

```
beat:      ●        ●        ●        ●        ●
key:       →        →        →        →        →
```

A step on the beat is worth **2.6×** as much as a late one and costs a quarter of the
breath. The timing window is ±92 ms, and a beat only pays out once — a second press
on the same beat is just an off-beat step. Off-beat steps eat your combo, which
multiplies every step by up to 2×. The combo bar below breath shows your count and
multiplier, filling completely at 40 steps.

Hooves need ground: the gallop only works while you are touching a hill.

**The dive.** In the air, hold **S**. Landing softly on a **downslope** keeps your
speed and gives a 26% bonus; slamming into a slope that rises in front of you costs
you over half of it. Timing dives against the shape of the hills is where nearly all
the skill lives.

**Breath.** Every gallop step spends breath (flying is free). The bar turns **red** below a
third, and once it is red every off-beat press flashes the whole screen red. When you have no breath left
for even a perfect step a **3 - 2 - 1** countdown starts: collect a star or land cleanly
before it reaches zero, or the run is over. Wings pause the countdown, since flying is
free. Only two things give breath back:

| | |
| --- | --- |
| Collect a star | **+20** |
| Land cleanly on a downslope | **+8** |

There is no passive regeneration. A full bar is 50 on-beat steps — or only 12 late
ones. When it runs dry you cannot gallop, you slow down, and the storm eats you.

**The storm.** A wall of thundercloud starts **3,000 m behind you** at launch. It
starts at 5.7 m/s and gains 0.67 m/s each second of the chase, without advancing or
accelerating while you aim. There is no distance cap: speed boosts and portals can
build a real lead, but the storm keeps getting faster. Its distance stays visible
beside you, and in the top right corner on a narrow screen; lightning and
flashes begin only within **100 m**, and stop if you escape that range. The screen darkens as it closes in. Touching it ends the run.

### What you will meet out there

| | |
| --- | --- |
| ⭐ **Star** | Currency, and the fuel that refills your breath |
| 🌈 **Rainbow booster** | +22% speed |
| 🍬 **Cotton candy** | Heavy drag, and it kills your combo |
| 🦄 **Winged unicorn** | Kicks you high into the air and grants wings for 12 s |
| 🫧 **Bubble** | Near weightless for 2.6 s |
| ☄️ **Comet** | 1.8 s of turbo that ploughs straight through cotton candy |
| 🌀 **Portal** | Throws you 780 px forward, speed intact |
| ⛈️ **Thundercloud** | Makes you dizzy: for 2.4 s rhythm stops working and you must mash **→** as fast as you can just to stagger forward |

### Between runs

There is no shop. Stars are breath, nothing else, and every run starts with the
same unicorn. The end screen shows your distance, peak height and best distance.
Press **SPACE** or tap to launch again. Your best distance
is saved in the browser under a single namespaced key,
`unicorn-launcher-26.best`, since every js13k entry shares one origin. The game
never clears storage and never deletes a key it did not write.

## Building

```sh
npm install
npm run build     # production build -> dist/game.zip
npm run dev       # unminified build for debugging
npm run serve     # serve dist/ locally
npm run size      # size of the last build against the 13312 B limit
```

The pipeline is esbuild → terser → [Roadroller](https://github.com/lifthrasiir/roadroller)
→ everything inlined into one HTML file → zipped with
[ECT](https://github.com/fhanau/Efficient-Compression-Tool). `npm run build` fails if
the result goes over 13312 bytes.

`npm test` runs headless regression checks for jumping, power-ups, gliding, flapping,
breath costs, input release/repeat handling, facial expressions, storm pacing and
lightning range, the combo HUD, and adaptive music scheduling, moods, and muting.

`npm run bench` runs the balance harness: it plays the game headlessly across five
different worlds with three bots — one that never touches the keyboard, one that
mashes blindly, and one that plays the beat and dives properly — and reports the
distance each of them reaches. It exists to check that skill, and not luck, decides
the outcome.

## Credits

Sound is [ZzFX](https://github.com/KilledByAPixel/ZzFX) by Frank Force (MIT).
Everything else is original work for this competition.
