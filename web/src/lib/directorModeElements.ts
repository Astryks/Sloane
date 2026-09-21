// Director Mode's reference-element libraries (2026-09-21): wardrobe,
// locations, character archetypes, props/objects, cities, culture/cuisine,
// music mood, and dialogue languages - split from directorMode.ts (the
// core detection/assembly engine) purely to keep that file readable; these
// are large, mostly-static data libraries, not logic. Same deterministic,
// no-LLM philosophy as the rest of this project (see directorMode.ts's own
// header comment for why) - real, concrete, reusable descriptions, not
// vague adjectives, the same standard already proven in SHOT_LIBRARY
// (productAdStoryboard.ts).
//
// Detection here is deliberately lightweight (simple label/keyword
// substring matching), not a bespoke regex per entry the way GenreKey/
// CameraMove are - these libraries exist to support a browsable UI picker
// and light auto-enrichment, not to classify the whole prompt the way the
// four core axes do.

// ============================================================================
// Wardrobe (100+ entries: male, female, kids)
// ============================================================================
export type WardrobeGender = "male" | "female" | "kids";
export type WardrobeItem = { id: string; gender: WardrobeGender; category: string; description: string };

export const WARDROBE_LIBRARY: WardrobeItem[] = [
  // -- Male: casual --
  { id: "m-casual-1", gender: "male", category: "Casual", description: "worn denim jeans, a plain white crew-neck t-shirt, white sneakers" },
  { id: "m-casual-2", gender: "male", category: "Casual", description: "olive cargo pants, a fitted grey henley, brown leather boots" },
  { id: "m-casual-3", gender: "male", category: "Casual", description: "black joggers, an oversized hoodie, black high-top sneakers" },
  { id: "m-casual-4", gender: "male", category: "Casual", description: "khaki chinos, a light blue oxford button-down rolled to the elbows, tan loafers, no socks" },
  { id: "m-casual-5", gender: "male", category: "Casual", description: "a cable-knit sweater, corduroy pants, desert boots" },
  // -- Male: business/formal --
  { id: "m-formal-1", gender: "male", category: "Business & Formal", description: "a charcoal grey wool suit, white dress shirt, no tie, top button open" },
  { id: "m-formal-2", gender: "male", category: "Business & Formal", description: "a navy blazer over a white t-shirt, dark jeans, brown leather dress shoes" },
  { id: "m-formal-3", gender: "male", category: "Business & Formal", description: "a fitted black tuxedo, white bow tie, patent leather shoes" },
  { id: "m-formal-4", gender: "male", category: "Business & Formal", description: "a tailored light grey suit, pale pink shirt, no tie" },
  // -- Male: athletic --
  { id: "m-athletic-1", gender: "male", category: "Athletic", description: "black compression leggings, a fitted grey performance t-shirt, running shoes, a sports watch" },
  { id: "m-athletic-2", gender: "male", category: "Athletic", description: "basketball shorts, a sleeveless tank top, high-top basketball sneakers" },
  { id: "m-athletic-3", gender: "male", category: "Athletic", description: "a full tracksuit in navy with white stripes, trainers" },
  { id: "m-athletic-4", gender: "male", category: "Athletic", description: "cycling bibs, a fitted jersey, clip-in cycling shoes, a helmet" },
  // -- Male: outdoor --
  { id: "m-outdoor-1", gender: "male", category: "Outdoor", description: "a waterproof olive-green field jacket, thermal base layer, hiking boots, a beanie" },
  { id: "m-outdoor-2", gender: "male", category: "Outdoor", description: "a navy puffer jacket, jeans, waterproof boots, a wool scarf" },
  { id: "m-outdoor-3", gender: "male", category: "Outdoor", description: "board shorts, no shirt, bare feet, sunglasses pushed up on his head" },
  { id: "m-outdoor-4", gender: "male", category: "Outdoor", description: "a flannel shirt over a thermal, work boots, a canvas jacket" },
  { id: "m-outdoor-5", gender: "male", category: "Outdoor", description: "a linen shirt unbuttoned over swim trunks, sunglasses" },
  { id: "m-outdoor-6", gender: "male", category: "Outdoor", description: "a wetsuit, a surfboard under one arm" },
  { id: "m-outdoor-7", gender: "male", category: "Outdoor", description: "a Hawaiian print shirt, khaki shorts, sandals" },
  // -- Male: evening --
  { id: "m-evening-1", gender: "male", category: "Evening", description: "a black silk button-down shirt, tailored trousers, no tie, dress shoes" },
  { id: "m-evening-2", gender: "male", category: "Evening", description: "a deep burgundy velvet blazer, black trousers, a black turtleneck" },
  // -- Male: traditional/cultural --
  { id: "m-trad-1", gender: "male", category: "Traditional & Cultural", description: "a traditional white kurta with a Nehru collar, fitted trousers" },
  { id: "m-trad-2", gender: "male", category: "Traditional & Cultural", description: "a classic kilt in muted tartan, a white shirt, a sporran" },
  { id: "m-trad-3", gender: "male", category: "Traditional & Cultural", description: "a traditional dashiki in bold print" },
  { id: "m-trad-4", gender: "male", category: "Traditional & Cultural", description: "a formal kimono in deep indigo with a black obi" },
  // -- Male: period/historical --
  { id: "m-period-1", gender: "male", category: "Period & Historical", description: "a Victorian-era frock coat, waistcoat, and cravat" },
  { id: "m-period-2", gender: "male", category: "Period & Historical", description: "1920s-style suspenders over a white shirt, a flat cap, wool trousers" },
  { id: "m-period-3", gender: "male", category: "Period & Historical", description: "a medieval tunic and leather vest over rough-spun trousers" },
  { id: "m-period-4", gender: "male", category: "Period & Historical", description: "a correctly-weathered 1940s-era military uniform" },
  // -- Male: uniform/occupational --
  { id: "m-uniform-1", gender: "male", category: "Uniform & Occupational", description: "a chef's white double-breasted jacket and checkered trousers" },
  { id: "m-uniform-2", gender: "male", category: "Uniform & Occupational", description: "a pilot's uniform with epaulettes and a peaked cap" },
  { id: "m-uniform-3", gender: "male", category: "Uniform & Occupational", description: "a firefighter's turnout gear, helmet under one arm" },
  { id: "m-uniform-4", gender: "male", category: "Uniform & Occupational", description: "a mechanic's navy coveralls, smudged with real grease" },
  // -- Male: loungewear/streetwear --
  { id: "m-lounge-1", gender: "male", category: "Loungewear", description: "grey cotton sweatpants, a faded band t-shirt, bare feet" },
  { id: "m-lounge-2", gender: "male", category: "Loungewear", description: "flannel pajama pants and a plain white undershirt" },
  { id: "m-street-1", gender: "male", category: "Streetwear", description: "an oversized graphic hoodie, wide-leg cargo pants, chunky sneakers, a beanie" },
  { id: "m-street-2", gender: "male", category: "Streetwear", description: "a bomber jacket, slim black jeans, white low-top sneakers" },
  { id: "m-street-3", gender: "male", category: "Streetwear", description: "a varsity jacket over a plain tee, straight-leg jeans" },
  { id: "m-street-4", gender: "male", category: "Streetwear", description: "a bomber jacket, ripped jeans, combat boots" },

  // -- Female: casual --
  { id: "f-casual-1", gender: "female", category: "Casual", description: "high-waisted blue jeans, a fitted white ribbed tank top, white sneakers" },
  { id: "f-casual-2", gender: "female", category: "Casual", description: "a flowy floral sundress, tan sandals" },
  { id: "f-casual-3", gender: "female", category: "Casual", description: "black leggings, an oversized cream sweater, ankle boots" },
  { id: "f-casual-4", gender: "female", category: "Casual", description: "denim shorts, a tucked-in graphic t-shirt, canvas sneakers" },
  { id: "f-casual-5", gender: "female", category: "Casual", description: "a cable-knit sweater dress, over-the-knee boots" },
  // -- Female: business/formal --
  { id: "f-formal-1", gender: "female", category: "Business & Formal", description: "a tailored black pantsuit, a cream silk blouse, pointed-toe heels" },
  { id: "f-formal-2", gender: "female", category: "Business & Formal", description: "a fitted navy sheath dress, a blazer, nude heels" },
  { id: "f-formal-3", gender: "female", category: "Business & Formal", description: "a floor-length emerald green gown, delicate gold jewelry" },
  { id: "f-formal-4", gender: "female", category: "Business & Formal", description: "a cream pencil skirt, a fitted blouse, low block heels" },
  // -- Female: athletic --
  { id: "f-athletic-1", gender: "female", category: "Athletic", description: "black leggings, a matching sports bra, running shoes, hair in a ponytail" },
  { id: "f-athletic-2", gender: "female", category: "Athletic", description: "a white tennis dress, tennis shoes, a visor" },
  { id: "f-athletic-3", gender: "female", category: "Athletic", description: "a full yoga set in sage green, bare feet" },
  { id: "f-athletic-4", gender: "female", category: "Athletic", description: "cycling shorts, a fitted jersey, cycling shoes" },
  // -- Female: outdoor --
  { id: "f-outdoor-1", gender: "female", category: "Outdoor", description: "a fitted dusty-rose puffer jacket, jeans, waterproof boots" },
  { id: "f-outdoor-2", gender: "female", category: "Outdoor", description: "a bikini under a sheer linen cover-up, a sun hat, bare feet" },
  { id: "f-outdoor-3", gender: "female", category: "Outdoor", description: "a wool peacoat, a knit scarf, leather gloves" },
  { id: "f-outdoor-4", gender: "female", category: "Outdoor", description: "hiking pants, a moisture-wicking shirt, sturdy boots, a small backpack" },
  { id: "f-outdoor-5", gender: "female", category: "Outdoor", description: "a cream linen jumpsuit, espadrilles" },
  { id: "f-outdoor-6", gender: "female", category: "Outdoor", description: "a wetsuit, hair pulled back" },
  // -- Female: evening --
  { id: "f-evening-1", gender: "female", category: "Evening", description: "a fitted black cocktail dress, strappy heels, a delicate necklace" },
  { id: "f-evening-2", gender: "female", category: "Evening", description: "a sequined mini dress in deep red, heeled sandals" },
  { id: "f-evening-3", gender: "female", category: "Evening", description: "a silk slip dress in champagne, minimal jewelry" },
  { id: "f-evening-4", gender: "female", category: "Evening", description: "a silky robe, soft morning light" },
  // -- Female: traditional/cultural --
  { id: "f-trad-1", gender: "female", category: "Traditional & Cultural", description: "a vibrant saree with intricate gold embroidery" },
  { id: "f-trad-2", gender: "female", category: "Traditional & Cultural", description: "a traditional qipao in red silk with a mandarin collar" },
  { id: "f-trad-3", gender: "female", category: "Traditional & Cultural", description: "a flowing traditional abaya in black with subtle embroidery" },
  { id: "f-trad-4", gender: "female", category: "Traditional & Cultural", description: "a formal kimono in soft pink with a floral obi" },
  { id: "f-trad-5", gender: "female", category: "Traditional & Cultural", description: "a traditional dirndl with a fitted bodice" },
  // -- Female: period/historical --
  { id: "f-period-1", gender: "female", category: "Period & Historical", description: "a Victorian-era corseted gown with a bustle" },
  { id: "f-period-2", gender: "female", category: "Period & Historical", description: "a 1920s flapper dress with fringe, a beaded headband" },
  { id: "f-period-3", gender: "female", category: "Period & Historical", description: "a 1950s-style swing dress with a fitted waist" },
  { id: "f-period-4", gender: "female", category: "Period & Historical", description: "a medieval-style gown with long flowing sleeves" },
  // -- Female: uniform/occupational --
  { id: "f-uniform-1", gender: "female", category: "Uniform & Occupational", description: "a chef's white double-breasted jacket and checkered trousers" },
  { id: "f-uniform-2", gender: "female", category: "Uniform & Occupational", description: "a flight attendant's fitted uniform with a scarf" },
  { id: "f-uniform-3", gender: "female", category: "Uniform & Occupational", description: "soft blue medical scrubs, comfortable sneakers" },
  { id: "f-uniform-4", gender: "female", category: "Uniform & Occupational", description: "a tailored, correctly-detailed police uniform" },
  // -- Female: loungewear/streetwear --
  { id: "f-lounge-1", gender: "female", category: "Loungewear", description: "a matching soft knit loungewear set, fuzzy socks" },
  { id: "f-lounge-2", gender: "female", category: "Loungewear", description: "an oversized t-shirt worn as a nightshirt, bare legs" },
  { id: "f-street-1", gender: "female", category: "Streetwear", description: "an oversized denim jacket over a crop top, high-waisted jeans, chunky sneakers" },
  { id: "f-street-2", gender: "female", category: "Streetwear", description: "a cropped puffer vest, bike shorts, platform sneakers" },
  { id: "f-street-3", gender: "female", category: "Streetwear", description: "a matching pastel tracksuit set, white sneakers" },
  { id: "f-formal-5", gender: "female", category: "Business & Formal", description: "a graduation gown and cap" },

  // -- Kids --
  { id: "k-1", gender: "kids", category: "Casual", description: "a bright striped t-shirt, denim shorts, light-up sneakers" },
  { id: "k-2", gender: "kids", category: "Casual", description: "a colorful tutu skirt over leggings, a sparkly t-shirt" },
  { id: "k-3", gender: "kids", category: "Casual", description: "overalls over a striped long-sleeve shirt, sneakers" },
  { id: "k-4", gender: "kids", category: "School", description: "a school uniform: polo shirt, pleated skirt, knee-high socks, mary jane shoes" },
  { id: "k-5", gender: "kids", category: "School", description: "a school uniform: button-down shirt, tie, grey shorts, knee socks" },
  { id: "k-6", gender: "kids", category: "Baby & Toddler", description: "a soft cotton onesie with an animal print" },
  { id: "k-7", gender: "kids", category: "Outdoor", description: "a bright blue puffer snowsuit, mittens, a beanie" },
  { id: "k-8", gender: "kids", category: "Outdoor", description: "swim trunks with a cartoon print, a rash guard" },
  { id: "k-9", gender: "kids", category: "Outdoor", description: "a one-piece swimsuit with a ruffle trim" },
  { id: "k-10", gender: "kids", category: "Sports", description: "a soccer uniform: jersey, shorts, shin guards, cleats" },
  { id: "k-11", gender: "kids", category: "Play", description: "a superhero costume with a cape" },
  { id: "k-12", gender: "kids", category: "Play", description: "a princess dress with a tulle skirt" },
  { id: "k-13", gender: "kids", category: "Loungewear", description: "pajamas with a dinosaur print" },
  { id: "k-14", gender: "kids", category: "Casual", description: "a hoodie and joggers set in a bold color" },
  { id: "k-15", gender: "kids", category: "Fall/Autumn", description: "a corduroy overall dress over a turtleneck" },
  { id: "k-16", gender: "kids", category: "Fall/Autumn", description: "a flannel shirt and jeans, small work boots" },
  { id: "k-17", gender: "kids", category: "Activities", description: "a ballet leotard, tights, and small ballet flats" },
  { id: "k-18", gender: "kids", category: "Activities", description: "a martial arts gi with a colored belt" },
  { id: "k-19", gender: "kids", category: "Outdoor", description: "a yellow rain jacket with matching rain boots" },
  { id: "k-20", gender: "kids", category: "Party", description: "a bright patterned party dress with a bow" },
  { id: "k-21", gender: "kids", category: "Party", description: "a button-down shirt with suspenders and a bow tie" },
  { id: "k-22", gender: "kids", category: "Party", description: "a small dinosaur Halloween costume" },
  { id: "k-23", gender: "kids", category: "School", description: "a backpack and a simple graphic tee for the first day of school" },
];

