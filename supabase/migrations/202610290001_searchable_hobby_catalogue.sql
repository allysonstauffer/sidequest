-- Catalogue snapshot from packages/sidequest-frontend/src/data/SideQuestHobbies.json.
-- Uses the existing hobby_categories table and its existing access policies.
-- Apply after 202610150001_save_my_preferences.sql. No existing categories are removed.
-- Future catalogue edits need a new seed migration and a matching frontend release.
begin;

alter table public.hobby_categories
  add column if not exists keywords text[] not null default '{}';

-- Preserve existing names, creators, timestamps, and additional keywords.
insert into public.hobby_categories as existing (id, name, keywords)
select hobby.id, hobby.label,
       array(select jsonb_array_elements_text(hobby.keywords))
from jsonb_to_recordset($hobby_catalogue$
[
  {
    "id": "3d-printing",
    "label": "3D printing",
    "keywords": [
      "filament",
      "prototyping"
    ]
  },
  {
    "id": "acrobatics",
    "label": "Acrobatics",
    "keywords": [
      "tumbling",
      "balance"
    ]
  },
  {
    "id": "acting",
    "label": "Acting",
    "keywords": [
      "theater",
      "performance"
    ]
  },
  {
    "id": "amateur-radio",
    "label": "Amateur radio",
    "keywords": [
      "ham radio",
      "radio"
    ]
  },
  {
    "id": "animation",
    "label": "Animation",
    "keywords": [
      "cartoons",
      "motion"
    ]
  },
  {
    "id": "aquascaping",
    "label": "Aquascaping",
    "keywords": [
      "aquariums",
      "aquatic plants"
    ]
  },
  {
    "id": "astrology",
    "label": "Astrology",
    "keywords": [
      "zodiac",
      "horoscopes"
    ]
  },
  {
    "id": "astronomy",
    "label": "Astronomy",
    "keywords": [
      "stars",
      "telescopes"
    ]
  },
  {
    "id": "baking",
    "label": "Baking",
    "keywords": [
      "cakes",
      "pastries"
    ]
  },
  {
    "id": "baton-twirling",
    "label": "Baton twirling",
    "keywords": [
      "batons",
      "performance"
    ]
  },
  {
    "id": "blogging",
    "label": "Blogging",
    "keywords": [
      "blogs",
      "articles"
    ]
  },
  {
    "id": "building",
    "label": "Building",
    "keywords": [
      "construction",
      "projects"
    ]
  },
  {
    "id": "board-tabletop-games",
    "label": "Board/tabletop games",
    "keywords": [
      "board games",
      "tabletop"
    ]
  },
  {
    "id": "book-discussion-clubs",
    "label": "Book discussion clubs",
    "keywords": [
      "books",
      "book clubs"
    ]
  },
  {
    "id": "book-restoration",
    "label": "Book restoration",
    "keywords": [
      "books",
      "bookbinding"
    ]
  },
  {
    "id": "bowling",
    "label": "Bowling",
    "keywords": [
      "pins",
      "lanes"
    ]
  },
  {
    "id": "brazilian-jiu-jitsu",
    "label": "Brazilian jiu-jitsu",
    "keywords": [
      "bjj",
      "grappling"
    ]
  },
  {
    "id": "breadmaking",
    "label": "Breadmaking",
    "keywords": [
      "bread",
      "sourdough"
    ]
  },
  {
    "id": "bullet-journaling",
    "label": "Bullet journaling",
    "keywords": [
      "planners",
      "bujo"
    ]
  },
  {
    "id": "cabaret",
    "label": "Cabaret",
    "keywords": [
      "theater",
      "performance"
    ]
  },
  {
    "id": "calligraphy",
    "label": "Calligraphy",
    "keywords": [
      "lettering",
      "ink"
    ]
  },
  {
    "id": "candle-making",
    "label": "Candle making",
    "keywords": [
      "wax",
      "wicks"
    ]
  },
  {
    "id": "candy-making",
    "label": "Candy making",
    "keywords": [
      "sweets",
      "sugar"
    ]
  },
  {
    "id": "car-fixing-building",
    "label": "Car fixing & building",
    "keywords": [
      "cars",
      "mechanics"
    ]
  },
  {
    "id": "card-games",
    "label": "Card games",
    "keywords": [
      "cards",
      "decks"
    ]
  },
  {
    "id": "cheesemaking",
    "label": "Cheesemaking",
    "keywords": [
      "cheese",
      "dairy"
    ]
  },
  {
    "id": "cleaning",
    "label": "Cleaning",
    "keywords": [
      "housekeeping",
      "organizing"
    ]
  },
  {
    "id": "clothesmaking",
    "label": "Clothesmaking",
    "keywords": [
      "clothing",
      "sewing"
    ]
  },
  {
    "id": "coffee-roasting",
    "label": "Coffee roasting",
    "keywords": [
      "coffee",
      "beans"
    ]
  },
  {
    "id": "collecting",
    "label": "Collecting",
    "keywords": [
      "collections",
      "collectibles"
    ]
  },
  {
    "id": "coloring",
    "label": "Coloring",
    "keywords": [
      "coloring books",
      "pencils"
    ]
  },
  {
    "id": "computer-programming",
    "label": "Computer programming",
    "keywords": [
      "coding",
      "software"
    ]
  },
  {
    "id": "confectionery",
    "label": "Confectionery",
    "keywords": [
      "sweets",
      "desserts"
    ]
  },
  {
    "id": "cooking",
    "label": "Cooking",
    "keywords": [
      "food",
      "recipes"
    ]
  },
  {
    "id": "cosplaying",
    "label": "Cosplaying",
    "keywords": [
      "costumes",
      "characters"
    ]
  },
  {
    "id": "couponing",
    "label": "Couponing",
    "keywords": [
      "coupons",
      "discounts"
    ]
  },
  {
    "id": "craft",
    "label": "Craft",
    "keywords": [
      "crafting",
      "handmade"
    ]
  },
  {
    "id": "creative-writing",
    "label": "Creative writing",
    "keywords": [
      "stories",
      "fiction"
    ]
  },
  {
    "id": "crocheting",
    "label": "Crocheting",
    "keywords": [
      "crochet",
      "yarn"
    ]
  },
  {
    "id": "cross-stitch",
    "label": "Cross-stitch",
    "keywords": [
      "embroidery",
      "stitching"
    ]
  },
  {
    "id": "crossword-puzzles",
    "label": "Crossword puzzles",
    "keywords": [
      "crosswords",
      "word puzzles"
    ]
  },
  {
    "id": "cryptography",
    "label": "Cryptography",
    "keywords": [
      "ciphers",
      "encryption"
    ]
  },
  {
    "id": "cue-sports",
    "label": "Cue sports",
    "keywords": [
      "billiards",
      "snooker"
    ]
  },
  {
    "id": "dance",
    "label": "Dance",
    "keywords": [
      "dancing",
      "choreography"
    ]
  },
  {
    "id": "digital-arts",
    "label": "Digital arts",
    "keywords": [
      "digital art",
      "illustration"
    ]
  },
  {
    "id": "distro-hopping",
    "label": "Distro Hopping",
    "keywords": [
      "linux",
      "distributions"
    ]
  },
  {
    "id": "djing",
    "label": "DJing",
    "keywords": [
      "mixing",
      "turntables"
    ]
  },
  {
    "id": "do-it-yourself",
    "label": "Do it yourself",
    "keywords": [
      "diy",
      "projects"
    ]
  },
  {
    "id": "drama",
    "label": "Drama",
    "keywords": [
      "theater",
      "acting"
    ]
  },
  {
    "id": "drawing",
    "label": "Drawing",
    "keywords": [
      "pencils",
      "illustration"
    ]
  },
  {
    "id": "drink-mixing",
    "label": "Drink mixing",
    "keywords": [
      "cocktails",
      "mixology"
    ]
  },
  {
    "id": "drinking",
    "label": "Drinking",
    "keywords": [
      "beverages",
      "tasting"
    ]
  },
  {
    "id": "electronic-games",
    "label": "Electronic games",
    "keywords": [
      "video games",
      "gaming"
    ]
  },
  {
    "id": "electronics",
    "label": "Electronics",
    "keywords": [
      "circuits",
      "components"
    ]
  },
  {
    "id": "embroidery",
    "label": "Embroidery",
    "keywords": [
      "needlework",
      "thread"
    ]
  },
  {
    "id": "experimenting",
    "label": "Experimenting",
    "keywords": [
      "experiments",
      "science"
    ]
  },
  {
    "id": "fantasy-sports",
    "label": "Fantasy sports",
    "keywords": [
      "fantasy leagues",
      "team management"
    ]
  },
  {
    "id": "fashion",
    "label": "Fashion",
    "keywords": [
      "style",
      "clothing"
    ]
  },
  {
    "id": "fashion-design",
    "label": "Fashion design",
    "keywords": [
      "clothing",
      "design"
    ]
  },
  {
    "id": "fishkeeping",
    "label": "Fishkeeping",
    "keywords": [
      "aquariums",
      "fish"
    ]
  },
  {
    "id": "filmmaking",
    "label": "Filmmaking",
    "keywords": [
      "cinema",
      "directing"
    ]
  },
  {
    "id": "flower-arranging",
    "label": "Flower arranging",
    "keywords": [
      "flowers",
      "floristry"
    ]
  },
  {
    "id": "fly-tying",
    "label": "Fly tying",
    "keywords": [
      "fishing flies",
      "fly fishing"
    ]
  },
  {
    "id": "foreign-language-learning",
    "label": "Foreign language learning",
    "keywords": [
      "languages",
      "vocabulary"
    ]
  },
  {
    "id": "furniture-building",
    "label": "Furniture building",
    "keywords": [
      "furniture",
      "carpentry"
    ]
  },
  {
    "id": "gaming",
    "label": "Gaming",
    "keywords": [
      "games",
      "video games"
    ]
  },
  {
    "id": "genealogy",
    "label": "Genealogy",
    "keywords": [
      "ancestry",
      "family history"
    ]
  },
  {
    "id": "gingerbread-house-making",
    "label": "Gingerbread house making",
    "keywords": [
      "gingerbread",
      "decorating"
    ]
  },
  {
    "id": "glassblowing",
    "label": "Glassblowing",
    "keywords": [
      "glass",
      "furnaces"
    ]
  },
  {
    "id": "graphic-design",
    "label": "Graphic design",
    "keywords": [
      "typography",
      "visual design"
    ]
  },
  {
    "id": "gunsmithing",
    "label": "Gunsmithing",
    "keywords": [
      "firearms",
      "metalworking"
    ]
  },
  {
    "id": "gymnastics",
    "label": "Gymnastics",
    "keywords": [
      "tumbling",
      "apparatus"
    ]
  },
  {
    "id": "hacking",
    "label": "Hacking",
    "keywords": [
      "computers",
      "security"
    ]
  },
  {
    "id": "herp-keeping",
    "label": "Herp keeping",
    "keywords": [
      "reptiles",
      "amphibians"
    ]
  },
  {
    "id": "home-improvement",
    "label": "Home improvement",
    "keywords": [
      "renovation",
      "repairs"
    ]
  },
  {
    "id": "homebrewing",
    "label": "Homebrewing",
    "keywords": [
      "beer",
      "brewing"
    ]
  },
  {
    "id": "houseplant-care",
    "label": "Houseplant care",
    "keywords": [
      "plants",
      "indoor gardening"
    ]
  },
  {
    "id": "hula-hooping",
    "label": "Hula hooping",
    "keywords": [
      "hoops",
      "hoop dance"
    ]
  },
  {
    "id": "humor",
    "label": "Humor",
    "keywords": [
      "comedy",
      "jokes"
    ]
  },
  {
    "id": "hydroponics",
    "label": "Hydroponics",
    "keywords": [
      "plants",
      "soilless growing"
    ]
  },
  {
    "id": "ice-skating",
    "label": "Ice skating",
    "keywords": [
      "ice",
      "skates"
    ]
  },
  {
    "id": "jewelry-making",
    "label": "Jewelry making",
    "keywords": [
      "beads",
      "jewelry"
    ]
  },
  {
    "id": "jigsaw-puzzles",
    "label": "Jigsaw puzzles",
    "keywords": [
      "jigsaws",
      "puzzle pieces"
    ]
  },
  {
    "id": "journaling",
    "label": "Journaling",
    "keywords": [
      "diaries",
      "reflection"
    ]
  },
  {
    "id": "juggling",
    "label": "Juggling",
    "keywords": [
      "balls",
      "coordination"
    ]
  },
  {
    "id": "karaoke",
    "label": "Karaoke",
    "keywords": [
      "singing",
      "songs"
    ]
  },
  {
    "id": "karate",
    "label": "Karate",
    "keywords": [
      "martial arts",
      "kata"
    ]
  },
  {
    "id": "kendama",
    "label": "Kendama",
    "keywords": [
      "skill toys",
      "ball and cup"
    ]
  },
  {
    "id": "knife-making",
    "label": "Knife making",
    "keywords": [
      "blades",
      "forging"
    ]
  },
  {
    "id": "knitting",
    "label": "Knitting",
    "keywords": [
      "yarn",
      "needles"
    ]
  },
  {
    "id": "knot-tying",
    "label": "Knot tying",
    "keywords": [
      "knots",
      "rope"
    ]
  },
  {
    "id": "kombucha-brewing",
    "label": "Kombucha brewing",
    "keywords": [
      "kombucha",
      "fermentation"
    ]
  },
  {
    "id": "lace-making",
    "label": "Lace making",
    "keywords": [
      "lace",
      "needlework"
    ]
  },
  {
    "id": "lapidary",
    "label": "Lapidary",
    "keywords": [
      "gemstones",
      "stone polishing"
    ]
  },
  {
    "id": "leather-crafting",
    "label": "Leather crafting",
    "keywords": [
      "leather",
      "leatherwork"
    ]
  },
  {
    "id": "lego-building",
    "label": "Lego building",
    "keywords": [
      "lego",
      "bricks"
    ]
  },
  {
    "id": "lock-picking",
    "label": "Lock picking",
    "keywords": [
      "locks",
      "locksport"
    ]
  },
  {
    "id": "listening-to-music",
    "label": "Listening to music",
    "keywords": [
      "music",
      "songs"
    ]
  },
  {
    "id": "listening-to-podcasts",
    "label": "Listening to podcasts",
    "keywords": [
      "podcasts",
      "audio"
    ]
  },
  {
    "id": "machining",
    "label": "Machining",
    "keywords": [
      "lathes",
      "milling"
    ]
  },
  {
    "id": "macrame",
    "label": "Macrame",
    "keywords": [
      "knots",
      "cord"
    ]
  },
  {
    "id": "magic",
    "label": "Magic",
    "keywords": [
      "illusions",
      "magic tricks"
    ]
  },
  {
    "id": "makeup",
    "label": "Makeup",
    "keywords": [
      "cosmetics",
      "beauty"
    ]
  },
  {
    "id": "mazes-indoor-outdoor",
    "label": "Mazes (indoor/outdoor)",
    "keywords": [
      "mazes",
      "labyrinths"
    ]
  },
  {
    "id": "metalworking",
    "label": "Metalworking",
    "keywords": [
      "metal",
      "fabrication"
    ]
  },
  {
    "id": "model-building",
    "label": "Model building",
    "keywords": [
      "scale models",
      "miniatures"
    ]
  },
  {
    "id": "model-engineering",
    "label": "Model engineering",
    "keywords": [
      "miniature machines",
      "engineering"
    ]
  },
  {
    "id": "nail-art",
    "label": "Nail art",
    "keywords": [
      "nails",
      "manicures"
    ]
  },
  {
    "id": "needlepoint",
    "label": "Needlepoint",
    "keywords": [
      "canvas embroidery",
      "needlework"
    ]
  },
  {
    "id": "origami",
    "label": "Origami",
    "keywords": [
      "paper folding",
      "paper art"
    ]
  },
  {
    "id": "painting",
    "label": "Painting",
    "keywords": [
      "paint",
      "canvas"
    ]
  },
  {
    "id": "palmistry",
    "label": "Palmistry",
    "keywords": [
      "palm reading",
      "hands"
    ]
  },
  {
    "id": "pet-adoption-fostering",
    "label": "Pet adoption & fostering",
    "keywords": [
      "pets",
      "animal fostering"
    ]
  },
  {
    "id": "philately",
    "label": "Philately",
    "keywords": [
      "stamps",
      "stamp collecting"
    ]
  },
  {
    "id": "photography",
    "label": "Photography",
    "keywords": [
      "camera",
      "photos"
    ]
  },
  {
    "id": "practical-jokes",
    "label": "Practical jokes",
    "keywords": [
      "pranks",
      "jokes"
    ]
  },
  {
    "id": "pressed-flower-craft",
    "label": "Pressed flower craft",
    "keywords": [
      "pressed flowers",
      "botanical art"
    ]
  },
  {
    "id": "playing-musical-instruments",
    "label": "Playing musical instruments",
    "keywords": [
      "instruments",
      "music"
    ]
  },
  {
    "id": "poi",
    "label": "Poi",
    "keywords": [
      "flow arts",
      "spinning"
    ]
  },
  {
    "id": "pottery",
    "label": "Pottery",
    "keywords": [
      "clay",
      "ceramics"
    ]
  },
  {
    "id": "powerlifting",
    "label": "Powerlifting",
    "keywords": [
      "squat",
      "deadlift"
    ]
  },
  {
    "id": "puzzles",
    "label": "Puzzles",
    "keywords": [
      "brain teasers",
      "problem solving"
    ]
  },
  {
    "id": "quilling",
    "label": "Quilling",
    "keywords": [
      "paper strips",
      "paper art"
    ]
  },
  {
    "id": "quilting",
    "label": "Quilting",
    "keywords": [
      "quilts",
      "patchwork"
    ]
  },
  {
    "id": "quizzes",
    "label": "Quizzes",
    "keywords": [
      "trivia",
      "questions"
    ]
  },
  {
    "id": "radio-controlled-model",
    "label": "Radio-controlled model",
    "keywords": [
      "rc models",
      "remote control"
    ]
  },
  {
    "id": "rail-transport-modeling",
    "label": "Rail transport modeling",
    "keywords": [
      "model trains",
      "railways"
    ]
  },
  {
    "id": "rapping",
    "label": "Rapping",
    "keywords": [
      "rap",
      "hip hop"
    ]
  },
  {
    "id": "reading",
    "label": "Reading",
    "keywords": [
      "books",
      "literature"
    ]
  },
  {
    "id": "refinishing",
    "label": "Refinishing",
    "keywords": [
      "restoration",
      "furniture"
    ]
  },
  {
    "id": "reiki",
    "label": "Reiki",
    "keywords": [
      "relaxation",
      "spiritual practice"
    ]
  },
  {
    "id": "robot-combat",
    "label": "Robot combat",
    "keywords": [
      "robots",
      "robotics"
    ]
  },
  {
    "id": "rubik-s-cube",
    "label": "Rubik's Cube",
    "keywords": [
      "rubiks cube",
      "twisty puzzles"
    ]
  },
  {
    "id": "scrapbooking",
    "label": "Scrapbooking",
    "keywords": [
      "scrapbooks",
      "memories"
    ]
  },
  {
    "id": "sculpting",
    "label": "Sculpting",
    "keywords": [
      "sculpture",
      "modeling"
    ]
  },
  {
    "id": "sewing",
    "label": "Sewing",
    "keywords": [
      "fabric",
      "stitching"
    ]
  },
  {
    "id": "shoemaking",
    "label": "Shoemaking",
    "keywords": [
      "shoes",
      "footwear"
    ]
  },
  {
    "id": "singing",
    "label": "Singing",
    "keywords": [
      "vocals",
      "music"
    ]
  },
  {
    "id": "sketching",
    "label": "Sketching",
    "keywords": [
      "drawing",
      "pencils"
    ]
  },
  {
    "id": "skipping-rope",
    "label": "Skipping rope",
    "keywords": [
      "jump rope",
      "cardio"
    ]
  },
  {
    "id": "slot-car",
    "label": "Slot car",
    "keywords": [
      "slot cars",
      "tracks"
    ]
  },
  {
    "id": "soapmaking",
    "label": "Soapmaking",
    "keywords": [
      "soap",
      "handmade"
    ]
  },
  {
    "id": "social-media",
    "label": "Social media",
    "keywords": [
      "social networks",
      "content creation"
    ]
  },
  {
    "id": "spreadsheets",
    "label": "Spreadsheets",
    "keywords": [
      "excel",
      "data"
    ]
  },
  {
    "id": "stand-up-comedy",
    "label": "Stand-up comedy",
    "keywords": [
      "comedy",
      "jokes"
    ]
  },
  {
    "id": "stamp-collecting",
    "label": "Stamp collecting",
    "keywords": [
      "stamps",
      "philately"
    ]
  },
  {
    "id": "table-tennis",
    "label": "Table tennis",
    "keywords": [
      "ping pong",
      "paddles"
    ]
  },
  {
    "id": "tarot",
    "label": "Tarot",
    "keywords": [
      "tarot cards",
      "card reading"
    ]
  },
  {
    "id": "taxidermy",
    "label": "Taxidermy",
    "keywords": [
      "specimens",
      "preservation"
    ]
  },
  {
    "id": "thrifting",
    "label": "Thrifting",
    "keywords": [
      "secondhand",
      "thrift stores"
    ]
  },
  {
    "id": "video-editing",
    "label": "Video editing",
    "keywords": [
      "editing",
      "footage"
    ]
  },
  {
    "id": "video-game-developing",
    "label": "Video game developing",
    "keywords": [
      "game development",
      "game design"
    ]
  },
  {
    "id": "video-gaming",
    "label": "Video gaming",
    "keywords": [
      "video games",
      "consoles"
    ]
  },
  {
    "id": "watching-movies",
    "label": "Watching movies",
    "keywords": [
      "movies",
      "cinema"
    ]
  },
  {
    "id": "watching-television",
    "label": "Watching television",
    "keywords": [
      "tv",
      "shows"
    ]
  },
  {
    "id": "videography",
    "label": "Videography",
    "keywords": [
      "video",
      "filming"
    ]
  },
  {
    "id": "virtual-reality",
    "label": "Virtual reality",
    "keywords": [
      "vr",
      "headsets"
    ]
  },
  {
    "id": "waxing",
    "label": "Waxing",
    "keywords": [
      "wax",
      "beauty"
    ]
  },
  {
    "id": "weaving",
    "label": "Weaving",
    "keywords": [
      "looms",
      "textiles"
    ]
  },
  {
    "id": "weight-training",
    "label": "Weight training",
    "keywords": [
      "weights",
      "strength training"
    ]
  },
  {
    "id": "welding",
    "label": "Welding",
    "keywords": [
      "metal",
      "joining"
    ]
  },
  {
    "id": "whittling",
    "label": "Whittling",
    "keywords": [
      "wood",
      "carving"
    ]
  },
  {
    "id": "wikipedia-editing",
    "label": "Wikipedia editing",
    "keywords": [
      "wikipedia",
      "encyclopedias"
    ]
  },
  {
    "id": "winemaking",
    "label": "Winemaking",
    "keywords": [
      "wine",
      "fermentation"
    ]
  },
  {
    "id": "wood-carving",
    "label": "Wood carving",
    "keywords": [
      "wood",
      "carving"
    ]
  },
  {
    "id": "woodworking",
    "label": "Woodworking",
    "keywords": [
      "wood",
      "carpentry"
    ]
  },
  {
    "id": "worldbuilding",
    "label": "Worldbuilding",
    "keywords": [
      "fictional worlds",
      "lore"
    ]
  },
  {
    "id": "writing",
    "label": "Writing",
    "keywords": [
      "words",
      "composition"
    ]
  },
  {
    "id": "word-searches",
    "label": "Word searches",
    "keywords": [
      "word puzzles",
      "hidden words"
    ]
  },
  {
    "id": "yo-yoing",
    "label": "Yo-yoing",
    "keywords": [
      "yo yo",
      "string tricks"
    ]
  },
  {
    "id": "yoga",
    "label": "Yoga",
    "keywords": [
      "poses",
      "stretching"
    ]
  },
  {
    "id": "zumba",
    "label": "Zumba",
    "keywords": [
      "dance fitness",
      "cardio"
    ]
  },
  {
    "id": "amusement-park-visiting",
    "label": "Amusement park visiting",
    "keywords": [
      "theme parks",
      "rides"
    ]
  },
  {
    "id": "air-sports",
    "label": "Air sports",
    "keywords": [
      "aviation",
      "flying"
    ]
  },
  {
    "id": "airsoft",
    "label": "Airsoft",
    "keywords": [
      "airsoft games",
      "team tactics"
    ]
  },
  {
    "id": "amateur-geology",
    "label": "Amateur geology",
    "keywords": [
      "rocks",
      "geology"
    ]
  },
  {
    "id": "archery",
    "label": "Archery",
    "keywords": [
      "bows",
      "arrows"
    ]
  },
  {
    "id": "backpacking",
    "label": "Backpacking",
    "keywords": [
      "trekking",
      "backpacks"
    ]
  },
  {
    "id": "badminton",
    "label": "Badminton",
    "keywords": [
      "rackets",
      "shuttlecocks"
    ]
  },
  {
    "id": "base-jumping",
    "label": "BASE jumping",
    "keywords": [
      "parachutes",
      "jumping"
    ]
  },
  {
    "id": "baseball",
    "label": "Baseball",
    "keywords": [
      "bats",
      "diamonds"
    ]
  },
  {
    "id": "basketball",
    "label": "Basketball",
    "keywords": [
      "hoops",
      "dribbling"
    ]
  },
  {
    "id": "beekeeping",
    "label": "Beekeeping",
    "keywords": [
      "bees",
      "honey"
    ]
  },
  {
    "id": "birdwatching",
    "label": "Birdwatching",
    "keywords": [
      "birds",
      "binoculars"
    ]
  },
  {
    "id": "blacksmithing",
    "label": "Blacksmithing",
    "keywords": [
      "forging",
      "anvils"
    ]
  },
  {
    "id": "bmx",
    "label": "BMX",
    "keywords": [
      "bikes",
      "stunts"
    ]
  },
  {
    "id": "board-sports",
    "label": "Board sports",
    "keywords": [
      "boards",
      "riding"
    ]
  },
  {
    "id": "bodybuilding",
    "label": "Bodybuilding",
    "keywords": [
      "muscle",
      "weightlifting"
    ]
  },
  {
    "id": "bonsai",
    "label": "Bonsai",
    "keywords": [
      "miniature trees",
      "pruning"
    ]
  },
  {
    "id": "butterfly-watching",
    "label": "Butterfly watching",
    "keywords": [
      "butterflies",
      "nature"
    ]
  },
  {
    "id": "bus-riding",
    "label": "Bus riding",
    "keywords": [
      "buses",
      "transit"
    ]
  },
  {
    "id": "camping",
    "label": "Camping",
    "keywords": [
      "tents",
      "campsites"
    ]
  },
  {
    "id": "canoeing",
    "label": "Canoeing",
    "keywords": [
      "canoes",
      "paddling"
    ]
  },
  {
    "id": "canyoning",
    "label": "Canyoning",
    "keywords": [
      "canyons",
      "waterfalls"
    ]
  },
  {
    "id": "car-riding",
    "label": "Car riding",
    "keywords": [
      "cars",
      "road trips"
    ]
  },
  {
    "id": "caving",
    "label": "Caving",
    "keywords": [
      "caves",
      "spelunking"
    ]
  },
  {
    "id": "composting",
    "label": "Composting",
    "keywords": [
      "compost",
      "organic waste"
    ]
  },
  {
    "id": "cycling",
    "label": "Cycling",
    "keywords": [
      "bikes",
      "bicycles"
    ]
  },
  {
    "id": "dowsing",
    "label": "Dowsing",
    "keywords": [
      "divining rods",
      "divination"
    ]
  },
  {
    "id": "driving",
    "label": "Driving",
    "keywords": [
      "cars",
      "motoring"
    ]
  },
  {
    "id": "farming",
    "label": "Farming",
    "keywords": [
      "agriculture",
      "crops"
    ]
  },
  {
    "id": "fishing",
    "label": "Fishing",
    "keywords": [
      "angling",
      "fish"
    ]
  },
  {
    "id": "flag-football",
    "label": "Flag football",
    "keywords": [
      "football",
      "flags"
    ]
  },
  {
    "id": "flower-growing",
    "label": "Flower growing",
    "keywords": [
      "flowers",
      "gardening"
    ]
  },
  {
    "id": "flying",
    "label": "Flying",
    "keywords": [
      "aviation",
      "piloting"
    ]
  },
  {
    "id": "flying-disc",
    "label": "Flying disc",
    "keywords": [
      "frisbee",
      "disc sports"
    ]
  },
  {
    "id": "foraging",
    "label": "Foraging",
    "keywords": [
      "wild food",
      "edible plants"
    ]
  },
  {
    "id": "fossicking",
    "label": "Fossicking",
    "keywords": [
      "minerals",
      "prospecting"
    ]
  },
  {
    "id": "freestyle-football",
    "label": "Freestyle football",
    "keywords": [
      "soccer tricks",
      "ball control"
    ]
  },
  {
    "id": "gardening",
    "label": "Gardening",
    "keywords": [
      "plants",
      "flowers"
    ]
  },
  {
    "id": "geocaching",
    "label": "Geocaching",
    "keywords": [
      "gps",
      "treasure hunting"
    ]
  },
  {
    "id": "ghost-hunting",
    "label": "Ghost hunting",
    "keywords": [
      "ghosts",
      "paranormal"
    ]
  },
  {
    "id": "gold-prospecting",
    "label": "Gold prospecting",
    "keywords": [
      "gold",
      "panning"
    ]
  },
  {
    "id": "graffiti",
    "label": "Graffiti",
    "keywords": [
      "street art",
      "spray paint"
    ]
  },
  {
    "id": "handball",
    "label": "Handball",
    "keywords": [
      "ball sports",
      "team sports"
    ]
  },
  {
    "id": "herbalism",
    "label": "Herbalism",
    "keywords": [
      "herbs",
      "botany"
    ]
  },
  {
    "id": "herping",
    "label": "Herping",
    "keywords": [
      "reptiles",
      "amphibians"
    ]
  },
  {
    "id": "high-power-rocketry",
    "label": "High-power rocketry",
    "keywords": [
      "rockets",
      "launches"
    ]
  },
  {
    "id": "hiking",
    "label": "Hiking",
    "keywords": [
      "trails",
      "trekking"
    ]
  },
  {
    "id": "hobby-horsing",
    "label": "Hobby horsing",
    "keywords": [
      "hobby horses",
      "equestrian games"
    ]
  },
  {
    "id": "hobby-tunneling",
    "label": "Hobby tunneling",
    "keywords": [
      "tunnels",
      "digging"
    ]
  },
  {
    "id": "hooping",
    "label": "Hooping",
    "keywords": [
      "hula hoops",
      "flow arts"
    ]
  },
  {
    "id": "horseback-riding",
    "label": "Horseback riding",
    "keywords": [
      "horses",
      "riding"
    ]
  },
  {
    "id": "hunting",
    "label": "Hunting",
    "keywords": [
      "game",
      "tracking"
    ]
  },
  {
    "id": "inline-skating",
    "label": "Inline skating",
    "keywords": [
      "rollerblades",
      "skating"
    ]
  },
  {
    "id": "jogging",
    "label": "Jogging",
    "keywords": [
      "running",
      "cardio"
    ]
  },
  {
    "id": "jumping-rope",
    "label": "Jumping rope",
    "keywords": [
      "jump rope",
      "skipping"
    ]
  },
  {
    "id": "kayaking",
    "label": "Kayaking",
    "keywords": [
      "kayaks",
      "paddling"
    ]
  },
  {
    "id": "kite-flying",
    "label": "Kite flying",
    "keywords": [
      "kites",
      "wind"
    ]
  },
  {
    "id": "kitesurfing",
    "label": "Kitesurfing",
    "keywords": [
      "kiteboarding",
      "water sports"
    ]
  },
  {
    "id": "lacrosse",
    "label": "Lacrosse",
    "keywords": [
      "sticks",
      "team sports"
    ]
  },
  {
    "id": "larping",
    "label": "LARPing",
    "keywords": [
      "live action role play",
      "costumes"
    ]
  },
  {
    "id": "letterboxing",
    "label": "Letterboxing",
    "keywords": [
      "treasure hunting",
      "rubber stamps"
    ]
  },
  {
    "id": "longboarding",
    "label": "Longboarding",
    "keywords": [
      "longboards",
      "skating"
    ]
  },
  {
    "id": "martial-arts",
    "label": "Martial arts",
    "keywords": [
      "combat sports",
      "self defense"
    ]
  },
  {
    "id": "metal-detecting",
    "label": "Metal detecting",
    "keywords": [
      "metal detectors",
      "treasure hunting"
    ]
  },
  {
    "id": "meteorology",
    "label": "Meteorology",
    "keywords": [
      "weather",
      "forecasting"
    ]
  },
  {
    "id": "motor-sports",
    "label": "Motor sports",
    "keywords": [
      "motorsport",
      "racing"
    ]
  },
  {
    "id": "mountain-biking",
    "label": "Mountain biking",
    "keywords": [
      "mtb",
      "bike trails"
    ]
  },
  {
    "id": "mountaineering",
    "label": "Mountaineering",
    "keywords": [
      "mountains",
      "alpinism"
    ]
  },
  {
    "id": "museum-visiting",
    "label": "Museum visiting",
    "keywords": [
      "museums",
      "exhibitions"
    ]
  },
  {
    "id": "mushroom-hunting",
    "label": "Mushroom hunting",
    "keywords": [
      "mushrooms",
      "foraging"
    ]
  },
  {
    "id": "netball",
    "label": "Netball",
    "keywords": [
      "team sports",
      "hoops"
    ]
  },
  {
    "id": "nordic-skating",
    "label": "Nordic skating",
    "keywords": [
      "ice",
      "tour skating"
    ]
  },
  {
    "id": "orienteering",
    "label": "Orienteering",
    "keywords": [
      "maps",
      "compass"
    ]
  },
  {
    "id": "paintball",
    "label": "Paintball",
    "keywords": [
      "paintballs",
      "team tactics"
    ]
  },
  {
    "id": "parkour",
    "label": "Parkour",
    "keywords": [
      "freerunning",
      "obstacles"
    ]
  },
  {
    "id": "podcast-hosting",
    "label": "Podcast hosting",
    "keywords": [
      "podcasting",
      "microphones"
    ]
  },
  {
    "id": "polo",
    "label": "Polo",
    "keywords": [
      "horses",
      "mallets"
    ]
  },
  {
    "id": "public-transport-riding",
    "label": "Public transport riding",
    "keywords": [
      "transit",
      "buses"
    ]
  },
  {
    "id": "rafting",
    "label": "Rafting",
    "keywords": [
      "rafts",
      "whitewater"
    ]
  },
  {
    "id": "railway-journeys",
    "label": "Railway journeys",
    "keywords": [
      "trains",
      "rail travel"
    ]
  },
  {
    "id": "rappelling",
    "label": "Rappelling",
    "keywords": [
      "abseiling",
      "ropes"
    ]
  },
  {
    "id": "road-biking",
    "label": "Road biking",
    "keywords": [
      "road cycling",
      "bicycles"
    ]
  },
  {
    "id": "rock-climbing",
    "label": "Rock climbing",
    "keywords": [
      "climbing",
      "bouldering"
    ]
  },
  {
    "id": "roller-skating",
    "label": "Roller skating",
    "keywords": [
      "roller skates",
      "rinks"
    ]
  },
  {
    "id": "rugby",
    "label": "Rugby",
    "keywords": [
      "rugby football",
      "team sports"
    ]
  },
  {
    "id": "running",
    "label": "Running",
    "keywords": [
      "runs",
      "cardio"
    ]
  },
  {
    "id": "sailing",
    "label": "Sailing",
    "keywords": [
      "sailboats",
      "wind"
    ]
  },
  {
    "id": "sand-art",
    "label": "Sand art",
    "keywords": [
      "sand",
      "sculptures"
    ]
  },
  {
    "id": "scouting",
    "label": "Scouting",
    "keywords": [
      "outdoor skills",
      "camping"
    ]
  },
  {
    "id": "scuba-diving",
    "label": "Scuba diving",
    "keywords": [
      "diving",
      "underwater"
    ]
  },
  {
    "id": "sculling",
    "label": "Sculling",
    "keywords": [
      "rowing",
      "oars"
    ]
  },
  {
    "id": "shooting",
    "label": "Shooting",
    "keywords": [
      "target shooting",
      "marksmanship"
    ]
  },
  {
    "id": "shopping",
    "label": "Shopping",
    "keywords": [
      "stores",
      "retail"
    ]
  },
  {
    "id": "shuffleboard",
    "label": "Shuffleboard",
    "keywords": [
      "pucks",
      "cues"
    ]
  },
  {
    "id": "skateboarding",
    "label": "Skateboarding",
    "keywords": [
      "skateboards",
      "skateparks"
    ]
  },
  {
    "id": "skiing",
    "label": "Skiing",
    "keywords": [
      "skis",
      "snow"
    ]
  },
  {
    "id": "skimboarding",
    "label": "Skimboarding",
    "keywords": [
      "skimboards",
      "beaches"
    ]
  },
  {
    "id": "skydiving",
    "label": "Skydiving",
    "keywords": [
      "parachutes",
      "freefall"
    ]
  },
  {
    "id": "slacklining",
    "label": "Slacklining",
    "keywords": [
      "balance",
      "webbing"
    ]
  },
  {
    "id": "snowboarding",
    "label": "Snowboarding",
    "keywords": [
      "snowboards",
      "snow"
    ]
  },
  {
    "id": "snowmobiling",
    "label": "Snowmobiling",
    "keywords": [
      "snowmobiles",
      "snow"
    ]
  },
  {
    "id": "snowshoeing",
    "label": "Snowshoeing",
    "keywords": [
      "snowshoes",
      "winter hiking"
    ]
  },
  {
    "id": "soccer",
    "label": "Soccer",
    "keywords": [
      "football",
      "goals"
    ]
  },
  {
    "id": "stone-skipping",
    "label": "Stone skipping",
    "keywords": [
      "stones",
      "water"
    ]
  },
  {
    "id": "sun-bathing",
    "label": "Sun bathing",
    "keywords": [
      "sunshine",
      "beaches"
    ]
  },
  {
    "id": "surfing",
    "label": "Surfing",
    "keywords": [
      "surfboards",
      "waves"
    ]
  },
  {
    "id": "survivalism",
    "label": "Survivalism",
    "keywords": [
      "survival skills",
      "bushcraft"
    ]
  },
  {
    "id": "swimming",
    "label": "Swimming",
    "keywords": [
      "water",
      "pools"
    ]
  },
  {
    "id": "taekwondo",
    "label": "Taekwondo",
    "keywords": [
      "martial arts",
      "kicks"
    ]
  },
  {
    "id": "tai-chi",
    "label": "Tai chi",
    "keywords": [
      "taiji",
      "movement"
    ]
  },
  {
    "id": "tennis",
    "label": "Tennis",
    "keywords": [
      "rackets",
      "courts"
    ]
  },
  {
    "id": "topiary",
    "label": "Topiary",
    "keywords": [
      "hedges",
      "pruning"
    ]
  },
  {
    "id": "tourism",
    "label": "Tourism",
    "keywords": [
      "sightseeing",
      "travel"
    ]
  },
  {
    "id": "thru-hiking",
    "label": "Thru-hiking",
    "keywords": [
      "long trails",
      "backpacking"
    ]
  },
  {
    "id": "trade-fair-visiting",
    "label": "Trade fair visiting",
    "keywords": [
      "trade shows",
      "exhibitions"
    ]
  },
  {
    "id": "travel",
    "label": "Travel",
    "keywords": [
      "trips",
      "destinations"
    ]
  },
  {
    "id": "urban-exploration",
    "label": "Urban exploration",
    "keywords": [
      "urbex",
      "abandoned buildings"
    ]
  },
  {
    "id": "vacation",
    "label": "Vacation",
    "keywords": [
      "holidays",
      "getaways"
    ]
  },
  {
    "id": "vegetable-farming",
    "label": "Vegetable farming",
    "keywords": [
      "vegetables",
      "crops"
    ]
  },
  {
    "id": "vehicle-restoration",
    "label": "Vehicle restoration",
    "keywords": [
      "classic cars",
      "restoration"
    ]
  },
  {
    "id": "walking",
    "label": "Walking",
    "keywords": [
      "walks",
      "strolling"
    ]
  },
  {
    "id": "water-sports",
    "label": "Water sports",
    "keywords": [
      "aquatic sports",
      "water"
    ]
  },
  {
    "id": "biology",
    "label": "Biology",
    "keywords": [
      "life science",
      "organisms"
    ]
  },
  {
    "id": "chemistry",
    "label": "Chemistry",
    "keywords": [
      "molecules",
      "reactions"
    ]
  },
  {
    "id": "electrochemistry",
    "label": "Electrochemistry",
    "keywords": [
      "electrodes",
      "chemical reactions"
    ]
  },
  {
    "id": "physics",
    "label": "Physics",
    "keywords": [
      "matter",
      "energy"
    ]
  },
  {
    "id": "psychology",
    "label": "Psychology",
    "keywords": [
      "mind",
      "behavior"
    ]
  },
  {
    "id": "sports-science",
    "label": "Sports science",
    "keywords": [
      "exercise",
      "biomechanics"
    ]
  },
  {
    "id": "geography",
    "label": "Geography",
    "keywords": [
      "maps",
      "places"
    ]
  },
  {
    "id": "history",
    "label": "History",
    "keywords": [
      "past",
      "historical events"
    ]
  },
  {
    "id": "mathematics",
    "label": "Mathematics",
    "keywords": [
      "math",
      "numbers"
    ]
  },
  {
    "id": "railway-studies",
    "label": "Railway studies",
    "keywords": [
      "railways",
      "trains"
    ]
  },
  {
    "id": "action-figure",
    "label": "Action figure",
    "keywords": [
      "action figures",
      "collectibles"
    ]
  },
  {
    "id": "antiquing",
    "label": "Antiquing",
    "keywords": [
      "antiques",
      "vintage"
    ]
  },
  {
    "id": "ant-keeping",
    "label": "Ant-keeping",
    "keywords": [
      "ants",
      "ant farms"
    ]
  },
  {
    "id": "art-collecting",
    "label": "Art collecting",
    "keywords": [
      "art",
      "collections"
    ]
  },
  {
    "id": "book-collecting",
    "label": "Book collecting",
    "keywords": [
      "books",
      "rare editions"
    ]
  },
  {
    "id": "button-collecting",
    "label": "Button collecting",
    "keywords": [
      "buttons",
      "collections"
    ]
  },
  {
    "id": "cartophily",
    "label": "Cartophily",
    "keywords": [
      "collecting",
      "cards"
    ]
  },
  {
    "id": "coin-collecting",
    "label": "Coin collecting",
    "keywords": [
      "coins",
      "numismatics"
    ]
  },
  {
    "id": "comic-book-collecting",
    "label": "Comic book collecting",
    "keywords": [
      "comics",
      "comic books"
    ]
  },
  {
    "id": "deltiology",
    "label": "Deltiology",
    "keywords": [
      "postcards",
      "collecting"
    ]
  },
  {
    "id": "die-cast-toy",
    "label": "Die-cast toy",
    "keywords": [
      "diecast",
      "model vehicles"
    ]
  },
  {
    "id": "digital-hoarding",
    "label": "Digital hoarding",
    "keywords": [
      "digital collections",
      "archives"
    ]
  },
  {
    "id": "dolls",
    "label": "Dolls",
    "keywords": [
      "doll collecting",
      "miniatures"
    ]
  },
  {
    "id": "element-collecting",
    "label": "Element collecting",
    "keywords": [
      "chemical elements",
      "periodic table"
    ]
  },
  {
    "id": "ephemera-collecting",
    "label": "Ephemera collecting",
    "keywords": [
      "ephemera",
      "paper collectibles"
    ]
  },
  {
    "id": "fusilately",
    "label": "Fusilately",
    "keywords": [
      "collecting",
      "memorabilia"
    ]
  },
  {
    "id": "knife-collecting",
    "label": "Knife collecting",
    "keywords": [
      "knives",
      "blades"
    ]
  },
  {
    "id": "lotology",
    "label": "Lotology",
    "keywords": [
      "collecting",
      "tickets"
    ]
  },
  {
    "id": "movie-and-movie-memorabilia-collecting",
    "label": "Movie and movie memorabilia collecting",
    "keywords": [
      "movie memorabilia",
      "film collectibles"
    ]
  },
  {
    "id": "fingerprint-collecting",
    "label": "Fingerprint collecting",
    "keywords": [
      "fingerprints",
      "prints"
    ]
  },
  {
    "id": "perfume",
    "label": "Perfume",
    "keywords": [
      "fragrance",
      "scents"
    ]
  },
  {
    "id": "phillumeny",
    "label": "Phillumeny",
    "keywords": [
      "matchboxes",
      "match labels"
    ]
  },
  {
    "id": "rail-transport-modelling",
    "label": "Rail transport modelling",
    "keywords": [
      "model trains",
      "railways"
    ]
  },
  {
    "id": "record-collecting",
    "label": "Record collecting",
    "keywords": [
      "records",
      "vinyl"
    ]
  },
  {
    "id": "rock-tumbling",
    "label": "Rock tumbling",
    "keywords": [
      "rocks",
      "polishing"
    ]
  },
  {
    "id": "scutelliphily",
    "label": "Scutelliphily",
    "keywords": [
      "collecting",
      "memorabilia"
    ]
  },
  {
    "id": "shoes",
    "label": "Shoes",
    "keywords": [
      "footwear",
      "sneakers"
    ]
  },
  {
    "id": "sports-memorabilia",
    "label": "Sports memorabilia",
    "keywords": [
      "sports collectibles",
      "autographs"
    ]
  },
  {
    "id": "stuffed-toy-collecting",
    "label": "Stuffed toy collecting",
    "keywords": [
      "plush toys",
      "teddy bears"
    ]
  },
  {
    "id": "tea-bag-collecting",
    "label": "Tea bag collecting",
    "keywords": [
      "tea bags",
      "tea"
    ]
  },
  {
    "id": "ticket-collecting",
    "label": "Ticket collecting",
    "keywords": [
      "tickets",
      "stubs"
    ]
  },
  {
    "id": "toys",
    "label": "Toys",
    "keywords": [
      "toy collecting",
      "playthings"
    ]
  },
  {
    "id": "transit-map-collecting",
    "label": "Transit map collecting",
    "keywords": [
      "transit maps",
      "public transport"
    ]
  },
  {
    "id": "video-game-collecting",
    "label": "Video game collecting",
    "keywords": [
      "video games",
      "retro games"
    ]
  },
  {
    "id": "vintage-cars",
    "label": "Vintage cars",
    "keywords": [
      "classic cars",
      "automobiles"
    ]
  },
  {
    "id": "vintage-clothing",
    "label": "Vintage clothing",
    "keywords": [
      "vintage fashion",
      "clothing"
    ]
  },
  {
    "id": "vinyl-records",
    "label": "Vinyl Records",
    "keywords": [
      "vinyl",
      "records"
    ]
  },
  {
    "id": "antiquities",
    "label": "Antiquities",
    "keywords": [
      "ancient artifacts",
      "collecting"
    ]
  },
  {
    "id": "auto-audiophilia",
    "label": "Auto audiophilia",
    "keywords": [
      "car audio",
      "sound systems"
    ]
  },
  {
    "id": "flower-collecting-and-pressing",
    "label": "Flower collecting and pressing",
    "keywords": [
      "flowers",
      "flower pressing"
    ]
  },
  {
    "id": "fossil-hunting",
    "label": "Fossil hunting",
    "keywords": [
      "fossils",
      "paleontology"
    ]
  },
  {
    "id": "insect-collecting",
    "label": "Insect collecting",
    "keywords": [
      "insects",
      "entomology"
    ]
  },
  {
    "id": "magnet-fishing",
    "label": "Magnet fishing",
    "keywords": [
      "magnets",
      "metal finds"
    ]
  },
  {
    "id": "mineral-collecting",
    "label": "Mineral collecting",
    "keywords": [
      "mineral specimens",
      "crystals"
    ]
  },
  {
    "id": "rock-balancing",
    "label": "Rock balancing",
    "keywords": [
      "rocks",
      "balance"
    ]
  },
  {
    "id": "sea-glass-collecting",
    "label": "Sea glass collecting",
    "keywords": [
      "sea glass",
      "beachcombing"
    ]
  },
  {
    "id": "seashell-collecting",
    "label": "Seashell collecting",
    "keywords": [
      "shells",
      "beachcombing"
    ]
  },
  {
    "id": "stone-collecting",
    "label": "Stone collecting",
    "keywords": [
      "stones",
      "rocks"
    ]
  },
  {
    "id": "animal-fancy",
    "label": "Animal fancy",
    "keywords": [
      "animals",
      "animal shows"
    ]
  },
  {
    "id": "axe-throwing",
    "label": "Axe throwing",
    "keywords": [
      "axes",
      "targets"
    ]
  },
  {
    "id": "backgammon",
    "label": "Backgammon",
    "keywords": [
      "board games",
      "dice"
    ]
  },
  {
    "id": "beauty-pageants",
    "label": "Beauty pageants",
    "keywords": [
      "pageants",
      "stage performance"
    ]
  },
  {
    "id": "billiards",
    "label": "Billiards",
    "keywords": [
      "cue sports",
      "billiard balls"
    ]
  },
  {
    "id": "boxing",
    "label": "Boxing",
    "keywords": [
      "punching",
      "combat sports"
    ]
  },
  {
    "id": "bridge",
    "label": "Bridge",
    "keywords": [
      "card games",
      "tricks"
    ]
  },
  {
    "id": "checkers-draughts",
    "label": "Checkers (draughts)",
    "keywords": [
      "checkers",
      "draughts"
    ]
  },
  {
    "id": "cheerleading",
    "label": "Cheerleading",
    "keywords": [
      "cheers",
      "stunts"
    ]
  },
  {
    "id": "chess",
    "label": "Chess",
    "keywords": [
      "strategy",
      "board games"
    ]
  },
  {
    "id": "color-guard",
    "label": "Color guard",
    "keywords": [
      "flags",
      "performance"
    ]
  },
  {
    "id": "cribbage",
    "label": "Cribbage",
    "keywords": [
      "cards",
      "pegs"
    ]
  },
  {
    "id": "curling",
    "label": "Curling",
    "keywords": [
      "ice",
      "stones"
    ]
  },
  {
    "id": "dancing",
    "label": "Dancing",
    "keywords": [
      "dance",
      "choreography"
    ]
  },
  {
    "id": "darts",
    "label": "Darts",
    "keywords": [
      "dartboards",
      "throwing"
    ]
  },
  {
    "id": "debate",
    "label": "Debate",
    "keywords": [
      "arguments",
      "public speaking"
    ]
  },
  {
    "id": "dominoes",
    "label": "Dominoes",
    "keywords": [
      "tiles",
      "tabletop games"
    ]
  },
  {
    "id": "eating",
    "label": "Eating",
    "keywords": [
      "food",
      "tasting"
    ]
  },
  {
    "id": "esports",
    "label": "Esports",
    "keywords": [
      "competitive gaming",
      "video games"
    ]
  },
  {
    "id": "fencing",
    "label": "Fencing",
    "keywords": [
      "swords",
      "foil"
    ]
  },
  {
    "id": "go",
    "label": "Go",
    "keywords": [
      "baduk",
      "board games"
    ]
  },
  {
    "id": "ice-hockey",
    "label": "Ice hockey",
    "keywords": [
      "hockey",
      "pucks"
    ]
  },
  {
    "id": "judo",
    "label": "Judo",
    "keywords": [
      "throws",
      "grappling"
    ]
  },
  {
    "id": "jujitsu",
    "label": "Jujitsu",
    "keywords": [
      "jujutsu",
      "martial arts"
    ]
  },
  {
    "id": "kabaddi",
    "label": "Kabaddi",
    "keywords": [
      "raiding",
      "team sports"
    ]
  },
  {
    "id": "knowledge-word-games",
    "label": "Knowledge/word games",
    "keywords": [
      "trivia",
      "word games"
    ]
  },
  {
    "id": "laser-tag",
    "label": "Laser tag",
    "keywords": [
      "lasers",
      "team games"
    ]
  },
  {
    "id": "mahjong",
    "label": "Mahjong",
    "keywords": [
      "tiles",
      "tabletop games"
    ]
  },
  {
    "id": "marbles",
    "label": "Marbles",
    "keywords": [
      "glass marbles",
      "marble games"
    ]
  },
  {
    "id": "model-united-nations",
    "label": "Model United Nations",
    "keywords": [
      "mun",
      "diplomacy"
    ]
  },
  {
    "id": "poker",
    "label": "Poker",
    "keywords": [
      "cards",
      "poker chips"
    ]
  },
  {
    "id": "pool",
    "label": "Pool",
    "keywords": [
      "billiards",
      "cue sports"
    ]
  },
  {
    "id": "role-playing-games",
    "label": "Role-playing games",
    "keywords": [
      "rpg",
      "tabletop roleplay"
    ]
  },
  {
    "id": "shogi",
    "label": "Shogi",
    "keywords": [
      "japanese chess",
      "board games"
    ]
  },
  {
    "id": "slot-car-racing",
    "label": "Slot car racing",
    "keywords": [
      "slot cars",
      "racing"
    ]
  },
  {
    "id": "speedcubing",
    "label": "Speedcubing",
    "keywords": [
      "rubiks cube",
      "twisty puzzles"
    ]
  },
  {
    "id": "sport-stacking",
    "label": "Sport stacking",
    "keywords": [
      "cup stacking",
      "speed stacking"
    ]
  },
  {
    "id": "table-football",
    "label": "Table football",
    "keywords": [
      "foosball",
      "table soccer"
    ]
  },
  {
    "id": "volleyball",
    "label": "Volleyball",
    "keywords": [
      "nets",
      "team sports"
    ]
  },
  {
    "id": "weightlifting",
    "label": "Weightlifting",
    "keywords": [
      "weights",
      "barbells"
    ]
  },
  {
    "id": "wrestling",
    "label": "Wrestling",
    "keywords": [
      "grappling",
      "takedowns"
    ]
  },
  {
    "id": "association-football",
    "label": "Association football",
    "keywords": [
      "soccer",
      "football"
    ]
  },
  {
    "id": "australian-rules-football",
    "label": "Australian rules football",
    "keywords": [
      "afl",
      "aussie rules"
    ]
  },
  {
    "id": "auto-racing",
    "label": "Auto racing",
    "keywords": [
      "car racing",
      "motorsport"
    ]
  },
  {
    "id": "beach-volleyball",
    "label": "Beach volleyball",
    "keywords": [
      "volleyball",
      "sand"
    ]
  },
  {
    "id": "breakdancing",
    "label": "Breakdancing",
    "keywords": [
      "breaking",
      "hip hop dance"
    ]
  },
  {
    "id": "climbing",
    "label": "Climbing",
    "keywords": [
      "rock climbing",
      "bouldering"
    ]
  },
  {
    "id": "cricket",
    "label": "Cricket",
    "keywords": [
      "bats",
      "wickets"
    ]
  },
  {
    "id": "croquet",
    "label": "Croquet",
    "keywords": [
      "mallets",
      "wickets"
    ]
  },
  {
    "id": "disc-golf",
    "label": "Disc golf",
    "keywords": [
      "discs",
      "baskets"
    ]
  },
  {
    "id": "dog-sport",
    "label": "Dog sport",
    "keywords": [
      "dogs",
      "agility"
    ]
  },
  {
    "id": "equestrianism",
    "label": "Equestrianism",
    "keywords": [
      "horse riding",
      "equestrian sports"
    ]
  },
  {
    "id": "exhibition-drill",
    "label": "Exhibition drill",
    "keywords": [
      "drill",
      "precision marching"
    ]
  },
  {
    "id": "field-hockey",
    "label": "Field hockey",
    "keywords": [
      "hockey",
      "sticks"
    ]
  },
  {
    "id": "figure-skating",
    "label": "Figure skating",
    "keywords": [
      "ice skating",
      "skating routines"
    ]
  },
  {
    "id": "footbag",
    "label": "Footbag",
    "keywords": [
      "hacky sack",
      "kicking"
    ]
  },
  {
    "id": "frisbee",
    "label": "Frisbee",
    "keywords": [
      "flying disc",
      "disc games"
    ]
  },
  {
    "id": "golfing",
    "label": "Golfing",
    "keywords": [
      "golf",
      "clubs"
    ]
  },
  {
    "id": "horseshoes",
    "label": "Horseshoes",
    "keywords": [
      "horseshoe pitching",
      "stakes"
    ]
  },
  {
    "id": "iceboat-racing",
    "label": "Iceboat racing",
    "keywords": [
      "ice sailing",
      "iceboats"
    ]
  },
  {
    "id": "jukskei",
    "label": "Jukskei",
    "keywords": [
      "throwing",
      "targets"
    ]
  },
  {
    "id": "kart-racing",
    "label": "Kart racing",
    "keywords": [
      "go karts",
      "karting"
    ]
  },
  {
    "id": "knife-throwing",
    "label": "Knife throwing",
    "keywords": [
      "knives",
      "targets"
    ]
  },
  {
    "id": "long-distance-running",
    "label": "Long-distance running",
    "keywords": [
      "distance running",
      "endurance"
    ]
  },
  {
    "id": "marching-band",
    "label": "Marching band",
    "keywords": [
      "music",
      "marching"
    ]
  },
  {
    "id": "model-aircraft",
    "label": "Model aircraft",
    "keywords": [
      "model planes",
      "aviation"
    ]
  },
  {
    "id": "pickleball",
    "label": "Pickleball",
    "keywords": [
      "paddles",
      "courts"
    ]
  },
  {
    "id": "quidditch",
    "label": "Quidditch",
    "keywords": [
      "brooms",
      "team sports"
    ]
  },
  {
    "id": "race-walking",
    "label": "Race walking",
    "keywords": [
      "walking",
      "athletics"
    ]
  },
  {
    "id": "racquetball",
    "label": "Racquetball",
    "keywords": [
      "rackets",
      "indoor courts"
    ]
  },
  {
    "id": "radio-controlled-car-racing",
    "label": "Radio-controlled car racing",
    "keywords": [
      "rc cars",
      "racing"
    ]
  },
  {
    "id": "roller-derby",
    "label": "Roller derby",
    "keywords": [
      "roller skates",
      "contact sport"
    ]
  },
  {
    "id": "rugby-league-football",
    "label": "Rugby league football",
    "keywords": [
      "rugby league",
      "team sports"
    ]
  },
  {
    "id": "shooting-sport",
    "label": "Shooting sport",
    "keywords": [
      "target shooting",
      "marksmanship"
    ]
  },
  {
    "id": "sled-dog-racing",
    "label": "Sled dog racing",
    "keywords": [
      "mushing",
      "sled dogs"
    ]
  },
  {
    "id": "softball",
    "label": "Softball",
    "keywords": [
      "bats",
      "diamonds"
    ]
  },
  {
    "id": "speed-skating",
    "label": "Speed skating",
    "keywords": [
      "ice skating",
      "racing"
    ]
  },
  {
    "id": "squash",
    "label": "Squash",
    "keywords": [
      "rackets",
      "courts"
    ]
  },
  {
    "id": "tennis-polo",
    "label": "Tennis polo",
    "keywords": [
      "tennis",
      "team sports"
    ]
  },
  {
    "id": "tether-car",
    "label": "Tether car",
    "keywords": [
      "model cars",
      "racing"
    ]
  },
  {
    "id": "tour-skating",
    "label": "Tour skating",
    "keywords": [
      "ice skating",
      "outdoor skating"
    ]
  },
  {
    "id": "trapshooting",
    "label": "Trapshooting",
    "keywords": [
      "clay targets",
      "shooting"
    ]
  },
  {
    "id": "triathlon",
    "label": "Triathlon",
    "keywords": [
      "swim bike run",
      "endurance"
    ]
  },
  {
    "id": "ultimate-frisbee",
    "label": "Ultimate frisbee",
    "keywords": [
      "ultimate",
      "flying disc"
    ]
  },
  {
    "id": "water-polo",
    "label": "Water polo",
    "keywords": [
      "swimming",
      "team sports"
    ]
  },
  {
    "id": "learning",
    "label": "Learning",
    "keywords": [
      "study",
      "education"
    ]
  },
  {
    "id": "meditation",
    "label": "Meditation",
    "keywords": [
      "mindfulness",
      "focus"
    ]
  },
  {
    "id": "microscopy",
    "label": "Microscopy",
    "keywords": [
      "microscopes",
      "specimens"
    ]
  },
  {
    "id": "research",
    "label": "Research",
    "keywords": [
      "investigation",
      "study"
    ]
  },
  {
    "id": "shortwave-listening",
    "label": "Shortwave listening",
    "keywords": [
      "shortwave radio",
      "radio broadcasts"
    ]
  },
  {
    "id": "audiophile",
    "label": "Audiophile",
    "keywords": [
      "hi fi",
      "audio"
    ]
  },
  {
    "id": "aircraft-spotting",
    "label": "Aircraft spotting",
    "keywords": [
      "planes",
      "aviation"
    ]
  },
  {
    "id": "amateur-astronomy",
    "label": "Amateur astronomy",
    "keywords": [
      "stargazing",
      "telescopes"
    ]
  },
  {
    "id": "bus-spotting",
    "label": "Bus spotting",
    "keywords": [
      "buses",
      "transit"
    ]
  },
  {
    "id": "gongoozling",
    "label": "Gongoozling",
    "keywords": [
      "canals",
      "boats"
    ]
  },
  {
    "id": "satellite-watching",
    "label": "Satellite watching",
    "keywords": [
      "satellites",
      "night sky"
    ]
  },
  {
    "id": "trainspotting",
    "label": "Trainspotting",
    "keywords": [
      "trains",
      "railways"
    ]
  },
  {
    "id": "whale-watching",
    "label": "Whale watching",
    "keywords": [
      "whales",
      "marine wildlife"
    ]
  }
]
$hobby_catalogue$::jsonb) as hobby(id text, label text, keywords jsonb)
on conflict (id) do update
set keywords = array(
  select distinct keyword
  from unnest(coalesce(existing.keywords, '{}'::text[]) || excluded.keywords) as keyword
  order by keyword
);

