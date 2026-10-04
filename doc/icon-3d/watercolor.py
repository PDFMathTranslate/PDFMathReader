"""Watercolor washes on the document, with balanced refracted typography."""
import bpy, math, os, random
from mathutils import Vector
ROOT=os.path.dirname(os.path.abspath(__file__))
scene=bpy.context.scene
for ob in list(scene.objects):
    if ob.name.startswith('Impasto splash') or ob.name in ['Cyan splash','Pink splash','Golden splash']:
        bpy.data.objects.remove(ob,do_unlink=True)
panel=next(o for o in scene.objects if o.name.startswith('Flowing color splash panel'))
shader=next(n for n in panel.data.materials[0].node_tree.nodes if n.type=='BSDF_PRINCIPLED')
shader.inputs['Roughness'].default_value=.82
shader.inputs['Coat Weight'].default_value=0
shader.inputs['Emission Strength'].default_value=.16
colors=panel.data.color_attributes['Pigment']
def noise(x,y):
    return (math.sin(x*2.7+math.sin(y*3.1))*math.cos(y*2.3-x*.4)+.4*math.sin(x*6.7+y*5.1)+.2*math.cos(x*13.1-y*10.4))/1.6
washes=[(-1.55,1.8,1.4,1.45,(.025,.6,.79)),(1.45,1.4,1.55,1.65,(.015,.25,.76)),(-1.6,-1.35,1.5,1.35,(.8,.17,.65)),(.1,-1.15,1.3,1.5,(.92,.28,.54)),(.7,-2.2,1.6,.7,(1,.71,.13)),(-.9,.15,1.3,1.1,(.49,.35,.82))]
for i,v in enumerate(panel.data.vertices):
    x=v.co.x+.35;y=v.co.y-.35
    c=[.93,.95,.96]
    for j,(cx,cy,rx,ry,pigment) in enumerate(washes):
        d=((x-cx)/rx)**2+((y-cy)/ry)**2
        distortion=.17*noise(x*2+j*7,y*2-j*3)
        distance=max(0,d+distortion)
        opacity=.85*math.exp(-distance*.9)
        # Feathered pigment pools and darker drying edges, without raised paint.
        edge=.11*math.exp(-((distance-.88)/.13)**2)
        grain=.018*math.sin(x*213+y*79)*math.cos(y*193-x*57)
        opacity=max(0,min(.9,opacity+edge+grain*math.exp(-distance)))
        c=[c[k]*(1-opacity)+pigment[k]*opacity for k in range(3)]
    texture=.012*noise(x*17,y*17)+.006*math.sin(x*189+y*173)
    colors.data[i].color=tuple(max(0,min(1,k+texture)) for k in c)+(1,)
    v.co.z=.265+.0009*math.sin(x*189)*math.cos(y*173)
panel.data.update()
# Make A the primary document glyph, with a comfortable top and left inset.
a=next(o for o in scene.objects if o.name.startswith('Letter A'))
a.data.size=1.95;a.location=(-2.1,.62,.30);a.data.extrude=.003;a.data.bevel_depth=.001
lens=next(o for o in scene.objects if o.name.startswith('Solid convex glass translation lens'))
lens.location=(1.25,-1.12,1.55)
letter=next(o for o in scene.objects if o.name.startswith('Letter 文'))
letter.scale=(.63,.63,.63);letter.location.z=.30
letter.data.extrude=.003;letter.data.bevel_depth=.001
bpy.context.view_layer.update()
corners=[letter.matrix_world@Vector(v) for v in letter.bound_box]
# The underlying glyph fits inside the painted document; its optical image
# sits slightly above-left of lens center rather than falling off the page.
letter.location.x+=1.08-(min(v.x for v in corners)+max(v.x for v in corners))/2
letter.location.y+=-.96-(min(v.y for v in corners)+max(v.y for v in corners))/2
for ob in scene.objects:
    if ob.type=='LIGHT':
        if ob.name.startswith('Right glass'):ob.data.size=1.15;ob.data.energy=190
        elif ob.name.startswith('Large upper'):ob.data.size=3;ob.data.energy=450;ob.visible_glossy=False
        elif ob.name.startswith('Cool fill'):ob.data.size=3;ob.data.energy=100;ob.visible_glossy=False
scene.render.filepath=os.path.join(ROOT,'watercolor-icon')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'PDFMathReader-icon.blend'))