export function wardrobeById(id: string): WardrobeItem | undefined {
  return WARDROBE_LIBRARY.find((item) => item.id === id);
}

export function wardrobeByGender(gender: WardrobeGender): WardrobeItem[] {
  return WARDROBE_LIBRARY.filter((item) => item.gender === gender);
}

// ============================================================================
// Locations (35+ entries)
// ============================================================================
export type LocationEntry = { id: string; label: string; description: string; keywords: RegExp };

export const LOCATION_LIBRARY: LocationEntry[] = [
  { id: "city-street", label: "City Street", description: "a bustling city street at rush hour, pedestrians and traffic in constant motion, tall buildings framing the sky", keywords: /city street|downtown street|busy street/ },
  { id: "beach", label: "Coastal Beach", description: "a quiet coastal beach at low tide, gentle waves, seabirds overhead, soft sand underfoot", keywords: /\bbeach\b|\bshoreline\b|\bseaside\b/ },
  { id: "forest", label: "Forest", description: "a dense pine forest with dappled light filtering through the canopy, moss underfoot", keywords: /\bforest\b|\bwoods\b/ },
  { id: "rooftop-bar", label: "Rooftop Bar", description: "a rooftop bar at dusk overlooking a lit city skyline, string lights overhead", keywords: /rooftop bar|rooftop terrace/ },
  { id: "coffee-shop", label: "Coffee Shop", description: "a cozy coffee shop with exposed brick walls, warm pendant lighting, the hum of quiet conversation", keywords: /coffee shop|cafe\b|caf[ée]/ },
  { id: "modern-apartment", label: "Modern Apartment", description: "a modern minimalist apartment interior, clean lines, large windows, neutral tones", keywords: /modern apartment|minimalist apartment/ },
  { id: "farmhouse-kitchen", label: "Farmhouse Kitchen", description: "a rustic farmhouse kitchen, worn wooden countertops, hanging copper pots, warm natural light", keywords: /farmhouse kitchen|rustic kitchen/ },
  { id: "arcade", label: "Arcade", description: "a neon-lit arcade, rows of glowing game cabinets, ambient electronic chatter", keywords: /\barcade\b/ },
  { id: "art-gallery", label: "Art Gallery", description: "a minimalist art gallery with white walls, track lighting, polished concrete floors", keywords: /art gallery|museum gallery/ },
  { id: "lecture-hall", label: "University Lecture Hall", description: "a tiered university lecture hall, rows of wooden desks, chalkboard at the front", keywords: /lecture hall|university classroom/ },
  { id: "hospital-corridor", label: "Hospital Corridor", description: "a sterile hospital corridor, fluorescent overhead lighting, muted institutional colors", keywords: /hospital corridor|hospital hallway/ },
  { id: "courtroom", label: "Courtroom", description: "a formal wood-paneled courtroom, rows of gallery seating, the judge's bench elevated at the front", keywords: /\bcourtroom\b/ },
  { id: "desert-highway", label: "Desert Highway", description: "a straight desert highway stretching to the horizon at dusk, heat shimmer, sparse scrubland either side", keywords: /desert highway|desert road/ },
  { id: "mountain-cabin", label: "Snow-Covered Mountain Cabin", description: "a snow-covered wooden cabin nestled in the mountains, smoke rising from the chimney", keywords: /mountain cabin|ski cabin|snow cabin/ },
  { id: "rainforest", label: "Tropical Rainforest", description: "a dense tropical rainforest, thick humid air, layered green canopy, distant birdcalls", keywords: /rainforest|jungle/ },
  { id: "subway-platform", label: "Subway Platform", description: "an underground subway platform, fluorescent lighting, tiled walls, the distant rumble of an approaching train", keywords: /subway platform|metro platform|train platform/ },
  { id: "rooftop-garden", label: "Rooftop Garden", description: "a lush rooftop garden with potted greenery, string lights, city skyline beyond", keywords: /rooftop garden/ },
  { id: "vintage-diner", label: "Vintage Diner", description: "a retro American diner with red vinyl booths, checkered floor, neon signage", keywords: /vintage diner|retro diner|classic diner/ },
  { id: "open-office", label: "Modern Open-Plan Office", description: "a modern open-plan office, rows of desks, glass meeting rooms, natural light through floor-to-ceiling windows", keywords: /open-plan office|modern office/ },
  { id: "backstage-theater", label: "Backstage Theater", description: "a backstage theater area, exposed brick, costume racks, string lights around dressing mirrors", keywords: /backstage|theater wings/ },
  { id: "farmers-market", label: "Farmers Market", description: "an outdoor farmers market, colorful produce stalls, striped awnings, a lively crowd", keywords: /farmers market|outdoor market/ },
  { id: "library", label: "Library Reading Room", description: "a quiet library reading room, tall wooden bookshelves, soft reading-lamp light", keywords: /\blibrary\b/ },
  { id: "boxing-gym", label: "Boxing Gym", description: "a gritty boxing gym, hanging heavy bags, worn boxing ring, harsh overhead lighting", keywords: /boxing gym|boxing ring/ },
  { id: "record-store", label: "Record Store", description: "a cluttered vinyl record store, crates of records, warm dim lighting", keywords: /record store|record shop/ },
  { id: "greenhouse", label: "Greenhouse", description: "a glass greenhouse full of lush plants, humid diffused light through the panes", keywords: /greenhouse/ },
  { id: "night-market", label: "Night Market", description: "a bustling night market strung with warm string lights, street food stalls, a dense crowd", keywords: /night market/ },
  { id: "lighthouse", label: "Lighthouse on a Cliff", description: "a white lighthouse perched on a windswept cliff overlooking the sea", keywords: /lighthouse/ },
  { id: "abandoned-warehouse", label: "Abandoned Warehouse", description: "an abandoned industrial warehouse, broken windows, shafts of dusty light through the gaps", keywords: /abandoned warehouse|derelict warehouse/ },
  { id: "vineyard", label: "Vineyard", description: "rolling vineyard rows at golden hour, warm light raking across the vines", keywords: /\bvineyard\b/ },
  { id: "ski-lodge", label: "Ski Resort Lodge", description: "a cozy ski lodge interior, a roaring stone fireplace, snow visible through tall windows", keywords: /ski lodge|ski resort/ },
  { id: "back-alley", label: "Back Alley", description: "a narrow back alley, brick walls, fire escapes overhead, scattered puddles reflecting neon", keywords: /\balley\b|\balleyway\b/ },
  { id: "airport-terminal", label: "Airport Terminal", description: "a bright, high-ceilinged airport terminal, rows of seating, departure boards overhead", keywords: /airport terminal|departure lounge/ },
  { id: "gym-interior", label: "Gym Interior", description: "a modern gym interior, rows of equipment, mirrored walls, energetic overhead lighting", keywords: /\bgym\b(?! ing)/ },
  { id: "wedding-venue", label: "Wedding Venue", description: "an elegant wedding venue, rows of white chairs, floral archway, soft golden light", keywords: /wedding venue|wedding aisle/ },
  { id: "castle-interior", label: "Castle Interior", description: "a grand stone castle interior, high vaulted ceilings, tapestries, flickering torchlight", keywords: /castle interior|castle hall/ },
  { id: "spaceship-interior", label: "Spaceship Interior", description: "a sleek spaceship interior, glowing control panels, cool ambient lighting, a viewport showing stars", keywords: /spaceship interior|starship interior|space station interior/ },
];

