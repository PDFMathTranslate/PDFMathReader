"""Apply modeled impasto splashes to the existing canonical icon project."""
import bpy, math, random, os
ROOT=os.path.dirname(os.path.abspath(__file__))
scene=bpy.context.scene
random.seed(47)
# Replace only the three earlier flat splashes; retain the existing icon scene.
for ob in list(scene.objects):
    if ob.name in ['Cyan splash','Pink splash','Golden splash'] or ob.name.startswith('Impasto splash'):
        bpy.data.objects.remove(ob,do_unlink=True)
panel=next(o for o in scene.objects if o.name.startswith('Flowing color splash panel'))
shader=next(n for n in panel.data.materials[0].node_tree.nodes if n.type=='BSDF_PRINCIPLED')
shader.inputs['Roughness'].default_value=.5
shader.inputs['Coat Weight'].default_value=.04
shader.inputs['Emission Strength'].default_value=0
def inside(x,y):
    x+=.35;y-=.35
    return max(abs(x)-1.65,0)**2+max(abs(y)-1.65,0)**2 < 1.04**2
def oil(name,color):
    m=bpy.data.materials.new(name);m.use_nodes=True
    p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Roughness'].default_value=.46
    p.inputs['Coat Weight'].default_value=.06
    return m
def splash(name,cx,cy,rx,ry,mat,seed):
    rng=random.Random(seed);phase=rng.random()*6.28
    count=160;rings=24;vertices=[(cx,cy,.31)];faces=[]
    spikes=[(rng.random()*6.28,rng.uniform(.06,.16),rng.uniform(.18,.55)) for _ in range(11)]
    def outline(a):
        r=1+.08*math.sin(a*7+phase)+.05*math.sin(a*17+phase)
        for center,width,height in spikes:
            d=(a-center+math.pi)%(2*math.pi)-math.pi
            r+=height*math.exp(-(d/width)**2)
        return r
    for j in range(1,rings+1):
        t=j/rings
        for k in range(count):
            a=k*2*math.pi/count;r=t*outline(a)
            x=cx+rx*r*math.cos(a);y=cy+ry*r*math.sin(a)
            # Thick body, raised drag marks, fine bristle grooves, thinner edges.
            drag=.012*math.sin((x*1.2+y)*65+3*math.sin(y*6))
            grain=.004*math.sin(x*215+y*137)*math.sin(y*197-x*61)
            z=.278+(.025+drag+grain)*(math.sin(math.pi*t)**.55)+.011*(1-t)
            vertices.append((x,y,z))
    for k in range(count):faces.append((0,k+1,(k+1)%count+1))
    for j in range(rings-1):
        for k in range(count):
            a=1+j*count+k;b=1+j*count+(k+1)%count
            f=(a,b,b+count,a+count)
            if all(inside(vertices[v][0],vertices[v][1]) for v in f):faces.append(f)
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],faces);mesh.update()
    ob=bpy.data.objects.new(name,mesh);scene.collection.objects.link(ob);mesh.materials.append(mat)
    for f in mesh.polygons:f.use_smooth=True
    sol=ob.modifiers.new('Thick oil pigment','SOLIDIFY');sol.thickness=.012
    for i in range(18):
        a=rng.random()*6.28;r=rng.uniform(1.3,1.8)
        x=cx+rx*r*math.cos(a);y=cy+ry*r*math.sin(a)
        if not inside(x,y):continue
        bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8,location=(x,y,.285))
        d=bpy.context.object;d.name=name+' fleck';size=rng.uniform(.012,.046)
        d.scale=(size,size*rng.uniform(.5,1.5),size*.3);d.data.materials.append(mat)
        for f in d.data.polygons:f.use_smooth=True
colors=[('Turquoise',(.006,.54,.65)),('Cobalt',(.015,.15,.75)),('Rose',(.8,.045,.3)),('Magenta',(.65,.04,.48)),('Cadmium yellow',(1,.57,.018)),('Lavender',(.36,.19,.7))]
mats=[oil('Oil paint '+n,c) for n,c in colors]
for i,(x,y,rx,ry,mi) in enumerate([(-1.85,1.95,.6,.65,0),(-.65,2.25,.65,.4,0),(1.25,1.8,.9,.7,1),(.2,.9,.7,.5,5),(-1.85,-1.45,.55,.62,3),(-.7,-1.6,.7,.53,2),(.65,-1.75,.85,.6,4),(-2.3,.1,.35,.6,5),(.9,.1,.55,.7,1)]):
    splash('Impasto splash %02d'%i,x,y,rx,ry,mats[mi],i+100)
scene.render.filepath=os.path.join(ROOT,'oil-icon')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'PDFMathReader-icon.blend'))
