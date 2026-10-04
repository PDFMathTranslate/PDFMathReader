"""Smooth luminous ink clouds matching the supplied Preview reference."""
import bpy, math, os
ROOT=os.path.dirname(os.path.abspath(__file__))
scene=bpy.context.scene
panel=next(o for o in scene.objects if o.name.startswith('Flowing color splash panel'))
mat=panel.data.materials[0]
p=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
p.inputs['Roughness'].default_value=.38;p.inputs['Coat Weight'].default_value=.08
p.inputs['Emission Strength'].default_value=.42
palette=[(-1.8,2.1,1.4,(.005,.64,.88)),(1.7,1.4,1.7,(.003,.29,.92)),(-1.9,.4,1.1,(.24,.38,.91)),(-1.3,-1.45,1.6,(.94,.28,.89)),(.5,-1.2,1.1,(1,.39,.9)),(.5,-2.9,.72,(1,.72,.075))]
def cloud(x,y):
    return math.sin(x*1.7+math.sin(y*1.8))*.6+math.cos(y*2.2-x*.8)*.25+math.sin(x*5.2+y*4.3)*.1
ca=panel.data.color_attributes['Pigment']
for i,v in enumerate(panel.data.vertices):
    x=v.co.x+.35;y=v.co.y-.35
    u=x+.23*cloud(x,y);w=y+.24*cloud(y+3,x-1)
    weights=[math.exp(-((u-a)**2+(w-b)**2)/(s*s)) for a,b,s,c in palette]
    total=sum(weights)
    c=[sum(weight*entry[3][k] for weight,entry in zip(weights,palette))/total for k in range(3)]
    mist=.025*cloud(x*2.5,y*2.5)
    ca.data[i].color=tuple(max(0,min(1,k+mist)) for k in c)+(1,)
    v.co.z=.265
panel.data.update()
lens=next(o for o in scene.objects if o.name.startswith('Solid convex glass translation lens'))
# Transparent shadow handling prevents the illustration and glyph under the
# lens from becoming gray while camera rays still undergo full refraction.
lens.visible_shadow=False
letter=next(o for o in scene.objects if o.name.startswith('Letter 文'))
glyphmat=letter.data.materials[0].copy();letter.data.materials[0]=glyphmat
g=next(n for n in glyphmat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
g.inputs['Emission Color'].default_value=(1,1,1,1);g.inputs['Emission Strength'].default_value=.25
scene.render.filepath=os.path.join(ROOT,'ink-cloud-icon')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'PDFMathReader-icon.blend'))