export function detectLocation(prompt: string): LocationEntry | null {
  const text = prompt.toLowerCase();
  for (const loc of LOCATION_LIBRARY) {
    if (loc.keywords.test(text)) return loc;
  }
  return null;
}

// ============================================================================
// Character archetypes (100+ entries: male, female, kids, animals)
// ============================================================================
export type CharacterCategory = "male" | "female" | "kids" | "animal";
export type CharacterArchetype = { id: string; category: CharacterCategory; description: string };

export const CHARACTER_LIBRARY: CharacterArchetype[] = [
  // -- Male adults --
  { id: "ma-1", category: "male", description: "a weathered fisherman in his 60s, salt-and-pepper beard, sun-worn skin" },
  { id: "ma-2", category: "male", description: "a young tech entrepreneur in his late 20s, clean-shaven, sharp haircut" },
  { id: "ma-3", category: "male", description: "a construction worker in his 40s, broad build, calloused hands" },
  { id: "ma-4", category: "male", description: "an elderly professor in his 70s, silver hair, wire-rimmed glasses" },
  { id: "ma-5", category: "male", description: "a professional athlete in his prime, muscular build, short cropped hair" },
  { id: "ma-6", category: "male", description: "a jazz musician in his 50s, salt-and-pepper goatee, relaxed posture" },
  { id: "ma-7", category: "male", description: "a corporate executive in his 40s, clean-cut, confident bearing" },
  { id: "ma-8", category: "male", description: "a chef in his 30s, forearms dusted with flour, focused expression" },
  { id: "ma-9", category: "male", description: "a surfer in his 20s, sun-bleached hair, deep tan" },
  { id: "ma-10", category: "male", description: "a firefighter in his 30s, strong build, short practical haircut" },
  { id: "ma-11", category: "male", description: "a grandfather in his 80s, kind wrinkled face, gentle eyes" },
  { id: "ma-12", category: "male", description: "a punk rock musician in his 20s, visible tattoos, dyed hair" },
  { id: "ma-13", category: "male", description: "a farmer in his 50s, sun-weathered face, sturdy build" },
  { id: "ma-14", category: "male", description: "a doctor in his 40s, composed demeanor, neatly groomed" },
  { id: "ma-15", category: "male", description: "a skateboarder in his late teens, lean build, messy hair" },
  { id: "ma-16", category: "male", description: "a military veteran in his 30s, disciplined posture, short buzz cut" },
  { id: "ma-17", category: "male", description: "a barista in his 20s, friendly expression, casual style" },
  { id: "ma-18", category: "male", description: "a lawyer in his 50s, sharp features, greying temples" },
  { id: "ma-19", category: "male", description: "a mechanic in his 30s, grease-stained hands, practical build" },
  { id: "ma-20", category: "male", description: "a monk in his 60s, shaved head, serene expression" },
  { id: "ma-21", category: "male", description: "a rapper in his 20s, confident stance, gold jewelry" },
  { id: "ma-22", category: "male", description: "a cowboy in his 40s, sun-creased face, weathered hat" },
  { id: "ma-23", category: "male", description: "a scientist in his 50s, thoughtful expression, lab coat" },
  { id: "ma-24", category: "male", description: "a boxer in his 20s, muscular build, focused intensity" },
  { id: "ma-25", category: "male", description: "a Wall Street trader in his 30s, sharp suit, alert eyes" },
  { id: "ma-26", category: "male", description: "a street artist in his 20s, paint-stained hands, creative energy" },
  { id: "ma-27", category: "male", description: "a park ranger in his 40s, weathered outdoorsy look" },
  { id: "ma-28", category: "male", description: "a violinist in his 60s, elegant bearing, refined hands" },
  { id: "ma-29", category: "male", description: "a personal trainer in his 30s, athletic build, energetic posture" },
  { id: "ma-30", category: "male", description: "a librarian in his 50s, quiet demeanor, reading glasses" },
  { id: "ma-31", category: "male", description: "a pilot in his 40s, disciplined confident bearing" },
  { id: "ma-32", category: "male", description: "a street food vendor in his 50s, sun-weathered, warm smile" },

  // -- Female adults --
  { id: "fa-1", category: "female", description: "a ballet dancer in her 20s, poised posture, elegant neck" },
  { id: "fa-2", category: "female", description: "a grandmother in her 70s, warm wrinkled smile, silver hair in a bun" },
  { id: "fa-3", category: "female", description: "a startup founder in her 30s, confident energy, sharp eyes" },
  { id: "fa-4", category: "female", description: "a nurse in her 40s, compassionate expression, practical demeanor" },
  { id: "fa-5", category: "female", description: "a fashion designer in her 30s, striking style, creative flair" },
  { id: "fa-6", category: "female", description: "a marathon runner in her 20s, lean athletic build, focused gaze" },
  { id: "fa-7", category: "female", description: "a jazz singer in her 50s, sultry confident presence" },
  { id: "fa-8", category: "female", description: "a schoolteacher in her 30s, warm approachable expression" },
  { id: "fa-9", category: "female", description: "a scientist in her 40s, thoughtful sharp eyes, practical style" },
  { id: "fa-10", category: "female", description: "a surfer in her 20s, sun-kissed skin, salt-tousled hair" },
  { id: "fa-11", category: "female", description: "a chef in her 30s, focused expression, forearms dusted with flour" },
  { id: "fa-12", category: "female", description: "a grandmother figure in her 80s, gentle wise eyes" },
  { id: "fa-13", category: "female", description: "a yoga instructor in her 30s, calm centered presence" },
  { id: "fa-14", category: "female", description: "a lawyer in her 40s, sharp composed demeanor" },
  { id: "fa-15", category: "female", description: "a painter in her 20s, paint-flecked hands, creative energy" },
  { id: "fa-16", category: "female", description: "a farmer in her 50s, sun-weathered practical build" },
  { id: "fa-17", category: "female", description: "a musician in her 20s, artistic style, expressive eyes" },
  { id: "fa-18", category: "female", description: "a CEO in her 40s, commanding confident presence" },
  { id: "fa-19", category: "female", description: "a florist in her 30s, gentle warm demeanor, earthy style" },
  { id: "fa-20", category: "female", description: "a firefighter in her 30s, strong capable build" },
  { id: "fa-21", category: "female", description: "a poet in her 60s, thoughtful weathered face, kind eyes" },
  { id: "fa-22", category: "female", description: "a gymnast in her teens, lean athletic build, focused intensity" },
  { id: "fa-23", category: "female", description: "an astronaut in her 40s, disciplined composed bearing" },
  { id: "fa-24", category: "female", description: "a jewelry maker in her 30s, delicate precise hands" },
  { id: "fa-25", category: "female", description: "a professor in her 50s, sharp intellectual presence" },
  { id: "fa-26", category: "female", description: "a dancer in her 20s, graceful fluid movement" },
  { id: "fa-27", category: "female", description: "a veterinarian in her 30s, gentle caring demeanor" },
  { id: "fa-28", category: "female", description: "a photographer in her 20s, observant curious eyes" },
  { id: "fa-29", category: "female", description: "a barista in her 20s, friendly approachable energy" },
  { id: "fa-30", category: "female", description: "a monastic figure in her 60s, serene composed presence" },
  { id: "fa-31", category: "female", description: "a pilot in her 40s, disciplined confident bearing" },
  { id: "fa-32", category: "female", description: "a street food vendor in her 50s, sun-weathered, warm smile" },

  // -- Kids --
  { id: "k-1", category: "kids", description: "a curious boy around 7, gap-toothed grin, messy hair" },
  { id: "k-2", category: "kids", description: "a shy girl around 5, wide innocent eyes, pigtails" },
  { id: "k-3", category: "kids", description: "an energetic boy around 10, freckled face, missing front tooth" },
  { id: "k-4", category: "kids", description: "a thoughtful girl around 9, glasses, braided hair" },
  { id: "k-5", category: "kids", description: "a toddler boy around 2, chubby cheeks, unsteady walk" },
  { id: "k-6", category: "kids", description: "a toddler girl around 3, curly hair, wide curious eyes" },
  { id: "k-7", category: "kids", description: "a mischievous boy around 8, gap-toothed smile, scraped knee" },
  { id: "k-8", category: "kids", description: "a bookish girl around 11, glasses, thoughtful expression" },
  { id: "k-9", category: "kids", description: "an athletic boy around 12, focused determined expression" },
  { id: "k-10", category: "kids", description: "a dreamy girl around 6, wide-eyed wonder, wispy hair" },
  { id: "k-11", category: "kids", description: "twin boys around 6, identical mischievous grins" },
  { id: "k-12", category: "kids", description: "twin girls around 7, matching braids" },
  { id: "k-13", category: "kids", description: "a preteen boy around 13, awkward growing-up phase, earnest expression" },
  { id: "k-14", category: "kids", description: "a preteen girl around 13, self-conscious but bright smile" },
  { id: "k-15", category: "kids", description: "an infant around 6 months, wide innocent eyes" },
  { id: "k-16", category: "kids", description: "a boy around 9 with a gap-toothed smile and a backpack" },
  { id: "k-17", category: "kids", description: "a girl around 8 in a tutu, joyful expression" },
  { id: "k-18", category: "kids", description: "a boy around 5 with a superhero cape, determined stance" },
  { id: "k-19", category: "kids", description: "a girl around 10 with a skateboard, confident grin" },
  { id: "k-20", category: "kids", description: "a boy around 7 with a missing tooth, holding a toy dinosaur" },

  // -- Animals --
  { id: "an-1", category: "animal", description: "a golden retriever puppy, floppy ears, playful energy" },
  { id: "an-2", category: "animal", description: "a sleek black cat, alert green eyes, graceful movement" },
  { id: "an-3", category: "animal", description: "a wise old elephant, deeply creased skin, gentle eyes" },
  { id: "an-4", category: "animal", description: "a majestic horse, glossy coat, flowing mane" },
  { id: "an-5", category: "animal", description: "a curious fox, russet fur, alert pointed ears" },
  { id: "an-6", category: "animal", description: "a fluffy white rabbit, twitching nose, soft fur" },
  { id: "an-7", category: "animal", description: "a regal lion, thick golden mane, powerful build" },
  { id: "an-8", category: "animal", description: "a playful otter, sleek wet fur, mischievous eyes" },
  { id: "an-9", category: "animal", description: "a wise owl, large amber eyes, mottled brown feathers" },
  { id: "an-10", category: "animal", description: "a small brown sparrow, quick nervous movements" },
  { id: "an-11", category: "animal", description: "a graceful deer, large dark eyes, alert stance" },
  { id: "an-12", category: "animal", description: "a fluffy corgi, short legs, big expressive ears" },
  { id: "an-13", category: "animal", description: "a sleek greyhound, lean muscular build, alert gaze" },
  { id: "an-14", category: "animal", description: "a chubby hamster, tiny paws, twitching whiskers" },
  { id: "an-15", category: "animal", description: "a colorful parrot, vivid feathers, intelligent eyes" },
  { id: "an-16", category: "animal", description: "a gentle cow, soft brown eyes, slow deliberate movement" },
  { id: "an-17", category: "animal", description: "a fluffy sheep, thick woolly coat, calm demeanor" },
  { id: "an-18", category: "animal", description: "a proud rooster, vibrant plumage, confident strut" },
  { id: "an-19", category: "animal", description: "a small piglet, pink skin, curious snout" },
  { id: "an-20", category: "animal", description: "a sleek dolphin, smooth grey skin, playful energy" },
  { id: "an-21", category: "animal", description: "a wise old tortoise, weathered shell, slow deliberate gaze" },
  { id: "an-22", category: "animal", description: "a fluffy husky, piercing blue eyes, thick coat" },
  { id: "an-23", category: "animal", description: "a graceful swan, pure white feathers, elegant neck" },
  { id: "an-24", category: "animal", description: "a curious raccoon, masked face, dexterous paws" },
  { id: "an-25", category: "animal", description: "a playful dolphin calf, smooth skin, energetic movement" },
];

