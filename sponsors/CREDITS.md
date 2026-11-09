# Sponsor emblems (sponsors/)

The eleven sponsor brands' emblems, used by the sponsor logos (`spLogoCanvas` in `src/vis/strip-cars.js`): the sponsor cards, the
time slip, the car decals. Generated for Longlight Interactive with ElevenLabs image generation (Recraft v4.1) from prompts
written for the game; three takes per brand, Kelbo picked one. The brands are fictional.

- Each picked logo was cropped to its emblem (the symbol only, the lettering cut away), its background made transparent, scaled
  to 256 px on the long side and saved as a 64-colour PNG. The brand name is drawn by the game in its display font.
- Wild Oat's art is kept whole: its lettering is the emblem, so the game draws no name beside it.
- Files are named by the brand id in `SP_BRANDS` (`src/app/career.js`): `heron`, `coldwater`, `ironhorn`, `corvid`, `gopher`,
  `coulee` (Red Butte), `gripline`, `hollow` (Hollow Ridge), `moose` (Static Moose), `wildoat`, `northlight`.
- Total size: about 57 kB in 11 files, fetched the first time a sponsor logo is drawn.
