#!/usr/bin/env node
/**
 * Fashion Generator - Generate images combining outfits, locations, houses, and models
 * Usage: node scripts/generate.js
 */

import 'dotenv/config';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..');
const INPUT_DIR = path.join(ROOT_DIR, 'input');
const OUTPUT_DIR = path.join(ROOT_DIR, 'output');

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  console.error('❌ GEMINI_API_KEY not found. Set it in your environment.');
  process.exit(1);
}

// Input folders
const OUTFITS_DIR = path.join(INPUT_DIR, 'outfits');
const LOCATIONS_DIR = path.join(INPUT_DIR, 'locations');
const HOUSE_DIR = path.join(INPUT_DIR, 'house-references');
const MODEL_DIR = path.join(INPUT_DIR, 'model-references');

// Supported image extensions
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

function isImageFile(filename) {
  const ext = path.extname(filename).toLowerCase();
  return IMAGE_EXTENSIONS.includes(ext);
}

function getImageFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => isImageFile(f))
    .map(f => ({
      name: path.parse(f).name,
      path: path.join(dir, f)
    }));
}

function getNumberedFiles(dir) {
  const files = getImageFiles(dir);
  // Sort by numeric value if possible
  return files.sort((a, b) => {
    const numA = parseInt(a.name);
    const numB = parseInt(b.name);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.name.localeCompare(b.name);
  });
}

function getRandomModelRef() {
  const models = getImageFiles(MODEL_DIR);
  if (models.length === 0) {
    throw new Error('No model references found in input/model-references/');
  }
  return models[Math.floor(Math.random() * models.length)];
}

function fileToBase64(filePath) {
  return fs.readFileSync(filePath).toString('base64');
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif'
  };
  return mimeTypes[ext] || 'image/jpeg';
}

async function callGemini(payload, model = 'gemini-3-pro-image-preview') {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/${model}:generateContent?key=${API_KEY}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(JSON.stringify(payload));
    req.end();
  });
}

async function generateImage(prompt, referenceImages, outputPath) {
  try {
    const parts = [{ text: prompt }];
    
    // Add reference images
    for (const img of referenceImages) {
      parts.push({
        inline_data: {
          mime_type: getMimeType(img.path),
          data: fileToBase64(img.path)
        }
      });
    }

    const response = await callGemini({
      contents: [{ parts }],
      generationConfig: { responseModalities: ["IMAGE"] }
    });

    const candidate = response.candidates?.[0];
    
    if (candidate?.finishReason === 'STOP') {
      for (const part of candidate?.content?.parts || []) {
        if (part.inlineData) {
          const imgData = Buffer.from(part.inlineData.data, 'base64');
          fs.writeFileSync(outputPath, imgData);
          return { success: true };
        }
      }
    } else if (candidate?.finishReason === 'IMAGE_SAFETY') {
      console.log(`   ⚠️  Blocked by safety`);
      return { success: false, reason: 'safety' };
    } else {
      console.log(`   ❌ Error: ${candidate?.finishReason || 'unknown'}`);
      if (response.error) {
        console.log(`   📛 API Error: ${JSON.stringify(response.error).substring(0, 200)}`);
      }
      return { success: false, reason: candidate?.finishReason };
    }
  } catch (err) {
    console.log(`   ❌ Exception: ${err.message}`);
    return { success: false, reason: 'exception', error: err.message };
  }
  
  return { success: false, reason: 'no_data' };
}

async function main() {
  console.log('🎨 FASHION GENERATOR\n');
  console.log('=' .repeat(70));
  
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  // Load input files
  const outfits = getNumberedFiles(OUTFITS_DIR);
  const locations = getNumberedFiles(LOCATIONS_DIR);
  const houses = getImageFiles(HOUSE_DIR);
  
  console.log(`\n📦 Input files:`);
  console.log(`   Outfits: ${outfits.length}`);
  console.log(`   Locations: ${locations.length}`);
  console.log(`   House references: ${houses.length}`);
  
  if (outfits.length === 0) {
    console.error('\n❌ No outfit images found in input/outfits/');
    process.exit(1);
  }
  if (locations.length === 0) {
    console.error('\n❌ No location images found in input/locations/');
    process.exit(1);
  }
  if (houses.length === 0) {
    console.error('\n❌ No house reference images found in input/house-references/');
    process.exit(1);
  }
  
  // Track total progress
  let totalGenerated = 0;
  let totalFailed = 0;
  
  // For each outfit + location combination
  for (const outfit of outfits) {
    // Pick a random model reference (stays consistent for this outfit's generation)
    const modelRef = getRandomModelRef();
    console.log(`\n👤 Selected model: ${modelRef.name}`);
    
    for (const location of locations) {
      const comboName = `outfit-${outfit.name}_location-${location.name}`;
      const comboDir = path.join(OUTPUT_DIR, comboName);
      
      if (!fs.existsSync(comboDir)) {
        fs.mkdirSync(comboDir, { recursive: true });
      }
      
      console.log(`\n${'='.repeat(70)}`);
      console.log(`Generating: ${comboName}`);
      console.log(`Outfit: ${outfit.name} | Location: ${location.name}`);
      console.log('=' .repeat(70));
      
      // 1. Generate location image (model + outfit + location pose)
      console.log(`\n   📍 Location image...`);
      const locationPrompt = `Create a fashion photo of a woman wearing the outfit from the first reference image. Use the face/identity from the second reference. Pose and setting should match the third reference image (location/pose reference). Maintain consistent lighting and style.`;
      
      const locationResult = await generateImage(
        locationPrompt,
        [
          { name: 'outfit', path: outfit.path },
          { name: 'model', path: modelRef.path },
          { name: 'location', path: location.path }
        ],
        path.join(comboDir, 'location.jpg')
      );
      
      if (locationResult.success) {
        console.log(`   ✅ Location image saved`);
        totalGenerated++;
      } else {
        console.log(`   ❌ Failed`);
        totalFailed++;
      }
      
      await new Promise(r => setTimeout(r, 3000));
      
      // 2. Generate house series (same model + outfit + each house reference)
      for (const house of houses) {
        console.log(`\n   🏠 House: ${house.name}...`);
        
        const housePrompt = `Create a fashion photo of a woman wearing the outfit from the first reference image. Use the face/identity from the second reference. Background and setting should match the third reference image (house interior/exterior). Pose should be similar to the fourth reference (location pose).`;
        
        const houseResult = await generateImage(
          housePrompt,
          [
            { name: 'outfit', path: outfit.path },
            { name: 'model', path: modelRef.path },
            { name: 'house', path: house.path },
            { name: 'pose', path: location.path }
          ],
          path.join(comboDir, `house-${house.name}.jpg`)
        );
        
        if (houseResult.success) {
          console.log(`   ✅ House image saved`);
          totalGenerated++;
        } else {
          console.log(`   ❌ Failed`);
          totalFailed++;
        }
        
        await new Promise(r => setTimeout(r, 3000));
      }
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total generated: ${totalGenerated}`);
  console.log(`Total failed: ${totalFailed}`);
  console.log(`\nOutput: ${OUTPUT_DIR}/`);
}

main().catch(console.error);