export function charactersByCategory(category: CharacterCategory): CharacterArchetype[] {
  return CHARACTER_LIBRARY.filter((c) => c.category === category);
}

export function characterById(id: string): CharacterArchetype | undefined {
  return CHARACTER_LIBRARY.find((c) => c.id === id);
}

// ============================================================================
// Objects / props (200+ entries across 19 categories)
// ============================================================================
export type SceneObject = { id: string; category: string; label: string };

export const OBJECT_LIBRARY: SceneObject[] = [
  // -- Tech --
  { id: "obj-smartphone", category: "Tech", label: "smartphone, screen lit, held naturally" },
  { id: "obj-laptop", category: "Tech", label: "open laptop, glowing screen" },
  { id: "obj-vintage-camera", category: "Tech", label: "vintage film camera with a leather strap" },
  { id: "obj-headphones", category: "Tech", label: "over-ear headphones" },
  { id: "obj-vinyl-player", category: "Tech", label: "vinyl record player, needle resting on a spinning record" },
  { id: "obj-tablet", category: "Tech", label: "tablet device, propped upright" },
  { id: "obj-drone", category: "Tech", label: "small consumer drone, propellers blurred" },
  { id: "obj-smartwatch", category: "Tech", label: "smartwatch on a wrist, screen lit" },
  { id: "obj-retro-tv", category: "Tech", label: "boxy retro television, static on the screen" },
  { id: "obj-rotary-phone", category: "Tech", label: "vintage rotary telephone" },
  { id: "obj-typewriter", category: "Tech", label: "manual typewriter with a sheet of paper loaded" },
  { id: "obj-controller", category: "Tech", label: "video game controller" },
  { id: "obj-vr-headset", category: "Tech", label: "VR headset" },
  { id: "obj-film-camera", category: "Tech", label: "35mm film camera with visible dials" },

  // -- Food & Drink --
  { id: "obj-coffee", category: "Food & Drink", label: "steaming cup of coffee" },
  { id: "obj-wine", category: "Food & Drink", label: "glass of red wine" },
  { id: "obj-bread", category: "Food & Drink", label: "fresh baked loaf of bread" },
  { id: "obj-fruit-bowl", category: "Food & Drink", label: "bowl of fresh fruit" },
  { id: "obj-birthday-cake", category: "Food & Drink", label: "birthday cake with lit candles" },
  { id: "obj-tea", category: "Food & Drink", label: "cup of tea, steam rising" },
  { id: "obj-pasta", category: "Food & Drink", label: "plate of fresh pasta" },
  { id: "obj-ice-cream", category: "Food & Drink", label: "ice cream cone, starting to melt" },
  { id: "obj-champagne", category: "Food & Drink", label: "champagne flute, bubbles rising" },
  { id: "obj-croissant", category: "Food & Drink", label: "fresh flaky croissant" },
  { id: "obj-ramen", category: "Food & Drink", label: "steaming bowl of ramen" },
  { id: "obj-pancakes", category: "Food & Drink", label: "stack of pancakes with syrup" },
  { id: "obj-orange-juice", category: "Food & Drink", label: "glass of fresh orange juice" },
  { id: "obj-cocktail", category: "Food & Drink", label: "cocktail glass, garnished" },
  { id: "obj-honey", category: "Food & Drink", label: "jar of honey with a wooden dipper" },

  // -- Furniture --
  { id: "obj-armchair", category: "Furniture", label: "worn leather armchair" },
  { id: "obj-rocking-chair", category: "Furniture", label: "wooden rocking chair" },
  { id: "obj-writing-desk", category: "Furniture", label: "antique wooden writing desk" },
  { id: "obj-four-poster-bed", category: "Furniture", label: "four-poster bed with draped linens" },
  { id: "obj-velvet-sofa", category: "Furniture", label: "velvet sofa" },
  { id: "obj-bookshelf", category: "Furniture", label: "tall wooden bookshelf, densely packed" },
  { id: "obj-dining-table", category: "Furniture", label: "long wooden dining table" },
  { id: "obj-vanity-mirror", category: "Furniture", label: "vanity mirror ringed with bulbs" },
  { id: "obj-chaise-lounge", category: "Furniture", label: "chaise lounge" },
  { id: "obj-rustic-bench", category: "Furniture", label: "weathered rustic wooden bench" },
  { id: "obj-grand-piano", category: "Furniture", label: "grand piano, lid raised" },
  { id: "obj-hammock", category: "Furniture", label: "woven hammock strung between two posts" },

  // -- Nature & Plants --
  { id: "obj-roses", category: "Nature & Plants", label: "bouquet of fresh roses" },
  { id: "obj-succulent", category: "Nature & Plants", label: "potted succulent" },
  { id: "obj-wildflowers", category: "Nature & Plants", label: "field of wildflowers" },
  { id: "obj-autumn-leaves", category: "Nature & Plants", label: "scattered autumn leaves" },
  { id: "obj-pine-branch", category: "Nature & Plants", label: "fresh pine branch" },
  { id: "obj-cherry-blossoms", category: "Nature & Plants", label: "cherry blossom branch in bloom" },
  { id: "obj-sunflower", category: "Nature & Plants", label: "tall sunflower" },
  { id: "obj-cactus", category: "Nature & Plants", label: "potted cactus" },
  { id: "obj-fern", category: "Nature & Plants", label: "lush green fern" },
  { id: "obj-ivy", category: "Nature & Plants", label: "ivy climbing a stone wall" },
  { id: "obj-bamboo", category: "Nature & Plants", label: "cluster of tall bamboo stalks" },
  { id: "obj-lavender", category: "Nature & Plants", label: "bundle of dried lavender" },
  { id: "obj-orchid", category: "Nature & Plants", label: "potted orchid in bloom" },
  { id: "obj-maple-leaf", category: "Nature & Plants", label: "single red maple leaf" },

  // -- Vehicles --
  { id: "obj-motorcycle", category: "Vehicles", label: "vintage motorcycle" },
  { id: "obj-convertible", category: "Vehicles", label: "classic convertible car, top down" },
  { id: "obj-bicycle", category: "Vehicles", label: "bicycle leaning against a wall" },
  { id: "obj-skateboard", category: "Vehicles", label: "skateboard" },
  { id: "obj-sailboat", category: "Vehicles", label: "sailboat with white sails" },
  { id: "obj-canoe", category: "Vehicles", label: "wooden canoe on calm water" },
  { id: "obj-hot-air-balloon", category: "Vehicles", label: "hot air balloon aloft" },
  { id: "obj-vintage-bus", category: "Vehicles", label: "vintage bus" },
  { id: "obj-scooter", category: "Vehicles", label: "vespa-style scooter" },
  { id: "obj-pickup-truck", category: "Vehicles", label: "weathered pickup truck" },
  { id: "obj-train-carriage", category: "Vehicles", label: "train carriage interior" },
  { id: "obj-small-airplane", category: "Vehicles", label: "small propeller airplane" },

  // -- Tools --
  { id: "obj-hammer", category: "Tools", label: "hammer" },
  { id: "obj-wrench", category: "Tools", label: "wrench" },
  { id: "obj-paintbrush", category: "Tools", label: "paintbrush, bristles loaded with paint" },
  { id: "obj-sewing-kit", category: "Tools", label: "sewing kit, needle and thread" },
  { id: "obj-toolbox", category: "Tools", label: "open metal toolbox" },
  { id: "obj-garden-shears", category: "Tools", label: "garden shears" },
  { id: "obj-drill", category: "Tools", label: "power drill" },
  { id: "obj-measuring-tape", category: "Tools", label: "measuring tape" },
  { id: "obj-screwdriver-set", category: "Tools", label: "set of screwdrivers" },
  { id: "obj-ladder", category: "Tools", label: "wooden step ladder" },

  // -- Accessories & Jewelry --
  { id: "obj-pearl-necklace", category: "Accessories & Jewelry", label: "pearl necklace" },
  { id: "obj-leather-watch", category: "Accessories & Jewelry", label: "leather wristwatch" },
  { id: "obj-sunglasses", category: "Accessories & Jewelry", label: "sunglasses" },
  { id: "obj-silk-scarf", category: "Accessories & Jewelry", label: "silk scarf" },
  { id: "obj-gold-ring", category: "Accessories & Jewelry", label: "gold ring" },
  { id: "obj-beaded-bracelet", category: "Accessories & Jewelry", label: "beaded bracelet" },
  { id: "obj-wide-brim-hat", category: "Accessories & Jewelry", label: "wide-brimmed hat" },
  { id: "obj-leather-gloves", category: "Accessories & Jewelry", label: "leather gloves" },
  { id: "obj-pocket-watch", category: "Accessories & Jewelry", label: "pocket watch on a chain" },
  { id: "obj-diamond-earrings", category: "Accessories & Jewelry", label: "diamond earrings" },
  { id: "obj-tote-bag", category: "Accessories & Jewelry", label: "canvas tote bag" },
  { id: "obj-leather-wallet", category: "Accessories & Jewelry", label: "worn leather wallet" },
  { id: "obj-brooch", category: "Accessories & Jewelry", label: "vintage brooch" },
  { id: "obj-cufflinks", category: "Accessories & Jewelry", label: "a pair of cufflinks" },

  // -- Stationery & Books --
  { id: "obj-journal", category: "Stationery & Books", label: "leather-bound journal" },
  { id: "obj-fountain-pen", category: "Stationery & Books", label: "fountain pen" },
  { id: "obj-old-books", category: "Stationery & Books", label: "stack of old books" },
  { id: "obj-map", category: "Stationery & Books", label: "unfolded paper map" },
  { id: "obj-wax-seal-letter", category: "Stationery & Books", label: "letter with a wax seal" },
  { id: "obj-chalkboard", category: "Stationery & Books", label: "chalkboard with handwriting" },
  { id: "obj-quill-inkwell", category: "Stationery & Books", label: "quill and inkwell" },
  { id: "obj-magnifying-glass", category: "Stationery & Books", label: "magnifying glass" },
  { id: "obj-globe", category: "Stationery & Books", label: "antique world globe" },
  { id: "obj-reading-glasses", category: "Stationery & Books", label: "a pair of reading glasses" },
  { id: "obj-newspaper", category: "Stationery & Books", label: "folded newspaper" },
  { id: "obj-postcard", category: "Stationery & Books", label: "vintage postcard" },

  // -- Music & Instruments --
  { id: "obj-acoustic-guitar", category: "Music", label: "acoustic guitar" },
  { id: "obj-violin", category: "Music", label: "violin and bow" },
  { id: "obj-saxophone", category: "Music", label: "brass saxophone" },
  { id: "obj-drum-set", category: "Music", label: "drum set" },
  { id: "obj-piano-keys", category: "Music", label: "piano keys, hands poised above" },
  { id: "obj-trumpet", category: "Music", label: "trumpet" },
  { id: "obj-ukulele", category: "Music", label: "ukulele" },
  { id: "obj-harmonica", category: "Music", label: "harmonica" },
  { id: "obj-cello", category: "Music", label: "cello" },
  { id: "obj-tambourine", category: "Music", label: "tambourine" },

  // -- Sports Equipment --
  { id: "obj-basketball", category: "Sports", label: "basketball" },
  { id: "obj-soccer-ball", category: "Sports", label: "soccer ball" },
  { id: "obj-tennis-racket", category: "Sports", label: "tennis racket" },
  { id: "obj-baseball-bat", category: "Sports", label: "baseball bat" },
  { id: "obj-yoga-mat", category: "Sports", label: "rolled yoga mat" },
  { id: "obj-boxing-gloves", category: "Sports", label: "boxing gloves" },
  { id: "obj-skis", category: "Sports", label: "pair of skis" },
  { id: "obj-surfboard", category: "Sports", label: "surfboard" },
  { id: "obj-golf-clubs", category: "Sports", label: "set of golf clubs" },
  { id: "obj-running-shoes", category: "Sports", label: "running shoes" },
  { id: "obj-dumbbells", category: "Sports", label: "pair of dumbbells" },
  { id: "obj-bike-helmet", category: "Sports", label: "bicycle helmet" },

  // -- Kitchenware --
  { id: "obj-cast-iron-skillet", category: "Kitchenware", label: "cast iron skillet" },
  { id: "obj-cutting-board", category: "Kitchenware", label: "wooden cutting board" },
  { id: "obj-copper-pots", category: "Kitchenware", label: "hanging copper pots" },
  { id: "obj-mixing-bowl", category: "Kitchenware", label: "ceramic mixing bowl" },
  { id: "obj-rolling-pin", category: "Kitchenware", label: "wooden rolling pin" },
  { id: "obj-chefs-knife", category: "Kitchenware", label: "chef's knife" },
  { id: "obj-teapot", category: "Kitchenware", label: "ceramic teapot" },
  { id: "obj-whisk", category: "Kitchenware", label: "wire whisk" },
  { id: "obj-mason-jars", category: "Kitchenware", label: "row of mason jars" },
  { id: "obj-cheese-board", category: "Kitchenware", label: "wooden cheese board, arranged" },
  { id: "obj-espresso-machine", category: "Kitchenware", label: "espresso machine, steam rising" },
  { id: "obj-mortar-pestle", category: "Kitchenware", label: "mortar and pestle" },

  // -- Toys --
  { id: "obj-teddy-bear", category: "Toys", label: "teddy bear" },
  { id: "obj-toy-train", category: "Toys", label: "wooden toy train" },
  { id: "obj-building-blocks", category: "Toys", label: "colorful building blocks" },
  { id: "obj-rocking-horse", category: "Toys", label: "wooden rocking horse" },
  { id: "obj-toy-dinosaur", category: "Toys", label: "toy dinosaur" },
  { id: "obj-kite", category: "Toys", label: "kite in flight" },
  { id: "obj-yoyo", category: "Toys", label: "yo-yo" },
  { id: "obj-jigsaw-puzzle", category: "Toys", label: "half-finished jigsaw puzzle" },
  { id: "obj-dollhouse", category: "Toys", label: "dollhouse" },
  { id: "obj-marbles", category: "Toys", label: "scattered marbles" },

  // -- Decor --
  { id: "obj-antique-mirror", category: "Decor", label: "antique ornate mirror" },
  { id: "obj-picture-frame", category: "Decor", label: "ornate picture frame" },
  { id: "obj-tapestry", category: "Decor", label: "woven wall tapestry" },
  { id: "obj-ceramic-vase", category: "Decor", label: "ceramic vase" },
  { id: "obj-string-lights", category: "Decor", label: "string lights" },
  { id: "obj-candle-brass", category: "Decor", label: "candle in a brass holder" },
  { id: "obj-decorative-rug", category: "Decor", label: "decorative patterned rug" },
  { id: "obj-wall-clock", category: "Decor", label: "wall clock" },
  { id: "obj-framed-painting", category: "Decor", label: "framed painting" },
  { id: "obj-incense", category: "Decor", label: "incense burner, smoke curling" },
  { id: "obj-lantern", category: "Decor", label: "hanging lantern" },
  { id: "obj-wind-chimes", category: "Decor", label: "wind chimes" },

  // -- Weather-Related Props --
  { id: "obj-umbrella", category: "Weather", label: "open umbrella" },
  { id: "obj-rain-boots", category: "Weather", label: "rain boots" },
  { id: "obj-winter-scarf", category: "Weather", label: "thick winter scarf" },
  { id: "obj-sun-hat", category: "Weather", label: "wide sun hat" },
  { id: "obj-beach-towel", category: "Weather", label: "striped beach towel" },
  { id: "obj-snow-globe", category: "Weather", label: "snow globe" },
  { id: "obj-picnic-blanket", category: "Weather", label: "checkered picnic blanket" },

  // -- Personal Items --
  { id: "obj-backpack", category: "Personal Items", label: "backpack" },
  { id: "obj-suitcase", category: "Personal Items", label: "vintage suitcase" },
  { id: "obj-keys", category: "Personal Items", label: "keys on a ring" },
  { id: "obj-handheld-mirror", category: "Personal Items", label: "handheld mirror" },
  { id: "obj-hairbrush", category: "Personal Items", label: "hairbrush" },
  { id: "obj-perfume-bottle", category: "Personal Items", label: "perfume bottle" },
  { id: "obj-phone-case", category: "Personal Items", label: "phone in a case" },

  // -- Celebration --
  { id: "obj-balloons", category: "Celebration", label: "cluster of birthday balloons" },
  { id: "obj-gift-box", category: "Celebration", label: "wrapped gift box with a bow" },
  { id: "obj-streamers", category: "Celebration", label: "party streamers" },
  { id: "obj-champagne-bottle", category: "Celebration", label: "champagne bottle, popped" },
  { id: "obj-confetti", category: "Celebration", label: "scattered confetti" },
  { id: "obj-graduation-cap", category: "Celebration", label: "graduation cap tossed in the air" },
  { id: "obj-wedding-ring", category: "Celebration", label: "wedding ring on a cushion" },
  { id: "obj-festive-banner", category: "Celebration", label: "festive hanging banner" },
  { id: "obj-fireworks", category: "Celebration", label: "fireworks bursting overhead" },

  // -- Office --
  { id: "obj-stapler", category: "Office", label: "stapler" },
  { id: "obj-desk-lamp", category: "Office", label: "desk lamp, lit" },
  { id: "obj-filing-cabinet", category: "Office", label: "metal filing cabinet" },
  { id: "obj-monitor", category: "Office", label: "computer monitor" },
  { id: "obj-whiteboard", category: "Office", label: "whiteboard covered in notes" },
  { id: "obj-corkboard", category: "Office", label: "corkboard pinned with notes" },
  { id: "obj-paper-stack", category: "Office", label: "stack of papers" },

  // -- Gardening --
  { id: "obj-watering-can", category: "Gardening", label: "watering can" },
  { id: "obj-garden-gloves", category: "Gardening", label: "gardening gloves" },
  { id: "obj-terracotta-pots", category: "Gardening", label: "terracotta plant pots" },
  { id: "obj-wheelbarrow", category: "Gardening", label: "wheelbarrow" },
  { id: "obj-trowel", category: "Gardening", label: "gardening trowel" },
  { id: "obj-seed-packets", category: "Gardening", label: "packets of seeds" },

  // -- Beauty --
  { id: "obj-makeup-brushes", category: "Beauty", label: "set of makeup brushes" },
  { id: "obj-lipstick", category: "Beauty", label: "lipstick" },
  { id: "obj-nail-polish", category: "Beauty", label: "bottle of nail polish" },
  { id: "obj-hand-mirror", category: "Beauty", label: "small handheld mirror" },

  // -- Travel --
  { id: "obj-passport", category: "Travel", label: "passport" },
  { id: "obj-boarding-pass", category: "Travel", label: "boarding pass" },
  { id: "obj-camera-strap", category: "Travel", label: "camera hanging from a neck strap" },
  { id: "obj-travel-journal", category: "Travel", label: "travel journal" },
  { id: "obj-binoculars", category: "Travel", label: "binoculars" },
  { id: "obj-compass", category: "Travel", label: "brass compass" },

  // -- Winter/Holiday --
  { id: "obj-christmas-lights", category: "Holiday", label: "twinkling holiday lights" },
  { id: "obj-ornament", category: "Holiday", label: "glass holiday ornament" },
  { id: "obj-menorah", category: "Holiday", label: "lit menorah" },
  { id: "obj-lantern-festival", category: "Holiday", label: "paper lantern, glowing" },
];

