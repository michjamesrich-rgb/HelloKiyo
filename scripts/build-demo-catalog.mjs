/**
 * Regenerates data/products.json with 10+ demo SKUs per main category,
 * using stable Pexels CDN URLs (verified HTTP 200).
 *
 * Run: node scripts/build-demo-catalog.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(__dirname, "../data/products.json");

const img = (id) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=480&h=480&fit=crop`;

/** 70 IDs — first 59 unique (curl-checked), remainder repeat for 7×10 rows */
const PHOTO_IDS = [
  2000000, 3000000, 4000000, 5000000, 6000000, 8000000, 9000000, 1128678, 1640777, 1646314,
  205961, 3064254, 3789885, 4041392, 4052388, 4110250, 5632391, 5632401, 7261425, 175659,
  1503602, 1556228, 1576045, 1619569, 1639562, 1656688, 1697912, 1702373, 1839919, 1854189,
  1876279, 1893102, 1912055, 1933900, 1995842, 2033997, 2059191, 2074129, 2089718, 2119761,
  2130134, 2178723, 2209114, 2238303, 2255937, 2261758, 2280536, 2291361, 2304777, 2329446,
  2341298, 2364879, 2387793, 2398984, 2410524, 2421933, 2433214, 2444256, 2466488,
  2000000, 3000000, 4000000, 5000000, 6000000, 8000000, 9000000, 1128678, 1640777, 1646314,
  205961,
];

let i = 0;
function nextImage() {
  const id = PHOTO_IDS[i % PHOTO_IDS.length];
  i += 1;
  return img(id);
}

function p(id, title, category, description, vibe, retailYen = 480) {
  return {
    id,
    title,
    category,
    description,
    vibe,
    image: nextImage(),
    retailYen,
    supplierUnitCostUsd: 0.85,
    expectedJapanToUSShippingAllocationUsd: 0.45,
    handlingAllowanceUsd: 0.22,
  };
}

const products = [];

// --- Japanese Candy Party (10) — titles tuned for SUBCATEGORIES patterns
products.push(
  p("jcp_01", "Strawberry chocolate biscuit sticks", "Japanese Candy Party", "Crispy sticks dipped in pink strawberry chocolate — a sweet afternoon break.", ["Sweet", "Pink"], 320),
  p("jcp_02", "Hi-Chew mixed fruit chews", "Japanese Candy Party", "Soft fruit gummies with a long-lasting juicy chew.", ["Sweet", "Colorful"], 280),
  p("jcp_03", "Grape konjac jelly pouch", "Japanese Candy Party", "Jiggly grape jelly snack — fun to squeeze and sip.", ["Sweet", "Fun"], 220),
  p("jcp_04", "Mintia icy mint tablets", "Japanese Candy Party", "Tiny powerful mints for a fresh sparkle between snacks.", ["Sweet", "Sparkle"], 180),
  p("jcp_05", "Milky caramel soft cubes", "Japanese Candy Party", "Creamy caramel squares with a nostalgic milk flavor.", ["Sweet", "Pink"], 260),
  p("jcp_06", "Melty chocolate truffle bites", "Japanese Candy Party", "Smooth ganache-style centers in a cute foil wrap.", ["Sweet", "Glow"], 340),
  p("jcp_07", "Puchao cola gummy ropes", "Japanese Candy Party", "Playful cola gummies with fizzy candy bits inside.", ["Sweet", "Fun"], 240),
  p("jcp_08", "Lemon hard candy drops", "Japanese Candy Party", "Bright citrus drops — shareable and pocket-sized.", ["Sweet", "Colorful"], 200),
  p("jcp_09", "Matcha kitkat mini pack", "Japanese Candy Party", "Earthy matcha layered wafers — a Tokyo souvenir vibe.", ["Sweet", "Glow"], 360),
  p("jcp_10", "Fruit jelly cup assortment", "Japanese Candy Party", "Assorted mini cups — peach, grape, and orange sparkle.", ["Sweet", "Sparkle"], 300),
);

// --- Travel-Size Beauty (10)
products.push(
  p("tsb_01", "Lululun sheet mask set (pink)", "Travel-Size Beauty", "Daily hydration masks with a soft sakura scent.", ["Glow", "Pink"], 890),
  p("tsb_02", "Cherry lip balm tint tube", "Travel-Size Beauty", "Sheer cherry tint with a glossy comfortable wear.", ["Pink", "Glow"], 420),
  p("tsb_03", "Hada Labo lotion mini bottle", "Travel-Size Beauty", "Hyaluronic layering toner for dewy glass skin.", ["Glow", "Cute"], 560),
  p("tsb_04", "Clear Turn princess mask single", "Travel-Size Beauty", "Brightening sheet mask with cute packaging art.", ["Glow", "Sparkle"], 320),
  p("tsb_05", "Serum essence vial travel", "Travel-Size Beauty", "Concentrated essence for overnight glow recovery.", ["Glow", "Colorful"], 780),
  p("tsb_06", "Mediheal tea tree mask duo", "Travel-Size Beauty", "Cooling sheet masks to calm busy skin days.", ["Glow", "Cute"], 440),
  p("tsb_07", "Nail cuticle oil pen rose", "Travel-Size Beauty", "Twist-up oil for glossy healthy-looking nails.", ["Pink", "Sparkle"], 380),
  p("tsb_08", "Silky hair oil travel size", "Travel-Size Beauty", "Weightless oil for shiny ends on the go.", ["Glow", "Colorful"], 520),
  p("tsb_09", "BB cream cushion sample kit", "Travel-Size Beauty", "Natural coverage cushion compacts for touch-ups.", ["Glow", "Pink"], 960),
  p("tsb_10", "Moisturizing cream mini jar", "Travel-Size Beauty", "Rich cream for cheeks and dry spots — kawaii jar.", ["Glow", "Cute"], 640),
);

