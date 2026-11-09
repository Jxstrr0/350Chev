# Series banners (banners/)

One banner per team series (27), used across the top of team offers and season cards (`pcBan` in `src/app/team.js`) and on the
Events landing cards (`EV_BANNER` in `src/app/evhub.js`). Generated for Longlight Interactive with ElevenLabs image generation
(GPT Image 2, 3:1) from prompts written for the game; three takes per series, Kelbo picked one.

- Files are named by the series key in `PC_EVENTS` (`src/app/team.js` and `team-pull.js`, `team-bog.js`, `team-hill.js`,
  `team-boat.js`), e.g. `street.webp` is Street drags and `btfh.webp` is Top Fuel Hydro.
- Each was cropped to 3:1, scaled to 960×320, toned down as Kelbo asked (colour 0.45, brightness 0.62, contrast 1.05) so the
  game's text reads over it, and saved as WebP (quality 72).
- Total size: about 420 kB in 27 files, each fetched only when a card that shows it is on screen.
