import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()


def scene_bounds(objects):
    mins = Vector((float("inf"), float("inf"), float("inf")))
    maxs = Vector((float("-inf"), float("-inf"), float("-inf")))
    for obj in objects:
        if obj.type != "MESH":
            continue
        for corner in obj.bound_box:
            world = obj.matrix_world @ Vector(corner)
            mins.x = min(mins.x, world.x)
            mins.y = min(mins.y, world.y)
            mins.z = min(mins.z, world.z)
            maxs.x = max(maxs.x, world.x)
            maxs.y = max(maxs.y, world.y)
            maxs.z = max(maxs.z, world.z)
    return mins, maxs


def normalize_model(root_objects) -> None:
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    mins, maxs = scene_bounds(meshes)
    center = (mins + maxs) * 0.5
    size = max(maxs.x - mins.x, maxs.y - mins.y, maxs.z - mins.z)
    scale = 2.25 / size if size else 1.0

    empty = bpy.data.objects.new("CONTACT47_TRIPO_ROOT", None)
    bpy.context.collection.objects.link(empty)
    for obj in root_objects:
        obj.parent = empty
    empty.location = (-center.x * scale, -center.y * scale, -mins.z * scale)
    empty.scale = (scale, scale, scale)


def add_camera() -> None:
    cam_data = bpy.data.cameras.new("Camera")
    cam = bpy.data.objects.new("Camera", cam_data)
    bpy.context.collection.objects.link(cam)
    cam.location = (0.0, -4.9, 3.55)
    cam.rotation_euler = (math.radians(61), 0, 0)
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = 3.05
    bpy.context.scene.camera = cam


def add_lighting() -> None:
    world = bpy.context.scene.world or bpy.data.worlds.new("World")
    bpy.context.scene.world = world
    world.color = (0.025, 0.035, 0.04)

    key_data = bpy.data.lights.new("key_signal_softbox", "AREA")
    key = bpy.data.objects.new("key_signal_softbox", key_data)
    bpy.context.collection.objects.link(key)
    key.location = (-3.0, -4.0, 5.0)
    key_data.energy = 550
    key_data.size = 4.0

    rim_data = bpy.data.lights.new("green_visor_rim", "POINT")
    rim = bpy.data.objects.new("green_visor_rim", rim_data)
    bpy.context.collection.objects.link(rim)
    rim.location = (2.4, 1.6, 2.2)
    rim_data.energy = 95
    rim_data.color = (0.55, 1.0, 0.22)


def render_still(out_path: Path) -> None:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in [item.identifier for item in scene.render.bl_rna.properties["engine"].enum_items] else "BLENDER_EEVEE"
    scene.render.film_transparent = True
    scene.render.resolution_x = 512
    scene.render.resolution_y = 512
    scene.render.resolution_percentage = 100
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "Medium High Contrast"
    scene.view_settings.exposure = 0
    scene.view_settings.gamma = 1
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.filepath = str(out_path)
    bpy.ops.render.render(write_still=True)


def main() -> int:
    if len(sys.argv) < 3:
        print("Usage: blender -b --python scripts/render-tripo-contact47.py -- input.glb output.png")
        return 2
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    src = Path(argv[0]).expanduser()
    out = Path(argv[1]).expanduser()
    out.parent.mkdir(parents=True, exist_ok=True)

    clear_scene()
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(src))
    imported = [obj for obj in bpy.context.scene.objects if obj not in before]
    normalize_model([obj for obj in imported if obj.parent is None])
    add_camera()
    add_lighting()
    render_still(out)
    print(f"Rendered {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