export function objectsByCategory(category: string): SceneObject[] {
  return OBJECT_LIBRARY.filter((o) => o.category === category);
}

export const OBJECT_CATEGORIES: string[] = Array.from(new Set(OBJECT_LIBRARY.map((o) => o.category)));

export function detectObjects(prompt: string): SceneObject[] {
  const text = prompt.toLowerCase();
  return OBJECT_LIBRARY.filter((obj) => {
    const key = obj.label.split(",")[0].trim().toLowerCase();
    return text.includes(key);
  });
}

// ============================================================================
// Cities (45+ entries) - real, concrete visual/atmospheric detail, not
// just a name, the same "concrete over vague" standard as everything else.
// ============================================================================
export type CityEntry = { id: string; label: string; description: string; keywords: RegExp };

export const CITY_LIBRARY: CityEntry[] = [
  { id: "tokyo", label: "Tokyo", description: "dense neon signage, narrow lantern-lit alleys, bullet trains, a mix of ultramodern towers and small shrines", keywords: /\btokyo\b/ },
  { id: "paris", label: "Paris", description: "cream Haussmann facades, wrought-iron balconies, wide tree-lined boulevards, warm café awnings", keywords: /\bparis\b/ },
  { id: "new-york", label: "New York City", description: "towering steel-and-glass skyscrapers, yellow cabs, steam rising from street vents, dense crowds", keywords: /new york|\bnyc\b|manhattan/ },
  { id: "london", label: "London", description: "red double-decker buses, Victorian brick terraces, grey overcast light, black cabs", keywords: /\blondon\b/ },
  { id: "rome", label: "Rome", description: "sun-bleached ochre buildings, ancient stone ruins beside modern life, narrow cobblestone streets", keywords: /\brome\b/ },
  { id: "venice", label: "Venice", description: "narrow canals, weathered pastel facades, gondolas, footbridges over still water", keywords: /\bvenice\b/ },
  { id: "santorini", label: "Santorini", description: "whitewashed cubic buildings, blue-domed roofs, cliffside views over the Aegean", keywords: /santorini/ },
  { id: "marrakech", label: "Marrakech", description: "terracotta-walled medina, bustling souks, ornate tiled courtyards, warm dusty light", keywords: /marrakech|marrakesh/ },
  { id: "rio", label: "Rio de Janeiro", description: "lush green mountains behind a curving beach, colorful hillside favelas, vibrant energy", keywords: /rio de janeiro|\brio\b/ },
  { id: "mexico-city", label: "Mexico City", description: "colorful colonial facades, wide plazas, dense murals, a mix of ancient and modern architecture", keywords: /mexico city/ },
  { id: "havana", label: "Havana", description: "pastel colonial buildings with peeling paint, vintage cars, warm humid light", keywords: /\bhavana\b/ },
  { id: "buenos-aires", label: "Buenos Aires", description: "European-style boulevards, ornate ironwork balconies, tango-hall energy", keywords: /buenos aires/ },
  { id: "cairo", label: "Cairo", description: "dusty golden light, ancient monuments beside dense modern sprawl, bustling markets", keywords: /\bcairo\b/ },
  { id: "cape-town", label: "Cape Town", description: "a dramatic mountain backdrop, colorful Bo-Kaap houses, coastal light", keywords: /cape town/ },
  { id: "nairobi", label: "Nairobi", description: "a green, hilly cityscape blending modern towers with open savanna at its edges", keywords: /nairobi/ },
  { id: "mumbai", label: "Mumbai", description: "dense colorful chaos, colonial architecture beside modern towers, vivid street markets", keywords: /\bmumbai\b/ },
  { id: "delhi", label: "New Delhi", description: "grand colonial-era boulevards, ornate Mughal architecture, dusty golden haze", keywords: /new delhi|\bdelhi\b/ },
  { id: "bangkok", label: "Bangkok", description: "gilded temple spires beside dense modern skyline, floating markets, warm humid haze", keywords: /bangkok/ },
  { id: "seoul", label: "Seoul", description: "sleek modern towers, dense neon-lit shopping districts, traditional palaces tucked between them", keywords: /\bseoul\b/ },
  { id: "beijing", label: "Beijing", description: "vast imperial architecture, wide modern boulevards, hazy grey-gold light", keywords: /\bbeijing\b/ },
  { id: "shanghai", label: "Shanghai", description: "a futuristic neon skyline along the river, art-deco buildings on the opposite bank", keywords: /\bshanghai\b/ },
  { id: "hong-kong", label: "Hong Kong", description: "dense vertical skyline, neon signage stacked over narrow streets, a busy harbor", keywords: /hong kong/ },
  { id: "singapore", label: "Singapore", description: "ultramodern architecture interwoven with lush greenery, humid tropical light", keywords: /singapore/ },
  { id: "istanbul", label: "Istanbul", description: "domed mosques and minarets on the skyline, narrow winding streets, the strait dividing two continents", keywords: /istanbul/ },
  { id: "dubai", label: "Dubai", description: "gleaming futuristic towers rising from the desert, wide modern boulevards, harsh bright light", keywords: /\bdubai\b/ },
  { id: "amsterdam", label: "Amsterdam", description: "narrow canal-side townhouses, bicycles everywhere, soft overcast northern light", keywords: /amsterdam/ },
  { id: "berlin", label: "Berlin", description: "a mix of stark modern architecture and preserved historic facades, broad grey streets", keywords: /\bberlin\b/ },
  { id: "barcelona", label: "Barcelona", description: "ornate Gaudí architecture, wide tree-lined boulevards, warm Mediterranean light", keywords: /barcelona/ },
  { id: "lisbon", label: "Lisbon", description: "pastel hillside buildings, narrow tiled streets, warm golden coastal light", keywords: /\blisbon\b/ },
  { id: "reykjavik", label: "Reykjavik", description: "low colorful buildings under vast open sky, crisp cold northern light", keywords: /reykjavik/ },
  { id: "sydney", label: "Sydney", description: "a sweeping harbor with the opera house's white sails, bright coastal light", keywords: /\bsydney\b/ },
  { id: "melbourne", label: "Melbourne", description: "laneway street art, tram lines through a modern-Victorian mix of architecture", keywords: /melbourne/ },
  { id: "auckland", label: "Auckland", description: "a harbor city framed by volcanic hills, bright clean coastal light", keywords: /auckland/ },
  { id: "toronto", label: "Toronto", description: "a dense modern skyline beside a lakefront, distinct multicultural neighborhoods", keywords: /toronto/ },
  { id: "san-francisco", label: "San Francisco", description: "steep hills, colorful Victorian houses, fog rolling over the bay", keywords: /san francisco/ },
  { id: "los-angeles", label: "Los Angeles", description: "sprawling low-rise city under bright hazy sun, palm-lined boulevards", keywords: /los angeles|\bla\b(?! street)/ },
  { id: "chicago", label: "Chicago", description: "a dense skyline of early skyscrapers along the lakefront, cold sharp light", keywords: /\bchicago\b/ },
  { id: "moscow", label: "Moscow", description: "onion-domed cathedrals beside vast Soviet-era architecture, cold grey light", keywords: /\bmoscow\b/ },
  { id: "prague", label: "Prague", description: "Gothic spires and red-tiled roofs over a medieval old town, cobblestone streets", keywords: /\bprague\b/ },
  { id: "vienna", label: "Vienna", description: "grand imperial architecture, wide elegant boulevards, refined old-world atmosphere", keywords: /\bvienna\b/ },
  { id: "athens", label: "Athens", description: "ancient ruins on a hilltop overlooking a dense modern white-washed city", keywords: /\bathens\b/ },
  { id: "kyoto", label: "Kyoto", description: "traditional wooden machiya houses, bamboo groves, quiet temple gardens", keywords: /\bkyoto\b/ },
  { id: "havana-2", label: "Havana Old Town", description: "crumbling colonial grandeur, vintage cars parked along narrow streets", keywords: /old havana/ },
  { id: "st-petersburg", label: "St. Petersburg", description: "grand pastel palaces along a wide river, ornate bridges, pale northern light", keywords: /st\.? petersburg|saint petersburg/ },
  { id: "warsaw", label: "Warsaw", description: "a rebuilt old town beside sharp modern towers, wide open squares", keywords: /\bwarsaw\b/ },
  { id: "casablanca", label: "Casablanca", description: "white coastal architecture, a mix of colonial and Moorish design, ocean haze", keywords: /casablanca/ },
];

