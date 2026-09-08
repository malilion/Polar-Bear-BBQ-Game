"""Rebuild all game meshes with: blender --background --python scripts/build_scene.py
Optional: -- --render (also renders a camera preview). No downloaded models/textures.
Coordinates: Blender Z-up, front is -Y. glTF converts to Three.js Y-up.
"""
import bpy, math, random, json, sys
from pathlib import Path
from mathutils import Vector
random.seed(17)
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public' / 'models'
OUT.mkdir(parents=True, exist_ok=True)
SOURCE = ROOT / 'assets' / 'blender'
SOURCE.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for m in list(bpy.data.materials): bpy.data.materials.remove(m)

def material(name, color, rough=0.7, metal=0, glow=0):
    m = bpy.data.materials.new(name); m.diffuse_color = (*color, 1); m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metal
    if glow:
        p.inputs['Emission Color'].default_value = (*color,1)
        p.inputs['Emission Strength'].default_value = glow
    return m
snow = material('Snow porcelain',(.9,.96,1))
white = material('Bear warm white',(.94,.90,.79))
ice = material('Ice blue',(.18,.49,.60))
wood = material('Cedar',(.26,.105,.045))
wood2 = material('Honey wood',(.53,.28,.12))
red = material('Awning terracotta',(.74,.16,.075))
cream = material('Awning cream',(.96,.79,.48))
teal = material('Deep pine',(.035,.21,.19))
leaf = material('Pine lighter',(.07,.31,.27))
orange = material('Apron orange',(.93,.30,.065))
black = material('Eyes and nose',(.035,.045,.048),.38)
pink = material('Ear and cheeks',(.92,.43,.37))
metal = material('Grill cast iron',(.065,.085,.085),.45,.6)
steel = material('Grill rods',(.32,.37,.37),.35,.7)
coal = material('Coal ember',(.94,.16,.015),.6,0,1.8)
lamp = material('Lantern warm light',(1,.63,.13),.3,0,2)
raw = material('Meat raw',(.62,.16,.13))
fishmat = material('Fish silver',(.27,.55,.58),.4,.15)
green = material('Green pepper',(.20,.42,.10))
gold = material('Brass',(.65,.40,.11),.35,.5)

def finish(o,name,mat,parent=None):
    o.name=name
    if mat: o.data.materials.append(mat)
    if parent: o.parent=parent
    return o

def group(name,loc=(0,0,0)):
    o=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(o);o.location=loc;return o

def ball(name,loc,scale,mat,parent=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12,location=loc)
    o=finish(bpy.context.object,name,mat,parent);o.scale=scale
    for p in o.data.polygons:p.use_smooth=True
    return o

def box(name,loc,scale,mat,bevel=.05,parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc)
    o=finish(bpy.context.object,name,mat,parent);o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        m=o.modifiers.new('Soft toy edges','BEVEL');m.width=bevel;m.segments=3
        n=o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    return o

def cylinder(name,loc,radius,depth,mat,parent=None,vertices=20):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=loc)
    o=finish(bpy.context.object,name,mat,parent)
    m=o.modifiers.new('Rounded edge','BEVEL');m.width=min(.045,radius*.2);m.segments=2
    o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    return o

def rod(name,a,b,r,mat,parent=None):
    a,b=Vector(a),Vector(b);o=cylinder(name,(a+b)/2,r,(b-a).length,mat,parent)
    o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return o

def cone(name,loc,r1,r2,depth,mat,parent=None):
    bpy.ops.mesh.primitive_cone_add(vertices=16,radius1=r1,radius2=r2,depth=depth,location=loc)
    return finish(bpy.context.object,name,mat,parent)

def text(name,body,loc,size,mat):
    curve=bpy.data.curves.new(name,'FONT');curve.body=body;curve.align_x='CENTER';curve.align_y='CENTER';curve.size=size;curve.extrude=.012;curve.bevel_depth=.004
    o=bpy.data.objects.new(name,curve);bpy.context.collection.objects.link(o);o.location=loc;o.rotation_euler=(math.pi/2,0,0);curve.materials.append(mat)
    bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');o.select_set(False)
    return o

# Snow island and planked deck.
box('Ice island',(0,0,-.42),(12.2,10,.85),ice,.55)
box('Thick snow',(0,0,.02),(12.35,10.1,.3),snow,.45)
box('Wood platform',(0,.7,.26),(7.1,5.8,.24),wood,.12)
for i in range(18):box('Deck plank',(-3.32+i*.39,.7,.405),(.375,5.65,.10),wood2,.025)
for x,y,r in [(-5,-3,.6),(5.5,-1,.55),(-4.8,2,.8),(4.4,3.6,.7),(-2,4,.6)]:
    ball('Snow drift',(x,y,.18),(r,r*.8,.25),snow)

