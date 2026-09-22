import os
import hashlib
from PIL import Image, ImageDraw

OUT_DIR = "assets/chat-avatars"
os.makedirs(OUT_DIR, exist_ok=True)

AVATAR_SPECS = {
    "阿良": {
        "src": "scratch/ultra_hd/阿良_1_0x0.jpg",
        "crop": (280, 0, 980, 700),
    },
    "陈平安": {
        "src": "scratch/anime_avatars/陆沉_1.jpg",
        "crop": (580, 50, 1380, 850),
    },
    "宁姚": {
        "src": "scratch/ultra_hd/崔东山_1_0x0.jpg",
        "crop": (50, 150, 800, 900),
    },
    "崔东山": {
        "src": "scratch/anime_avatars/崔东山_1.jpg",
        "crop": (80, 20, 580, 520),
    },
    "陈景清": {
        "src": "scratch/ultra_hd/陈景清_2_0x0.jpg",
        "crop": (520, 270, 780, 530),
    },
    "陆沉": {
        "src": "scratch/ultra_hd/陆沉_3_0x0.jpg",
        "crop": (820, 10, 1180, 370),
    },
    "周米粒": {
        "src": "scratch/anime_avatars/hq_周米粒_0.jpg",
        "crop": (170, 140, 340, 310),
    },
    "齐静春": {
        "src": "scratch/ultra_hd/齐静春_1_0x0.jpg",
        "crop": (420, 140, 800, 520),
    },
    "李宝瓶": {
        "src": "scratch/ultra_hd/李宝瓶_1_0x0.jpg",
        "crop": (140, 40, 540, 440),
    },
    "阮秀": {
        "src": "scratch/ultra_hd/阮秀_1_0x0.jpg",
        "crop": (180, 20, 980, 820),
    },
    "左右": {
        "src": "scratch/ultra_hd/左右_0_0x0.jpg",
        "crop": (200, 230, 520, 550),
    },
}

def make_circular_avatar(img_crop, size=(512, 512)):
    ss_size = (size[0] * 2, size[1] * 2)
    img_resized = img_crop.resize(ss_size, Image.Resampling.LANCZOS).convert("RGBA")
    mask = Image.new("L", ss_size, 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, ss_size[0], ss_size[1]), fill=255)
    img_resized.putalpha(mask)
    return img_resized.resize(size, Image.Resampling.LANCZOS)

existing_files = os.listdir(OUT_DIR)

for name, spec in AVATAR_SPECS.items():
    src_path = spec["src"]
    if not os.path.exists(src_path):
        continue
    
    im = Image.open(src_path)
    crop_box = spec["crop"]
    cropped = im.crop(crop_box)
    avatar = make_circular_avatar(cropped, (512, 512))
    
    target_file = None
    for ef in existing_files:
        if ef.startswith(f"{name}-") and ef.endswith(".png"):
            target_file = ef
            break
    if not target_file:
        h = hashlib.sha256(name.encode('utf-8')).hexdigest()[:16]
        target_file = f"{name}-{h}.png"
    
    out_path = os.path.join(OUT_DIR, target_file)
    avatar.save(out_path, "PNG", optimize=True)
    print(f"[OK] {name} -> {target_file}")