export function detectCity(prompt: string): CityEntry | null {
  const text = prompt.toLowerCase();
  for (const city of CITY_LIBRARY) {
    if (city.keywords.test(text)) return city;
  }
  return null;
}

// ============================================================================
// Culture / cuisine (35+ entries) - concrete culinary/cultural visual
// detail tied to a region, for scenes that mention a cuisine or culture.
// ============================================================================
export type CultureCuisineEntry = { id: string; label: string; description: string; keywords: RegExp };

export const CULTURE_CUISINE_LIBRARY: CultureCuisineEntry[] = [
  { id: "italian", label: "Italian", description: "a table set with fresh pasta, olive oil, crusty bread, and a bottle of red wine", keywords: /italian food|italian cuisine|\bpasta\b|\bpizza\b/ },
  { id: "japanese", label: "Japanese", description: "a minimalist table with sushi, a small ceramic sake set, chopsticks laid neatly", keywords: /japanese food|japanese cuisine|\bsushi\b|\bramen\b/ },
  { id: "french", label: "French", description: "a bistro table with fresh croissants, a café au lait, and a small vase of flowers", keywords: /french food|french cuisine|\bcroissant\b/ },
  { id: "mexican", label: "Mexican", description: "a colorful table with fresh tacos, lime wedges, salsa, and hand-painted ceramics", keywords: /mexican food|mexican cuisine|\btacos?\b/ },
  { id: "indian", label: "Indian", description: "a table of vibrant curries, fresh naan, brass serving dishes, fragrant steam rising", keywords: /indian food|indian cuisine|\bcurry\b/ },
  { id: "thai", label: "Thai", description: "a table with fragrant pad thai, fresh herbs, lime, and a small mortar of chili paste", keywords: /thai food|thai cuisine|pad thai/ },
  { id: "vietnamese", label: "Vietnamese", description: "a steaming bowl of pho with fresh herbs, bean sprouts, and lime on the side", keywords: /vietnamese food|vietnamese cuisine|\bpho\b/ },
  { id: "korean", label: "Korean", description: "a table of small banchan side dishes, sizzling barbecue, kimchi in a stone bowl", keywords: /korean food|korean cuisine|kimchi|korean bbq/ },
  { id: "chinese", label: "Chinese", description: "a round table with shared dishes, steaming dumplings, chopsticks, a teapot", keywords: /chinese food|chinese cuisine|\bdumplings?\b/ },
  { id: "greek", label: "Greek", description: "a table of fresh olives, feta, grilled fish, and a carafe of white wine by the sea", keywords: /greek food|greek cuisine/ },
  { id: "spanish", label: "Spanish", description: "a table of tapas, jamón, patatas bravas, and a pitcher of sangria", keywords: /spanish food|spanish cuisine|\btapas\b/ },
  { id: "moroccan", label: "Moroccan", description: "a tagine steaming at the center of a low ornate table, mint tea poured from height", keywords: /moroccan food|moroccan cuisine|\btagine\b/ },
  { id: "lebanese", label: "Lebanese", description: "a mezze spread of hummus, fresh pita, tabbouleh, and grilled skewers", keywords: /lebanese food|lebanese cuisine|\bmezze\b/ },
  { id: "ethiopian", label: "Ethiopian", description: "a shared platter of injera bread topped with vibrant stews, eaten by hand", keywords: /ethiopian food|ethiopian cuisine|\binjera\b/ },
  { id: "brazilian", label: "Brazilian", description: "a churrasco grill with skewered meats, fresh caipirinhas, vibrant tropical fruit", keywords: /brazilian food|brazilian cuisine|churrasco/ },
  { id: "peruvian", label: "Peruvian", description: "fresh ceviche, colorful potatoes, a pisco sour on the side", keywords: /peruvian food|peruvian cuisine|\bceviche\b/ },
  { id: "turkish", label: "Turkish", description: "a low table of mezze, fresh flatbread, strong coffee in small cups", keywords: /turkish food|turkish cuisine/ },
  { id: "german", label: "German", description: "a hearty table of sausages, pretzels, sauerkraut, steins of beer", keywords: /german food|german cuisine|\bpretzel\b/ },
  { id: "caribbean", label: "Caribbean", description: "jerk-spiced grilled meats, fresh tropical fruit, a rum cocktail garnished with mint", keywords: /caribbean food|caribbean cuisine|\bjerk\b/ },
  { id: "hawaiian", label: "Hawaiian", description: "fresh poke bowls, tropical flowers, a laid-back beachside table setting", keywords: /hawaiian food|hawaiian cuisine|\bpoke\b/ },
];