# Open-front timber hut. Side walls kept low so chef stays readable.
for i in range(8):
    rod('Back log',(-2.75,3.0,.65+i*.31),(2.75,3.0,.65+i*.31),.18,wood2 if i%2 else wood)
for x in [-2.75,2.75]:
    box('Canopy post',(x,-.65,1.92),(.18,.18,3.05),wood,.035)
    ball('Post snow cap',(x,-.65,3.50),(.18,.18,.12),snow)
    for i in range(3):rod('Side log',(x,.4,.65+i*.31),(x,3.0,.65+i*.31),.17,wood2)
box('Back counter',(0,2.36,1.3),(5.1,.8,.16),wood2)
for x in [-2.2,2.2]:box('Counter support',(x,2.4,.86),(.13,.65,.8),wood)
# Roof extends toward rear; striped canopy extends forward and is tilted.
for x,angle in [(-1.45,-.31),(1.45,.31)]:
    o=box('Roof',(x,2.15,3.6),(3.1,2.7,.16),wood);o.rotation_euler.y=angle
    o=box('Roof snow',(x,2.15,3.72),(3.15,2.76,.18),snow,.12);o.rotation_euler.y=angle
for i in range(12):
    x=-2.76+i*.5
    o=box('Striped awning',(x,.02,3.35),(.49,2.08,.075),red if i%2==0 else cream,.025)
    o.rotation_euler.x=.16
    box('Awning valance',(x,-1,3.08),(.49,.09,.34),red if i%2==0 else cream,.065)
box('Shop sign',(0,-1.07,3.34),(2.75,.16,.66),teal,.12)
text('Sign title','POLAR BBQ',(0,-1.17,3.39),.29,cream)
text('Sign subtitle','HOT FOOD · WARM HEART',(0,-1.18,3.14),.091,cream)
# Chimney.
box('Chimney',(2,2.7,4.08),(.58,.64,1.15),wood,.06)
box('Chimney snow',(2,2.7,4.69),(.77,.83,.14),snow,.07)
# Lanterns, bottles, plates.
for x in [-2.43,2.43]:
    rod('Lantern chain',(x,-.6,3.28),(x,-.6,2.78),.02,gold)
    cylinder('Lantern bottom',(x,-.6,2.4),.17,.07,metal)
    cylinder('Lantern light',(x,-.6,2.6),.125,.34,lamp)
    cone('Lantern cap',(x,-.6,2.85),.23,.04,.18,metal)
    for a in range(4):
        dx,dy=.145*math.cos(a*math.pi/2),.145*math.sin(a*math.pi/2)
        rod('Lantern frame',(x+dx,-.6+dy,2.42),(x+dx,-.6+dy,2.78),.014,metal)
for x in [-2,-1.65,1.4,1.75,2.1]:
    cylinder('Sauce bottle',(x,2.4,1.60),.1,.43,red if x<0 else teal)
    cylinder('Bottle cork',(x,2.4,1.84),.065,.09,cream)
for i in range(3):cylinder('Stacked plates',(-1,2.35,1.42+i*.05),.26,.045,cream)

# Hero chef. Separate arm pivots are named for runtime motion.
chef=group('Chef',(0,.42,.45))
ball('Chef body',(0,0,1.02),(.66,.48,.89),white,chef)
for x in [-.37,.37]:ball('Chef foot',(x,-.08,.18),(.29,.39,.21),white,chef)
ball('Chef apron',(0,-.42,.9),(.48,.095,.65),orange,chef)
box('Apron pocket',(0,-.523,.74),(.39,.035,.25),cream,.06,chef)
for x in [-.36,.36]:rod('Apron strap',(x,-.39,1.22),(x*.75,-.28,1.65),.06,orange,chef)
head=group('ChefHead');head.parent=chef
ball('Chef head',(0,-.025,1.97),(.70,.51,.61),white,head)
for x in [-.53,.53]:
    ball('Bear round ear',(x,.0,2.42),(.22,.17,.24),white,head)
    ball('Ear inner',(x,-.142,2.43),(.11,.04,.13),pink,head)
ball('Bear muzzle',(0,-.486,1.84),(.32,.14,.225),cream,head)
ball('Bear nose',(0,-.622,1.96),(.105,.065,.075),black,head)
for x in [-.255,.255]:
    ball('Chef eye',(x,-.478,2.075),(.045,.034,.057),black,head)
    ball('Eye glint',(x-.012,-.506,2.096),(.012,.008,.014),snow,head)
