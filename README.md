# Fashion Generator

Generate fashion images combining outfits, locations, house references, and model references using Gemini API.

## Folder Structure

```
fashion-generator/
├── input/
│   ├── outfits/           # Numbered outfit images (1.jpg, 2.png, etc.)
│   ├── locations/         # Numbered location/pose references (1.jpg, 2.png, etc.)
│   ├── house-references/  # House interior/exterior images (any names)
│   └── model-references/  # Model face/body references (any names, random pick)
├── output/                # Generated images
└── scripts/
    └── generate.js        # Main generation script
```

## How It Works

For each **outfit** + **location** combination:

1. **Location Image**: Model (random ref) + Outfit + Location pose/background
2. **House Series**: Same model + Same outfit + Each house reference (same pose)

## Usage

1. Add your images to the `input/` folders:
   - `input/outfits/1.jpg`, `2.jpg`, etc.
   - `input/locations/1.jpg`, `2.jpg`, etc.
   - `input/house-references/living-room.jpg`, etc.
   - `input/model-references/model-1.jpg`, etc.

2. Set your Gemini API key:
   ```bash
   export GEMINI_API_KEY="your-key-here"
   ```

3. Run the generator:
   ```bash
   cd fashion-generator
   node scripts/generate.js
   ```

## Output Structure

```
output/
├── outfit-1_location-1/
│   ├── location.jpg          # Model in outfit at location
│   ├── house-living-room.jpg # Model in outfit at house
│   └── house-bedroom.jpg     # Model in outfit at house
├── outfit-1_location-2/
│   └── ...
└── ...
```

## Requirements

- Node.js 18+
- Gemini API key