export function detectCultureCuisine(prompt: string): CultureCuisineEntry | null {
  const text = prompt.toLowerCase();
  for (const entry of CULTURE_CUISINE_LIBRARY) {
    if (entry.keywords.test(text)) return entry;
  }
  return null;
}

// ============================================================================
// Music mood (25+ entries) - ambient/diegetic audio-atmosphere cues.
// ============================================================================
export type MusicMoodEntry = { id: string; label: string; description: string; keywords: RegExp };

export const MUSIC_MOOD_LIBRARY: MusicMoodEntry[] = [
  { id: "soft-acoustic", label: "Soft Acoustic", description: "soft, intimate acoustic guitar underneath the scene", keywords: /acoustic guitar|soft acoustic/ },
  { id: "orchestral-swell", label: "Orchestral Swell", description: "a swelling orchestral score building under the emotional beat", keywords: /orchestral|orchestra swell|sweeping score/ },
  { id: "jazz-lounge", label: "Jazz Lounge", description: "a smoky, relaxed jazz trio playing in the background", keywords: /\bjazz\b/ },
  { id: "synthwave", label: "Synthwave", description: "a pulsing retro synthwave track underneath the neon visuals", keywords: /synthwave|synth-?pop|80s synth/ },
  { id: "lofi-hiphop", label: "Lo-Fi Hip-Hop", description: "a mellow, lo-fi hip-hop beat with soft vinyl crackle", keywords: /lo-?fi|lofi/ },
  { id: "kpop-upbeat", label: "Upbeat K-Pop", description: "an energetic, polished K-pop track driving the pace", keywords: /k-?pop/ },
  { id: "taiko-drums", label: "Traditional Taiko Drumming", description: "powerful traditional taiko drumming, building tension", keywords: /taiko/ },
  { id: "flamenco-guitar", label: "Flamenco Guitar", description: "passionate, rhythmic flamenco guitar", keywords: /flamenco/ },
  { id: "edm-drop", label: "EDM Build", description: "an EDM track building toward a drop, matched to the energy of the shot", keywords: /\bedm\b|electronic dance/ },
  { id: "string-quartet", label: "String Quartet", description: "an elegant string quartet playing softly in the background", keywords: /string quartet/ },
  { id: "gospel-choir", label: "Gospel Choir", description: "a soaring gospel choir, full of warmth and power", keywords: /gospel choir|gospel music/ },
  { id: "reggae-groove", label: "Reggae Groove", description: "a relaxed, off-beat reggae groove", keywords: /\breggae\b/ },
  { id: "classical-piano", label: "Classical Piano", description: "a solo classical piano piece, delicate and contemplative", keywords: /classical piano|solo piano/ },
  { id: "tribal-percussion", label: "Tribal Percussion", description: "layered tribal percussion, building a sense of ritual and urgency", keywords: /tribal drums|tribal percussion/ },
  { id: "ambient-drone", label: "Ambient Drone", description: "a low, sustained ambient drone, unsettling and atmospheric", keywords: /ambient drone|ambient music/ },
  { id: "punk-rock", label: "Punk Rock", description: "raw, fast punk rock energy", keywords: /punk rock/ },
  { id: "bossa-nova", label: "Bossa Nova", description: "a breezy, laid-back bossa nova rhythm", keywords: /bossa nova/ },
  { id: "epic-trailer", label: "Epic Trailer Score", description: "a booming, epic trailer-style score with deep percussion hits", keywords: /trailer music|epic score|cinematic trailer/ },
  { id: "music-box", label: "Music Box", description: "a delicate, slightly eerie music-box melody", keywords: /music box/ },
  { id: "country-twang", label: "Country Twang", description: "a warm, twangy acoustic country melody", keywords: /country music|country twang/ },
  { id: "silence-tension", label: "Tense Silence", description: "near-total silence, tension carried by ambient room tone alone", keywords: /tense silence|dead silence/ },
  { id: "handpan-meditative", label: "Meditative Handpan", description: "a slow, meditative handpan melody", keywords: /handpan|meditative music/ },
  { id: "brass-band", label: "Brass Band", description: "a lively brass band, full of celebratory energy", keywords: /brass band/ },
  { id: "trap-beat", label: "Trap Beat", description: "a heavy, bass-driven trap beat", keywords: /\btrap beat\b/ },
  { id: "celtic-folk", label: "Celtic Folk", description: "a lilting Celtic folk melody on fiddle and flute", keywords: /celtic|irish folk/ },
];