for x in [-.43,.43]:ball('Bear cheek',(x,-.428,1.91),(.095,.023,.045),pink,head)
rod('Smile left',(-.105,-.618,1.82),(0,-.64,1.79),.013,black,head)
rod('Smile right',(0,-.64,1.79),(.105,-.618,1.82),.013,black,head)
cylinder('Chef hat band',(0,.0,2.53),.39,.25,snow,head)
for x,y,z in [(-.25,0,2.72),(0,-.13,2.83),(.25,0,2.72),(0,.16,2.76)]:ball('Chef hat puff',(x,y,z),(.27,.26,.25),snow,head)
for side in [-1,1]:
    arm=group('ChefArmLeft' if side<0 else 'ChefArmRight',(side*.52,-.01,1.43));arm.parent=chef
    o=ball('Chef arm',(side*.09,-.19,-.16),(.24,.40,.24),white,arm);o.rotation_euler.x=.35
    ball('Chef paw',(side*.11,-.49,-.23),(.24,.24,.22),white,arm)
    if side==1:
        rod('Tong handle',(0,-.46,-.21),(-.02,-1.04,-.34),.026,steel,arm)
        rod('Tong fork',(.13,-.46,-.21),(.12,-1.04,-.34),.026,steel,arm)

# Three real click targets and separately named food meshes.
box('Grill bowl',(0,-1.13,1.02),(2.55,1.02,.40),metal,.17)
for x in [-1,1]:
    for y in [-1.48,-.8]:rod('Grill legs',(x,y,.42),(x,y,1.03),.065,metal)
for i in range(15):
    x=-1.12+i*.16
    rod('Grill grate',(x,-1.57,1.25),(x,-.7,1.25),.024,steel)
for i in range(16):ball('Ember',(random.uniform(-1.08,1.08),random.uniform(-1.48,-.8),1.08),(.09,.07,.05),coal)
for i,x in enumerate([-.82,0,.82]):
    hit=box('GrillHit'+str(i),(x,-1.14,1.27),(.74,.85,.055),metal,.02);hit['slotIndex']=i;hit['interaction']='grill'
    for j in range(5):rod('Slot grate',(x-.3+j*.15,-1.55,1.32),(x-.3+j*.15,-.74,1.32),.018,steel)
    food=group('Food_meat_'+str(i),(x,-1.15,1.40))
    rod('Skewer',(0,-.40,0),(0,.4,0),.024,wood2,food)
    for j in range(3):
        m=box('MeatPiece',(0,-.23+j*.23,.035),(.28,.17,.14),raw,.055,food);m['cookable']=True
    for y in [-.11,.13]:box('Pepper',(0,y,.03),(.25,.055,.13),green,.02,food)
    f=group('Food_fish_'+str(i),(x,-1.15,1.43))
    o=ball('FishBody',(0,0,0),(.17,.34,.115),fishmat,f);o['cookable']=True
    o=cone('Fish tail',(0,.34,0),.17,.03,.23,fishmat,f);o.rotation_euler.x=math.pi/2
    for xx in [-.14,.14]:ball('FishEye',(xx,-.17,.04),(.025,.025,.025),black,f)

# Table and three animal guests. Each group can leave with its order.
for i,x in enumerate([-3.65,0,3.65]):
    y=-3.12
    cylinder('Table top',(x,y,1.07),.67,.13,wood2)
    cylinder('Table leg',(x,y,.59),.12,.9,wood)
    cylinder('Table foot',(x,y,.18),.43,.09,wood)
    cylinder('Guest plate',(x,y,1.16),.24,.05,cream)
    cylinder('Cup',(x+.35,y+.1,1.25),.10,.23,teal)
    g=group('Guest_'+str(i),(x,y+.73,.18));g['guestIndex']=i
    color=[white,black,wood2][i]
    ball('Guest body',(0,0,.57),(.34,.29,.48),color,g)
    ball('Guest head',(0,-.015,1.09),(.36,.30,.34),color,g)
    if i==1:
        ball('Penguin tummy',(0,-.22,.57),(.26,.09,.32),cream,g)
        ball('Penguin face',(0,-.263,1.1),(.24,.055,.24),cream,g)
        o=cone('Penguin beak',(0,-.355,1.0),.095,0,.17,orange,g);o.rotation_euler.x=math.pi/2
    else:
        for xx in [-.25,.25]:ball('Guest ear',(xx,0,1.35),(.13,.10,.15),color,g)
        ball('Guest muzzle',(0,-.28,.99),(.16,.08,.12),cream,g)
        ball('Guest nose',(0,-.361,1.05),(.055,.03,.04),black,g)
    for xx in [-.125,.125]:ball('Guest eye',(xx,-.284,1.14),(.025,.022,.031),black,g)
    cylinder('Scarf',(0,0,.86),.30,.12,[teal,red,orange][i],g)
    box('Scarf end',(.20,-.265,.68),(.13,.08,.34),[teal,red,orange][i],.035,g)
    for xx in [-.21,.21]:ball('Guest foot',(xx,-.12,.19),(.15,.21,.12),orange if i==1 else color,g)
    cone('Winter hat',(0,.02,1.39),.34,.1,.30,[teal,red,orange][i],g)
    ball('Hat pompom',(0,.02,1.58),(.11,.11,.11),cream,g)

