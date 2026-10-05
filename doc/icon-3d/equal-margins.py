"""Center the colored document with equal insets on all four sides."""

import bpy
import os
import json
from mathutils import Vector

ROOT = os.path.dirname(os.path.abspath(__file__))
scene = bpy.context.scene
panel = next(o for o in scene.objects if o.name.startswith("Flowing color splash panel"))
base = next(o for o in scene.objects if o.name.startswith("Rounded white app tile"))


def bounds(ob):
    points = [ob.matrix_world @ Vector(v) for v in ob.bound_box]
    return (
        min(v.x for v in points),
        max(v.x for v in points),
        min(v.y for v in points),
        max(v.y for v in points),
    )


bpy.context.view_layer.update()
px0, px1, py0, py1 = bounds(panel)
bx0, bx1, by0, by1 = bounds(base)
dx = (bx0 + bx1 - px0 - px1) / 2
dy = (by0 + by1 - py0 - py1) / 2
for ob in scene.objects:
    if ob == panel or ob.name.startswith(("Letter ", "Text line ", "Solid convex glass")):
        ob.location.x += dx
        ob.location.y += dy
bpy.context.view_layer.update()
px0, px1, py0, py1 = bounds(panel)
margins = {"left": px0 - bx0, "right": bx1 - px1, "top": by1 - py1, "bottom": py0 - by0}
assert max(margins.values()) - min(margins.values()) < 0.00001, margins
pixels = scene.render.resolution_x / scene.camera.data.ortho_scale
with open(os.path.join(ROOT, "layout-metrics.json"), "w") as f:
    json.dump(
        {
            "margin_scene_units": margins,
            "margin_pixels_at_1024": {k: v * pixels for k, v in margins.items()},
            "note": "Insets between base and document geometry; lens is an overlapping foreground element.",
        },
        f,
        indent=2,
    )
scene.render.filepath = os.path.join(ROOT, "equal-margins-icon")
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, "PDFMathReader-icon.blend"))
print(margins)
