"""Reproducible PDFMathReader icon: modeled glass and raised pigment."""

import bpy
import math
import os
from mathutils import Vector

ROOT = os.path.dirname(os.path.abspath(__file__))
scene = bpy.data.scenes.new("PDFMathReader Icon")
bpy.context.window.scene = scene


def material(name, color, rough=0.25, transmission=0, metal=0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    p.inputs["Base Color"].default_value = (*color, 1)
    p.inputs["Roughness"].default_value = rough
    p.inputs["Transmission Weight"].default_value = transmission
    p.inputs["Metallic"].default_value = metal
    p.inputs["IOR"].default_value = 1.46
    p.inputs["Coat Weight"].default_value = 0.15
    return m


white = material("Porcelain white", (0.92, 0.94, 0.98), 0.22)
ink = material("Warm white lettering", (0.98, 0.98, 0.94), 0.25)
glass = material("Optical glass IOR 1.46", (0.97, 0.995, 1), 0.035, 1)


def tile(name, cx, cy, z, w, h, r, depth, mat):
    pts = []
    for x, y, start in [
        (w / 2 - r, h / 2 - r, 0),
        (-w / 2 + r, h / 2 - r, 90),
        (-w / 2 + r, -h / 2 + r, 180),
        (w / 2 - r, -h / 2 + r, 270),
    ]:
        for i in range(25):
            a = math.radians(start + i * 90 / 24)
            pts.append((cx + x + r * math.cos(a), cy + y + r * math.sin(a)))
    n = len(pts)
    v = [(x, y, z + dz) for dz in [-depth / 2, depth / 2] for x, y in pts]
    f = [tuple(range(n - 1, -1, -1)), tuple(range(n, 2 * n))] + [
        (i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n)
    ]
    me = bpy.data.meshes.new(name)
    me.from_pydata(v, [], f)
    me.update()
    o = bpy.data.objects.new(name, me)
    scene.collection.objects.link(o)
    o.data.materials.append(mat)
    b = o.modifiers.new("Soft polished edges", "BEVEL")
    b.width = 0.04
    b.segments = 4
    for p in me.polygons:
        p.use_smooth = True
    o.modifiers.new("Weighted normals", "WEIGHTED_NORMAL")
    return o


tile("Rounded white app tile", 0, 0, 0, 7.8, 7.8, 1.75, 0.34, white)
paint = material("Liquid cyan pink yellow pigment", (0.1, 0.5, 1), 0.24)
p = next(n for n in paint.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
attr = paint.node_tree.nodes.new("ShaderNodeVertexColor")
attr.layer_name = "Pigment"
paint.node_tree.links.new(attr.outputs["Color"], p.inputs["Base Color"])
paint.node_tree.links.new(attr.outputs["Color"], p.inputs["Emission Color"])
p.inputs["Emission Strength"].default_value = 0.16
# A dense rounded surface gives the pigment real, subtle liquid relief.
N = 150
verts = []
cols = []
palette = [
    (-1.7, 1.7, (0.005, 0.75, 0.95)),
    (1.6, 1.25, (0.005, 0.22, 1)),
    (-1.5, -1.0, (0.85, 0.12, 0.78)),
    (0.2, -1.6, (1, 0.27, 0.6)),
    (0.5, -2.5, (1, 0.7, 0.025)),
]
for j in range(N + 1):
    y = -2.7 + 5.4 * j / N
    limit = 2.7
    if abs(y) > 1.65:
        limit = 1.65 + math.sqrt(max(0, 1.05**2 - (abs(y) - 1.65) ** 2))
    for i in range(N + 1):
        x = -limit + 2 * limit * i / N
        ripple = math.sin(x * 4 + y * 2) * math.sin(y * 3 - x) * 0.009
        verts.append((x - 0.35, y + 0.35, 0.265 + ripple))
        weights = [
            math.exp(
                -((x - a + 0.25 * math.sin(y * 3)) ** 2 + (y - b + 0.2 * math.cos(x * 3)) ** 2)
                / 0.85
            )
            for a, b, c in palette
        ]
        total = sum(weights)
        cols.append(
            tuple(sum(w * c[k] for w, (_, _, c) in zip(weights, palette)) / total for k in range(3))
            + (1,)
        )
faces = [
    (j * (N + 1) + i, j * (N + 1) + i + 1, (j + 1) * (N + 1) + i + 1, (j + 1) * (N + 1) + i)
    for j in range(N)
    for i in range(N)
]
me = bpy.data.meshes.new("Sculpted pigment")
me.from_pydata(verts, [], faces)
me.update()
o = bpy.data.objects.new("Flowing color splash panel", me)
scene.collection.objects.link(o)
me.materials.append(paint)
ca = me.color_attributes.new(name="Pigment", type="FLOAT_COLOR", domain="POINT")
for i, c in enumerate(cols):
    ca.data[i].color = c
for f in me.polygons:
    f.use_smooth = True
solid = o.modifiers.new("Pigment thickness", "SOLIDIFY")
solid.thickness = 0.08
for name, cx, cy, rx, ry, col, phase in [
    ("Cyan splash", -1.35, 1.75, 0.9, 0.7, (0.005, 0.65, 0.95), 0),
    ("Pink splash", -1.8, -1.4, 0.85, 0.75, (0.98, 0.16, 0.72), 2),
    ("Golden splash", 0.4, -1.95, 1.05, 0.36, (1, 0.64, 0.015), 4),
]:
    vv = [(cx - 0.35, cy + 0.35, 0.285)]
    count = 96
    for k in range(count):
        a = 2 * math.pi * k / count
        r = 1 + 0.12 * math.sin(5 * a + phase) + 0.07 * math.sin(9 * a)
        vv.append((cx - 0.35 + rx * r * math.cos(a), cy + 0.35 + ry * r * math.sin(a), 0.282))
    mm = bpy.data.meshes.new(name)
    mm.from_pydata(vv, [], [(0, k + 1, (k + 1) % count + 1) for k in range(count)])
    mm.update()
    oo = bpy.data.objects.new(name, mm)
    scene.collection.objects.link(oo)
    mm.materials.append(material(name + " pigment", col, 0.28))
    so = oo.modifiers.new("Liquid depth", "SOLIDIFY")
    so.thickness = 0.015
    be = oo.modifiers.new("Surface tension", "BEVEL")
    be.width = 0.015
    be.segments = 3
font = bpy.data.fonts.load("/System/Library/Fonts/Supplemental/Arial Bold.ttf")
cjk = bpy.data.fonts.load("/System/Library/Fonts/Supplemental/Arial Unicode.ttf")


def text(body, x, y, z, size, font):
    cu = bpy.data.curves.new("Letter " + body, "FONT")
    cu.body = body
    cu.size = size
    cu.font = font
    cu.extrude = 0.012
    cu.bevel_depth = 0.005
    o = bpy.data.objects.new("Letter " + body, cu)
    scene.collection.objects.link(o)
    o.location = (x, y, z)
    cu.materials.append(ink)


text("A", -2.15, 0.65, 0.34, 1.75, font)
tile("Text line 1", -1.05, -0.42, 0.34, 2.5, 0.27, 0.13, 0.05, ink)
tile("Text line 2", -1.4, -1.06, 0.34, 1.8, 0.27, 0.13, 0.05, ink)
bpy.ops.mesh.primitive_uv_sphere_add(segments=128, ring_count=64, location=(1.45, -1.35, 0.69))
lens = bpy.context.object
lens.name = "Solid convex glass translation lens"
lens.scale = (1.77, 1.77, 0.42)
lens.data.materials.append(glass)
for f in lens.data.polygons:
    f.use_smooth = True
text("文", 0.42, -2.04, 1.12, 2.08, cjk)


def light(name, loc, power, size, target=(0, 0, 0), shape=None):
    d = bpy.data.lights.new(name, "AREA")
    d.energy = power
    d.size = size
    ob = bpy.data.objects.new(name, d)
    scene.collection.objects.link(ob)
    ob.location = loc
    ob.rotation_euler = (Vector(target) - ob.location).to_track_quat("-Z", "Y").to_euler()


light("Large upper left softbox", (-4, 4, 7), 700, 5)
light("Right glass reflection strip", (5, 0, 5), 500, 3)
light("Cool fill", (-2, -4, 6), 200, 4)
scene.world = bpy.data.worlds.new("Studio")
scene.world.use_nodes = True
next(n for n in scene.world.node_tree.nodes if n.type == "BACKGROUND").inputs[0].default_value = (
    0.65,
    0.7,
    0.8,
    1,
)
next(n for n in scene.world.node_tree.nodes if n.type == "BACKGROUND").inputs[1].default_value = 0.4
cam = bpy.data.cameras.new("Icon orthographic")
ob = bpy.data.objects.new("Icon camera", cam)
scene.collection.objects.link(ob)
ob.location = (0, 0, 16)
cam.type = "ORTHO"
cam.ortho_scale = 9.2
scene.camera = ob
scene.render.engine = "CYCLES"
scene.cycles.samples = 96
scene.cycles.use_denoising = True
scene.cycles.max_bounces = 12
scene.cycles.transmission_bounces = 8
scene.render.resolution_x = 1024
scene.render.resolution_y = 1024
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.render.filepath = os.path.join(ROOT, "icon-render")
try:
    scene.view_settings.view_transform = "Standard"
except TypeError:
    pass
for screen in bpy.data.screens:
    for a in screen.areas:
        if a.type == "VIEW_3D":
            a.spaces.active.region_3d.view_perspective = "CAMERA"
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, "PDFMathReader-icon.blend"))
exec(
    compile(open(os.path.join(ROOT, "oil-paint.py")).read(), "oil-paint.py", "exec"),
    {"__file__": os.path.join(ROOT, "oil-paint.py")},
)
exec(
    compile(open(os.path.join(ROOT, "magnifying-glass.py")).read(), "magnifying-glass.py", "exec"),
    {"__file__": os.path.join(ROOT, "magnifying-glass.py")},
)
exec(
    compile(open(os.path.join(ROOT, "watercolor.py")).read(), "watercolor.py", "exec"),
    {"__file__": os.path.join(ROOT, "watercolor.py")},
)
exec(
    compile(open(os.path.join(ROOT, "ink-cloud.py")).read(), "ink-cloud.py", "exec"),
    {"__file__": os.path.join(ROOT, "ink-cloud.py")},
)
exec(
    compile(open(os.path.join(ROOT, "equal-margins.py")).read(), "equal-margins.py", "exec"),
    {"__file__": os.path.join(ROOT, "equal-margins.py")},
)