# Snowy pines, fence, firewood, boulders.
for n,(x,y,h) in enumerate([(-4.5,3.3,3.4),(4.5,3.25,3.7),(-4.9,.65,2.6),(5,.2,2.7),(-5,-3.7,1.5),(4.8,-4,1.6)]):
    cylinder('Pine trunk',(x,y,.60),.15,1.0,wood)
    for k in range(3):
        z=.9+k*h*.25;r=(h*.32)*(1-k*.22)
        cone('Pine tier',(x,y,z),r,.035,h*.49,leaf if n%2 else teal)
        cone('Snow tier',(x,y,z+h*.09),r*.83,.025,h*.36,snow)
for x in [-4.8,4.8]:
    for y in [-1.25,-2.1]:rod('Fence post',(x,y,.15),(x,y,.95),.08,wood2)
    for z in [.45,.78]:rod('Fence rail',(x,-1.4,z),(x,-2.35,z),.06,wood2)
for z,count in [(.55,4),(.76,3),(.97,2)]:
    for i in range(count):rod('Firewood',(2.75+i*.17,1.25,z),(2.75+i*.17,1.94,z),.105,wood2)
for i in range(9):
    x,y=random.uniform(-5.4,5.4),random.uniform(3.9,4.5)
    ball('Back snow mound',(x,y,.15),(.38,.28,.23),snow)

# Keep the chef in front of the canopy so the face is visible from the game camera.
chef.location.y = -.80
for o in bpy.data.objects:
    if o.name.startswith(('Grill', 'Slot grate', 'Ember', 'Food_meat_', 'Food_fish_')):
        o.location.y -= 1.0
    if o.name.startswith(('Table top','Table leg','Table foot','Guest plate','Cup')) and abs(o.location.x) < .7:
        o.location.y -= .85
bpy.data.objects['Guest_1'].location.y -= .85

# A camera and lights make the .blend immediately usable; web lighting is separate.
bpy.ops.object.camera_add(location=(10,-15,11))
cam=bpy.context.object;cam.name='PreviewCamera';cam.rotation_euler=(Vector((0,.1,1.35))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=15.8;bpy.context.scene.camera=cam
for name,loc,energy,size in [('Key',(0,-6,10),1700,7),('Fill',(-7,-1,7),1100,8),('Rim',(4,5,8),2000,6)]:
    bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name=name;o.data.energy=energy;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
scene=bpy.context.scene;scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.38,.58,.65,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.5;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
scene.render.resolution_x=1400;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
# Export all geometry (runtime hides/switches food variants); no external dependencies.
bpy.ops.export_scene.gltf(filepath=str(OUT/'polar-bbq.glb'),export_format='GLB',export_apply=True,export_extras=True,export_cameras=False,export_lights=False,export_animations=False)
# Hide the second food variant for the saved Blender composition only.
for o in bpy.data.objects:
    if o.name.startswith('Food_fish_'):
        for c in o.children_recursive:c.hide_render=True
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'polar-bbq.blend'))
meshes=[o for o in bpy.data.objects if o.type=='MESH']
(OUT/'scene-manifest.json').write_text(json.dumps({'generator':'scripts/build_scene.py','blender':bpy.app.version_string,'mesh_count':len(meshes),'source':'assets/blender/polar-bbq.blend','scene':'polar-bbq.glb','grills':['GrillHit0','GrillHit1','GrillHit2'],'food_groups':['Food_'+f+'_'+str(i) for f in ['meat','fish'] for i in range(3)],'guests':['Guest_0','Guest_1','Guest_2'],'coordinate_system':'glTF Y-up; exported from Blender Z-up'},indent=2)+'\n')
if '--render' in sys.argv:
    render=ROOT/'outputs';render.mkdir(exist_ok=True)
    scene.render.filepath=str(render/'polar-bbq-blender.png');bpy.ops.render.render(write_still=True)
print('POLAR_BBQ_DONE',len(meshes),'meshes',OUT/'polar-bbq.glb')
