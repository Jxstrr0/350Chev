
/* ===========================================================================
   RUN VIEW HUD BAND (every event but the strip, which keeps its own STRIP.band)
   While an event's live HUD overlays the 3D view's bottom edge (html.onevent), the app reports the band it covers
   (CSS px up from the view's bottom, and the view's height) through ENGINE_VIS.setBand. A scene camera calls
   bandLens(cam) right after updateProjectionMatrix(): an off-axis lens shift lifts the picture by half the band, so the
   vehicle sits in the middle of the clear part of the view instead of behind the HUD. VBAND.px is 0 outside a run.
   The run view also makes the phone's view taller than it is wide: bandFov widens the vertical fov so the shot keeps the
   width it has in a square view (the scenes were framed for the normal, wider view), like the strip's stripFitFov.
   ==========================================================================*/
var VBAND = { px:0, h:0, refAsp:1 };
function bandFov(vf, aspect){ var r=VBAND.refAsp; if(!(VBAND.px>0)||!(aspect>0)||aspect>=r) return vf;
  return Math.min(78, 2*Math.atan(Math.tan(deg(vf)/2)*r/aspect)*180/PI); }
function bandLens(cam){ var b=VBAND.px||0, h=VBAND.h||0; if(!(b>0&&h>0)||!cam) return;
  var f=bandFov(cam.fov, cam.aspect); if(f!==cam.fov){ cam.fov=f; cam.updateProjectionMatrix(); }
  cam.projectionMatrix.elements[9]=-clamp(b/h,0,0.3); cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert(); }
