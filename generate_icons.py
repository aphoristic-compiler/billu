import os
from PIL import Image, ImageDraw, ImageFont

def draw_badge():
    size = 96
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Draw ">"
    points = [(24, 28), (48, 48), (24, 68)]
    draw.line(points, fill=(255, 255, 255, 255), width=10, joint='curve')
    
    # Draw "_"
    draw.rectangle([(48, 58), (72, 68)], fill=(255, 255, 255, 255))
    
    img.save('public/push-badge.png')

def draw_icon():
    size = 256
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Draw terminal prompt >_ in neon green for the icon
    green = (0, 255, 0, 255)
    points = [(50, 70), (110, 128), (50, 186)]
    draw.line(points, fill=green, width=24, joint='curve')
    
    draw.rectangle([(110, 162), (180, 186)], fill=green)
    
    img.save('public/push-icon.png')

if __name__ == '__main__':
    draw_badge()
    draw_icon()
    print("Icons generated successfully.")
