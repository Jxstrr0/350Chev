
/* ===========================================================================
   RUN VIEW HUD BAND (every event but the strip, which keeps its own STRIP.band)
   While an event's live HUD overlays the 3D view's bottom edge (html.onevent), the app reports the band it covers
   (CSS px up from the view's bottom, and the view's height) through ENGINE_VIS.setBand. A scene camera calls
   bandLens(cam) right after updateProjectionMatrix(): an off-axis lens shift lifts the picture by half the band, so the
   vehicle sits in the middle of the clear part of the view instead of behind the HUD. VBAND.px is 0 outside a run.
   ==========================================================================*/
var VBAND = { px:0, h:0 };
function bandLens(cam){ var b=VBAND.px||0, h=VBAND.h||0; if(!(b>0&&h>0)||!cam) return;
  cam.projectionMatrix.elements[9]=-clamp(b/h,0,0.3); cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert(); }