-- Existing user_hobbies, projects, communities, and sidequests foreign keys
-- already reference hobby_categories. Keep all of them unchanged.
-- Existing grants and RLS policies are also unchanged.
create or replace function public.save_my_preferences(p_preferences jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Sign in before saving preferences.' using errcode = '42501';
  end if;

  if p_preferences is null or jsonb_typeof(p_preferences) <> 'array' then
    raise exception 'Preferences must be an array.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_preferences) not between 1 and 3 then
    raise exception 'Select between one and three hobbies.' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_preferences) as item(value)
    where jsonb_typeof(item.value) is distinct from 'object'
       or jsonb_typeof(item.value->'hobby') is distinct from 'string'
       or jsonb_typeof(item.value->'experience_level') is distinct from 'string'
       or not exists (
         select 1 from public.hobby_categories as hobby
         where hobby.id = item.value->>'hobby'
       )
       or coalesce(item.value->>'experience_level', '') not in
          ('Beginner', 'Intermediate', 'Advanced', 'Expert')
  ) then
    raise exception 'Invalid hobby or experience level.' using errcode = '22023';
  end if;
  if (select count(distinct (item.value->>'hobby'))
      from jsonb_array_elements(p_preferences) as item(value))
      <> jsonb_array_length(p_preferences) then
    raise exception 'Select each hobby only once.' using errcode = '22023';
  end if;

  insert into public.profiles (id) values (current_user_id)
    on conflict (id) do nothing;

  -- A profile lock makes simultaneous saves replace whole selections in order.
  perform 1 from public.profiles where id = current_user_id for update;
  if not found then
    raise exception 'Profile is not accessible.' using errcode = '42501';
  end if;

  delete from public.user_hobbies where user_id = current_user_id;
  insert into public.user_hobbies (user_id, hobby, experience_level)
    select current_user_id, item.value->>'hobby', item.value->>'experience_level'
    from jsonb_array_elements(p_preferences) as item(value);

  update public.profiles
  set onboarding_completed_at = coalesce(onboarding_completed_at, now())
  where id = current_user_id;
  if not found then
    raise exception 'Profile cannot be updated.' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.save_my_preferences(jsonb) from public, anon;
grant execute on function public.save_my_preferences(jsonb) to authenticated;
notify pgrst, 'reload schema';

commit;