// --- Cup Ramen Flavors (10)
products.push(
  p("crf_01", "Cup noodle classic soy cup", "Cup Ramen Flavors", "Iconic soy broth noodles — quick cozy lunch.", ["Savory", "Fun"], 220),
  p("crf_02", "Spicy miso fire cup ramen", "Cup Ramen Flavors", "Bold miso heat with sesame aroma.", ["Savory", "Sparkle"], 240),
  p("crf_03", "Tonkotsu pork broth cup", "Cup Ramen Flavors", "Creamy white broth inspired by Hakata stalls.", ["Savory", "Colorful"], 260),
  p("crf_04", "Seafood tom yum cup noodles", "Cup Ramen Flavors", "Lemongrass and shrimp notes — bright and zesty.", ["Savory", "Fun"], 250),
  p("crf_05", "Curry cup ramen thick sauce", "Cup Ramen Flavors", "Sweet Japanese curry roux clinging to noodles.", ["Savory", "Cute"], 230),
  p("crf_06", "Yakisoba UFO tray noodles", "Cup Ramen Flavors", "Pan-style noodles with tangy sauce packet.", ["Savory", "Colorful"], 280),
  p("crf_07", "Soba kitsune cup with fried tofu", "Cup Ramen Flavors", "Light dashi soba with sweet aburaage.", ["Savory", "Pink"], 210),
  p("crf_08", "Udon tempura bowl instant", "Cup Ramen Flavors", "Thick udon with crispy tempura chip topping.", ["Savory", "Fun"], 270),
  p("crf_09", "Hot chili oil cup ramen", "Cup Ramen Flavors", "Chili-forward broth for spice lovers.", ["Savory", "Sparkle"], 235),
  p("crf_10", "Shio seafood cup classic", "Cup Ramen Flavors", "Clear salt broth with gentle seafood notes.", ["Savory", "Glow"], 225),
);

// --- Kawaii Stationery (10)
products.push(
  p("ks_01", "Pilot Juice gel pen 0.5 pastel", "Kawaii Stationery", "Smooth gel ink in soft lavender and mint barrels.", ["Cute", "Pastel"], 180),
  p("ks_02", "Tombow mono eraser block", "Kawaii Stationery", "Crisp erasing for sketches and study notes.", ["Cute", "Colorful"], 120),
  p("ks_03", "Zebra mildliner highlighter set", "Kawaii Stationery", "Dual-tip pastel markers for planner spreads.", ["Cute", "Sparkle"], 260),
  p("ks_04", "Sakura grid notebook A6", "Kawaii Stationery", "Compact dot grid for journaling on the train.", ["Cute", "Pink"], 220),
  p("ks_05", "Kawaii flake stickers dessert", "Kawaii Stationery", "Puffy dessert stickers for deco planners.", ["Cute", "Sweet"], 160),
  p("ks_06", "Sakura washi tape slim trio", "Kawaii Stationery", "Floral masking tapes for borders and tabs.", ["Cute", "Floral"], 190),
  p("ks_07", "Uni-ball signo white gel pen", "Kawaii Stationery", "Opaque white ink for black paper doodles.", ["Cute", "Sparkle"], 150),
  p("ks_08", "Pentel mechanical pencil 0.5", "Kawaii Stationery", "Shake-advance pencil with comfy pastel grip.", ["Cute", "Pastel"], 200),
  p("ks_09", "Highlighter twin pastel pack", "Kawaii Stationery", "Soft colors that will not bleed through thin paper.", ["Cute", "Colorful"], 210),
  p("ks_10", "Travel journal kawaii cover", "Kawaii Stationery", "Embossed cover with ribbon bookmark — diary ready.", ["Cute", "Pink"], 340),
);

