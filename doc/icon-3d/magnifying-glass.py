"""Physical closed biconvex lens; lettering lies underneath the refracting glass."""

import bpy
import math
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
scene = bpy.context.scene
lens = next(o for o in scene.objects if o.name.startswith("Solid convex glass translation lens"))
material = lens.data.materials[0]
p = next(n for n in material.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
p.inputs["Base Color"].default_value = (1, 1, 1, 1)
p.inputs["Transmission Weight"].default_value = 1
p.inputs["IOR"].default_value = 1.52
p.inputs["Roughness"].default_value = 0.012
p.inputs["Coat Weight"].default_value = 0
# Two spherical optical surfaces and a finite edge form a watertight lens.
radius = 1.77
curvature = 3.3
sides = 192
rings = 64
sag = curvature - math.sqrt(curvature**2 - radius**2)
verts = []
faces = []
for sign in [1, -1]:
    verts.append((0, 0, sign * (0.055 + sag)))
    for j in range(1, rings + 1):
        r = radius * j / rings
        h = 0.055 + math.sqrt(curvature**2 - r * r) - math.sqrt(curvature**2 - radius**2)
        for k in range(sides):
            a = k * 2 * math.pi / sides
            verts.append((r * math.cos(a), r * math.sin(a), sign * h))
stride = 1 + rings * sides
for side in range(2):
    off = side * stride
    for k in range(sides):
        f = (off, off + 1 + k, off + 1 + (k + 1) % sides)
        faces.append(f if side == 0 else f[::-1])
    for j in range(rings - 1):
        for k in range(sides):
            a = off + 1 + j * sides + k
            b = off + 1 + j * sides + (k + 1) % sides
            f = (a, a + sides, b + sides, b)
            faces.append(f if side == 0 else f[::-1])
for k in range(sides):
    a = 1 + (rings - 1) * sides + k
    b = 1 + (rings - 1) * sides + (k + 1) % sides
    faces.append((a, b, b + stride, a + stride))
mesh = bpy.data.meshes.new("Closed biconvex optical lens")
mesh.from_pydata(verts, [], faces)
mesh.update()
lens.data = mesh
lens.scale = (1, 1, 1)
lens.location = (1.45, -1.35, 1.65)
mesh.materials.append(material)
for f in mesh.polygons:
    f.use_smooth = True
letter = next(o for o in scene.objects if o.name.startswith("Letter 文"))
# Move the physical glyph from the front surface to the document plane.
letter.location.z = 0.35
letter.scale = (0.72, 0.72, 0.72)
bpy.context.view_layer.update()
corners = [letter.matrix_world @ __import__("mathutils").Vector(v) for v in letter.bound_box]
letter.location.x += 1.45 - (min(v.x for v in corners) + max(v.x for v in corners)) / 2
letter.location.y += -1.35 - (min(v.y for v in corners) + max(v.y for v in corners)) / 2
scene.cycles.samples = 160
scene.cycles.max_bounces = 16
scene.cycles.transmission_bounces = 12
scene.render.filepath = os.path.join(ROOT, "magnifying-icon")
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, "PDFMathReader-icon.blend"))
