# Neon Rift

A self-contained neon wave-survival shooter made with HTML5 Canvas, CSS and vanilla JavaScript. No build tools, dependencies, network access or assets needed.

## Run

Double-click `index.html` in a modern desktop browser (Chrome, Edge or Firefox). Or serve this folder using `python -m http.server 8000` and visit `http://localhost:8000`.

## Play

- WASD / arrow keys: move
- Mouse: aim; hold left click: shoot
- Space: dash (brief invulnerability, 2.3-second cooldown)
- P or the pause button: pause/resume
- Touch devices: left joystick moves; drag on right side to aim; hold FIRE to shoot
- Survive the waves, defeat chasers, dashers and tanks. Green shield cells restore 25 HP. Each cleared wave restores 10 HP and awards a score bonus. Best score is saved locally in your browser.
- The music-note button mutes/unmutes synthesized sound effects. Audio starts only after interaction with the game.

## Project notes

The entire playable game is in `index.html`, so it can be hosted on any static site. It does not collect data or call external APIs. The best score is stored only in the browser's localStorage. No external audio or image assets are used.