export function detectMusicMood(prompt: string): MusicMoodEntry | null {
  const text = prompt.toLowerCase();
  for (const entry of MUSIC_MOOD_LIBRARY) {
    if (entry.keywords.test(text)) return entry;
  }
  return null;
}

// ============================================================================
// Dialogue languages (35+ entries) - which language dialogue is spoken in,
// distinct from the visual/cultural cues above (a scene can be set in
// Paris with dialogue in English, or vice versa) - detected only from an
// explicit request, never inferred from a detected city/culture, since
// that would silently override what the user actually asked for.
// ============================================================================
export type LanguageEntry = { id: string; label: string; keywords: RegExp };

export const LANGUAGE_LIBRARY: LanguageEntry[] = [
  { id: "english", label: "English", keywords: /\bin english\b|english dialogue/ },
  { id: "spanish", label: "Spanish", keywords: /\bin spanish\b|spanish dialogue|hablando en español/ },
  { id: "french", label: "French", keywords: /\bin french\b|french dialogue/ },
  { id: "german", label: "German", keywords: /\bin german\b|german dialogue/ },
  { id: "italian", label: "Italian", keywords: /\bin italian\b|italian dialogue/ },
  { id: "portuguese", label: "Portuguese", keywords: /\bin portuguese\b|portuguese dialogue/ },
  { id: "mandarin", label: "Mandarin Chinese", keywords: /\bin mandarin\b|mandarin dialogue/ },
  { id: "cantonese", label: "Cantonese", keywords: /\bin cantonese\b|cantonese dialogue/ },
  { id: "japanese", label: "Japanese", keywords: /\bin japanese\b|japanese dialogue/ },
  { id: "korean", label: "Korean", keywords: /\bin korean\b|korean dialogue/ },
  { id: "hindi", label: "Hindi", keywords: /\bin hindi\b|hindi dialogue/ },
  { id: "arabic", label: "Arabic", keywords: /\bin arabic\b|arabic dialogue/ },
  { id: "russian", label: "Russian", keywords: /\bin russian\b|russian dialogue/ },
  { id: "dutch", label: "Dutch", keywords: /\bin dutch\b|dutch dialogue/ },
  { id: "swedish", label: "Swedish", keywords: /\bin swedish\b|swedish dialogue/ },
  { id: "norwegian", label: "Norwegian", keywords: /\bin norwegian\b|norwegian dialogue/ },
  { id: "danish", label: "Danish", keywords: /\bin danish\b|danish dialogue/ },
  { id: "finnish", label: "Finnish", keywords: /\bin finnish\b|finnish dialogue/ },
  { id: "polish", label: "Polish", keywords: /\bin polish\b|polish dialogue/ },
  { id: "greek", label: "Greek", keywords: /\bin greek\b|greek dialogue/ },
  { id: "turkish", label: "Turkish", keywords: /\bin turkish\b|turkish dialogue/ },
  { id: "hebrew", label: "Hebrew", keywords: /\bin hebrew\b|hebrew dialogue/ },
  { id: "thai", label: "Thai", keywords: /\bin thai\b|thai dialogue/ },
  { id: "vietnamese", label: "Vietnamese", keywords: /\bin vietnamese\b|vietnamese dialogue/ },
  { id: "indonesian", label: "Indonesian", keywords: /\bin indonesian\b|indonesian dialogue/ },
  { id: "tagalog", label: "Tagalog", keywords: /\bin tagalog\b|tagalog dialogue/ },
  { id: "swahili", label: "Swahili", keywords: /\bin swahili\b|swahili dialogue/ },
  { id: "amharic", label: "Amharic", keywords: /\bin amharic\b|amharic dialogue/ },
  { id: "farsi", label: "Farsi/Persian", keywords: /\bin farsi\b|\bin persian\b|persian dialogue/ },
  { id: "urdu", label: "Urdu", keywords: /\bin urdu\b|urdu dialogue/ },
  { id: "bengali", label: "Bengali", keywords: /\bin bengali\b|bengali dialogue/ },
  { id: "tamil", label: "Tamil", keywords: /\bin tamil\b|tamil dialogue/ },
  { id: "czech", label: "Czech", keywords: /\bin czech\b|czech dialogue/ },
  { id: "hungarian", label: "Hungarian", keywords: /\bin hungarian\b|hungarian dialogue/ },
  { id: "romanian", label: "Romanian", keywords: /\bin romanian\b|romanian dialogue/ },
  { id: "ukrainian", label: "Ukrainian", keywords: /\bin ukrainian\b|ukrainian dialogue/ },
];

export function detectLanguage(prompt: string): LanguageEntry | null {
  const text = prompt.toLowerCase();
  for (const lang of LANGUAGE_LIBRARY) {
    if (lang.keywords.test(text)) return lang;
  }
  return null;
}