// --- Snack Market (10)
products.push(
  p("sm_01", "Calbee potato chips consommé", "Snack Market", "Crispy ridged chips with rich umami seasoning.", ["Fun", "Savory"], 220),
  p("sm_02", "Pocky matcha green biscuit", "Snack Market", "Matcha-coated sticks — shareable green tea treat.", ["Sweet", "Glow"], 240),
  p("sm_03", "Jagabee butter potato sticks", "Snack Market", "Crunchy fry-cut sticks in a pocket pouch.", ["Fun", "Colorful"], 260),
  p("sm_04", "Hello Panda chocolate biscuit", "Snack Market", "Bite-size biscuits with creamy cocoa filling.", ["Sweet", "Cute"], 200),
  p("sm_05", "Oreo thin cookies vanilla", "Snack Market", "Light crispy sandwich cookies for snack breaks.", ["Sweet", "Fun"], 230),
  p("sm_06", "Senbei rice cracker mix bag", "Snack Market", "Soy-glazed and seaweed arare assortment.", ["Savory", "Fun"], 280),
  p("sm_07", "Itoen oi ocha green tea bottle", "Snack Market", "Unsweetened green tea — fridge friendly.", ["Glow", "Colorful"], 180),
  p("sm_08", "KitKat strawberry share pack", "Snack Market", "Mini bars with fruity pink coating.", ["Sweet", "Pink"], 320),
  p("sm_09", "Collon cream roll biscuits", "Snack Market", "Tiny waffle rolls filled with vanilla cream.", ["Sweet", "Cute"], 210),
  p("sm_10", "Potato chip seaweed salt", "Snack Market", "Nori-kissed chips with a beach picnic vibe.", ["Savory", "Sparkle"], 225),
);

// --- Plush & Keychains (10) — names include franchise cues for SUBCATEGORIES
products.push(
  p("pk_01", "My Melody plush bag clip", "Plush & Keychains", "Soft pink hood mascot — clips to totes and zippers.", ["Cute", "Pink"], 920),
  p("pk_02", "Cinnamoroll cloud mascot mini", "Plush & Keychains", "Sky puppy plush with embroidered blush cheeks.", ["Cute", "Pastel"], 980),
  p("pk_03", "Pikachu tail keychain rubber", "Plush & Keychains", "Bright yellow lightning buddy for keys.", ["Cute", "Sparkle"], 640),
  p("pk_04", "Chiikawa crying face charm", "Plush & Keychains", "Tiny emotional support bean on a ball chain.", ["Cute", "Colorful"], 720),
  p("pk_05", "Rilakkuma lazy bear palm plush", "Plush & Keychains", "Pocket-sized bear for desk naps.", ["Cute", "Sweet"], 1100),
  p("pk_06", "Kuromi bow keyring pastel", "Plush & Keychains", "Mischievous rabbit with glitter heart charm.", ["Cute", "Sparkle"], 760),
  p("pk_07", "Pompompurin pudding pup plush", "Plush & Keychains", "Yellow beret dog — squishy and round.", ["Cute", "Sweet"], 890),
  p("pk_08", "Totoro leaf umbrella plush", "Plush & Keychains", "Forest spirit plush with stitched leaf detail.", ["Cute", "Glow"], 1250),
  p("pk_09", "Eevee fluffy evolution keychain", "Plush & Keychains", "Soft brown fox with felt collar accent.", ["Cute", "Colorful"], 680),
  p("pk_10", "Jigglypuff round palm plush", "Plush & Keychains", "Pink balloon singer — fits in one hand.", ["Cute", "Pink"], 740),
);

// --- Crafts & DIY (10)
products.push(
  p("cd_01", "MT washi tape slim sakura", "Crafts & DIY", "Petals and grid lines for journaling borders.", ["Cute", "Floral"], 420),
  p("cd_02", "Flake stickers pastel dessert", "Crafts & DIY", "Clear-backed dessert icons for planners.", ["Cute", "Sweet"], 360),
  p("cd_03", "Origami chiyogami 15cm pack", "Crafts & DIY", "Patterned squares for cranes and gift toppers.", ["Cute", "Colorful"], 280),
  p("cd_04", "UV resin mini starter kit", "Crafts & DIY", "Tiny bottles and mixing sticks for charm casting.", ["Sparkle", "Glow"], 1200),
  p("cd_05", "Fude brush pen lettering set", "Crafts & DIY", "Soft tip for thick-thin strokes and headers.", ["Cute", "Glow"], 540),
  p("cd_06", "Polymer clay pastel sampler", "Crafts & DIY", "12 oven-bake colors for mini sweets sculpting.", ["Cute", "Pastel"], 680),
  p("cd_07", "Aquabeads star refill jar", "Crafts & DIY", "Fuse beads for sparkly coasters and charms.", ["Cute", "Sparkle"], 520),
  p("cd_08", "Masking tape grid washi duo", "Crafts & DIY", "Planner-friendly lines and dot grids.", ["Cute", "Colorful"], 310),
  p("cd_09", "Foil origami metallic pack", "Crafts & DIY", "Shiny squares that hold crisp folds.", ["Sparkle", "Cute"], 290),
  p("cd_10", "Tombow fudenosuke brush pen", "Crafts & DIY", "Small brush tip for kawaii lettering practice.", ["Cute", "Glow"], 380),
);

if (products.length !== 70) {
  console.error("Expected 70 products, got", products.length);
  process.exit(1);
}

fs.writeFileSync(outPath, `${JSON.stringify(products, null, 2)}\n`);
console.log("Wrote", outPath, "(" + products.length + " products)");
