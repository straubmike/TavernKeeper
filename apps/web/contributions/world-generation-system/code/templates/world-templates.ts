/**
 * World Generation Templates
 * 
 * Templates for generating names, descriptions, and relationships
 * for each level of world generation.
 */

import type {
  PrimordialType,
  CosmicElement,
  GeographyType,
  ConceptualType,
  DemiGodType,
  MortalRaceType,
  OrganizationMagnitude,
  StandoutType,
  RoleType,
  AnimalFeature,
  HalfGodRace,
  AncientCreatureType,
  FallenDivineType,
  PrimordialSpawnType,
} from '../types/world-generation';

/**
 * Name templates for each type
 */
export const NameTemplates = {
  primordial: {
    space: ['The Void', 'The Abyss', 'The Emptiness', 'The Expanse', 'The Nothing', 'The Absence'],
    time: ['The Eternal', 'The Timeless', 'The Chronos', 'The Flow', 'The Infinite', 'The Forever', 'The Endless'],
    light: ['The Radiance', 'The Illumination', 'The Brilliance', 'The Dawn'],
    dark: ['The Shadow', 'The Darkness', 'The Night', 'The Void'],
    order: ['The Balance', 'The Structure', 'The Law', 'The Pattern'],
    chaos: ['The Chaos', 'The Entropy', 'The Disorder', 'The Wild'],
  },

  cosmic: {
    rock: ['Stone Shaper', 'Mountain Forger', 'The Granite One'],
    wind: ['Wind Rider', 'Sky Dancer', 'Storm Bringer'],
    water: ['Deep One', 'Tide Master', 'Wave Song'],
    life: ['Life Giver', 'The Sower', 'The Bloom'],
    fire: ['Flame Keeper', 'Ember Lord', 'Blaze', 'Inferno'],
    earth: ['The Earthen', 'Land Keeper', 'Terra'],
    ice: ['The Frost', 'The Cold One', 'The Glacier'],
    magic: ['The Arcane', 'The Weave', 'The Mystic', 'The Enchanter'],
  },

  geography: {
    continent: [
      'The Northern Wastes', 'The Eastern Lands', 'The Western Reaches', 'The Southern Expanse',
      'The Central Continent', 'The Old World', 'The New World', 'The Great Land',
      'The Uncharted Territories', 'The Known Lands', 'The Far Reaches', 'The Distant Shores',
      'The Middle Realm', 'The Outer Lands', 'The Inner Dominion', 'The Vast Expanse'
    ],
    ocean: [
      'The Endless Sea', 'The Deep Blue', 'The Vast Waters', 'The Great Ocean',
      'The Northern Sea', 'The Southern Ocean', 'The Eastern Waters', 'The Western Deep',
      'The Abyssal Trench', 'The Celestial Sea', 'The Shadowed Depths', 'The Crystal Waters',
      'The Stormy Seas', 'The Calm Ocean', 'The Frozen Waters', 'The Warm Currents'
    ],
    mountain_range: [
      "The Dragon's Spine", "The Titan's Back", 'The Sky Peaks', 'The Cloud Mountains',
      'The Iron Peaks', 'The Thunder Mountains', 'The Crystal Range', 'The Jagged Spires',
      'The Silent Peaks', 'The Wind-Swept Heights', 'The Ancient Crags', 'The Frozen Summits',
      'The Fire-Breathing Range', 'The Storm Peaks', 'The Shadow Mountains', 'The Golden Peaks'
    ],
    river: [
      'The Flowing Path', 'The Silver Stream', 'The River of Life', 'The Stream of Permanence',
      'The Great River', 'The Swift Current', 'The Winding Water', 'The Crystal River',
      'The Blackwater', 'The Blue Current', 'The Golden Stream', 'The Misty River',
      'The Ancient Flow', 'The New Waters', 'The Sacred Stream', 'The Forbidden River'
    ],
    underground_system: [
      'The Deep Tunnels', 'The Underdark', 'The Caverns Below', 'The Subterranean',
      'The Endless Caves', 'The Shadow Depths', 'The Forgotten Halls', 'The Crystal Caverns',
      'The Echoing Tunnels', 'The Dark Depths', 'The Ancient Vaults', 'The Hidden Passages',
      'The Lost Underworld', 'The Deep Below', 'The Endless Depths', 'The Underground Labyrinth'
    ],
    forest: [
      'The Ancient Woods', 'The Whispering Trees', 'The Green Expanse', 'The Wild Forest',
      'The Elderwood', 'The Shadow Forest', 'The Brightwood', 'The Darkwood',
      'The Enchanted Grove', 'The Silent Forest', 'The Singing Trees', 'The Cursed Woods',
      'The Sacred Grove', 'The Lost Forest', 'The Endless Trees', 'The Primordial Woods'
    ],
    desert: [
      'The Endless Sands', 'The Burning Waste', 'The Dry Expanse', 'The Scorched Land',
      'The Red Desert', 'The Golden Dunes', 'The Black Sands', 'The White Wastes',
      'The Shifting Sands', 'The Eternal Desert', 'The Forgotten Waste', 'The Sun-Baked Plains',
      'The Mirage Lands', 'The Salt Flats', 'The Sandstorm Expanse', 'The Oasis Lands'
    ],
    plains: [
      'The Rolling Fields', 'The Grasslands', 'The Wide Expanse', 'The Flatlands',
      'The Golden Plains', 'The Endless Fields', 'The Verdant Meadows', 'The Wind-Swept Plains',
      'The Battle Plains', 'The Peaceful Fields', 'The Harvest Lands', 'The Open Country',
      'The Great Plains', 'The Fertile Fields', 'The Serene Meadows', 'The Boundless Expanse'
    ],
    island: [
      'The Lonely Isle', 'The Hidden Land', 'The Isolated Rock', 'The Secluded Place',
      'The Mysterious Isle', 'The Treasure Island', 'The Forbidden Isle', 'The Sacred Island',
      'The Volcanic Isle', 'The Tropical Paradise', 'The Misty Isle', 'The Crystal Island',
      'The Abandoned Isle', 'The Pirate Haven', 'The Lost Island', 'The Floating Isle'
    ],
    volcano: [
      'Fire Mountain', 'Molten Peak', 'Burning Summit', 'Lava Forge',
      'The Great Volcano', 'The Smoldering Peak', 'The Inferno Mountain', 'The Ash Cone',
      'The Dragon Volcano', 'The Fire-Breathing Peak', 'The Molten Mountain', 'The Cinder Cone',
      'The Eternal Flame', 'The Spitting Mountain', 'The Living Fire', 'The Rumbling Peak'
    ],
    swamp: [
      'The Murky Bog', 'The Fetid Marsh', 'The Dark Swamp', 'The Mire',
      'The Cursed Swamp', 'The Black Marsh', 'The Whispering Bog', 'The Lost Mire',
      'The Shadowed Swamp', 'The Ancient Bog', 'The Treacherous Marsh', 'The Poisoned Mire',
      'The Haunted Swamp', 'The Eternal Bog', 'The Swamp of Sorrows', 'The Misty Marsh'
    ],
    tundra: [
      'The Frozen Waste', 'The Ice Fields', 'The Permafrost', 'The Cold Expanse',
      'The White Wastes', 'The Endless Tundra', 'The Frozen Plains', 'The Ice-Bound Land',
      'The Northern Tundra', 'The Silent Frost', 'The Bitter Cold', 'The Frozen Expanse',
      'The Perpetual Winter', 'The Ice Realm', 'The Frozen Frontier', 'The Endless Winter'
    ],
    canyon: [
      'The Great Chasm', 'The Deep Canyon', 'The Ravine', 'The Gorge',
      'The Grand Canyon', 'The Endless Chasm', 'The Echoing Canyon', 'The Shadowed Gorge',
      'The Red Canyon', 'The Carved Ravine', 'The Ancient Chasm', 'The Wind-Swept Gorge',
      'The Bottomless Pit', 'The Hidden Canyon', 'The Sacred Gorge', 'The Forbidden Chasm'
    ],
    archipelago: [
      'The Island Chain', 'The Broken Isles', 'The Scattered Lands', 'The Cluster',
      'The Thousand Isles', 'The Island Kingdom', 'The Seafaring Isles', 'The Distant Archipelago',
      'The Mystic Isles', 'The Trading Islands', 'The Lost Archipelago', 'The Hidden Chain',
      'The Storm Isles', 'The Emerald Archipelago', 'The Coral Islands', 'The Floating Chain'
    ],
    fjord: [
      'The Deep Fjord', 'The Ice Fjord', 'The Northern Inlet', 'The Carved Bay',
      'The Narrow Fjord', 'The Endless Fjord', 'The Crystal Fjord', 'The Misty Inlet',
      'The Ancient Fjord', 'The Hidden Inlet', 'The Shadowed Bay', 'The Northern Passage',
      'The Great Fjord', 'The Silent Inlet', 'The Stormy Fjord', 'The Peaceful Bay'
    ],
    steppe: [
      'The Open Steppe', 'The Grass Sea', 'The Wide Plains', 'The Endless Grass',
      'The Golden Steppe', 'The Wind-Ridden Plains', 'The Nomad Lands', 'The Free Steppe',
      'The Endless Horizon', 'The Vast Steppe', 'The Rolling Grass', 'The Boundless Plains',
      'The Ancient Steppe', 'The Wild Plains', 'The Sacred Grass', 'The Northern Steppe'
    ],
    jungle: [
      'The Dense Jungle', 'The Overgrown Wilds', 'The Lush Canopy', 'The Green Hell',
      'The Untamed Jungle', 'The Vicious Wilds', 'The Shadowed Canopy', 'The Thick Jungle',
      'The Lost Jungle', 'The Cursed Wilds', 'The Ancient Canopy', 'The Living Jungle',
      'The Perilous Wilds', 'The Endless Jungle', 'The Hidden Canopy', 'The Primordial Wilds'
    ],
    badlands: [
      'The Barren Badlands', 'The Eroded Waste', 'The Broken Land', 'The Desolate',
      'The Red Badlands', 'The Cursed Waste', 'The Shattered Land', 'The Forbidden Badlands',
      'The Eroded Expanse', 'The Broken Waste', 'The Lost Badlands', 'The Bleak Land',
      'The Endless Badlands', 'The Ancient Waste', 'The Deadly Expanse', 'The Barren Expanse'
    ],
    glacier: [
      'The Great Glacier', 'The Ice Sheet', 'The Frozen River', 'The Ice Wall',
      'The Eternal Glacier', 'The Moving Ice', 'The Blue Glacier', 'The Ancient Ice',
      'The Creeping Glacier', 'The Silent Ice', 'The Towering Glacier', 'The Endless Ice',
      'The Frozen Cascade', 'The Ice Realm', 'The Perpetual Ice', 'The Glacial Expanse'
    ],
    marsh: [
      'The Wet Marsh', 'The Reedy Marsh', 'The Boggy Ground', 'The Soggy Land',
      'The Quagmire', 'The Wetlands', 'The Marshy Expanse', 'The Reedy Bog',
      'The Shallow Marsh', 'The Deep Marsh', 'The Hidden Wetlands', 'The Lost Bog',
      'The Ancient Marsh', 'The Shadowed Wetlands', 'The Endless Marsh', 'The Treacherous Bog'
    ],
    plateau: [
      'The High Plateau', 'The Pedestal', 'The Table', 'The Mesa',
      'The Sky Plateau', 'The Elevated Table', 'The Stone Mesa', 'The Ancient Plateau',
      'The Wind-Swept Mesa', 'The Hidden Plateau', 'The Sacred Table', 'The Lost Mesa',
      'The Great Plateau', 'The Endless Table', 'The Mystic Mesa', 'The Towering Plateau'
    ],
    coast: [
      'The Rocky Coast', 'The Sandy Shore', 'The Cliff Coast', 'The Coastal Edge',
      'The Rugged Coast', 'The Golden Beach', 'The Stormy Shore', 'The Peaceful Coast',
      'The Jagged Coast', 'The White Cliffs', 'The Hidden Cove', 'The Exposed Shore',
      'The Endless Coast', 'The Ancient Shoreline', 'The Wild Coast', 'The Serene Beach'
    ],
    bay: [
      'The Sheltered Bay', 'The Deep Bay', 'The Calm Harbor', 'The Protected Inlet',
      'The Safe Harbor', 'The Wide Bay', 'The Hidden Cove', 'The Peaceful Bay',
      'The Trading Harbor', 'The Sacred Bay', 'The Lost Cove', 'The Ancient Harbor',
      'The Golden Bay', 'The Misty Cove', 'The Endless Bay', 'The Secret Harbor'
    ],
    peninsula: [
      'The Long Peninsula', 'The Narrow Land', 'The Jutting Land', 'The Extended Shore',
      'The Curved Peninsula', 'The Thin Strip', 'The Extended Reach', 'The Pointed Land',
      'The Ancient Peninsula', 'The Lost Strip', 'The Hidden Reach', 'The Sacred Point',
      'The Endless Peninsula', 'The Narrow Reach', 'The Jutting Point', 'The Extended Strip'
    ],
  },

  conceptual: {
    luck: ['Lady Fortune', 'The Fortunate One', 'The Chance Bringer', 'The Lucky'],
    love: ["The Heart's Desire", 'The Love Bringer', 'The Passion', 'The Beloved'],
    fertility: ['The Harvest Mother', 'The Growth Keeper', 'The Fertile One', 'The Bountiful'],
    justice: ['The Just One', 'The Balance Keeper', 'The Law Giver', 'The Fair'],
    war: ['The War Bringer', 'The Battle Lord', 'The Conflict', 'The Warrior'],
    death: ['The Reaper', 'The End Bringer', 'The Final One', 'The Death Keeper'],
    wisdom: ['The Wise One', 'The Knowledge Keeper', 'The Sage', 'The Learned'],
    wealth: ['The Gold Keeper', 'The Treasure Lord', 'The Wealthy', 'The Rich'],
    art: ['The Artisan', 'The Creator', 'The Beauty Bringer', 'The Artist'],
    music: ['The Song Keeper', 'The Melody', 'The Harmony', 'The Singer'],
    craft: ['The Maker', 'The Crafter', 'The Builder', 'The Artisan'],
    hunting: ['The Hunter', 'The Stalker', 'The Pursuer', 'The Tracker'],
    harvest: ['The Reaper', 'The Gatherer', 'The Harvester', 'The Collector'],
    blood: ['The Blood God', 'The Crimson One', 'The Life Taker', 'The Red Lord'],
    party: ['The Reveler', 'The Celebration', 'The Festive One', 'The Joy Bringer'],
    sacrifice: ['The Sacrifice', 'The Offering', 'The Given One', 'The Devoted'],
    vengeance: ['The Avenger', 'The Retribution', 'The Vengeful', 'The Wrath'],
    mercy: ['The Merciful', 'The Compassionate', 'The Forgiving', 'The Kind'],
    betrayal: ['The Betrayer', 'The Traitor', 'The Deceiver', 'The False One'],
    loyalty: ['The Loyal', 'The Faithful', 'The Devoted', 'The True'],
    honor: ['The Honorable', 'The Noble', 'The Just', 'The Righteous'],
    courage: ['The Brave', 'The Courageous', 'The Valiant', 'The Fearless'],
    fear: ['The Fearful', 'The Dread', 'The Terror', 'The Fright'],
    madness: ['The Mad', 'The Insane', 'The Crazed', 'The Unhinged'],
    healing: ['The Healer', 'The Restorer', 'The Mender', 'The Cure'],
    disease: ['The Plague', 'The Sickness', 'The Affliction', 'The Blight'],
    plague: ['The Pestilence', 'The Contagion', 'The Scourge', 'The Epidemic'],
    famine: ['The Hunger', 'The Starvation', 'The Want', 'The Scarcity'],
    feast: ['The Feaster', 'The Abundance', 'The Bounty', 'The Plenty'],
    celebration: ['The Celebrant', 'The Festive', 'The Joyous', 'The Merry'],
    mourning: ['The Mourner', 'The Grieving', 'The Sorrowful', 'The Lament'],
    grief: ['The Grief', 'The Sorrow', 'The Sadness', 'The Woe'],
    joy: ['The Joy', 'The Happiness', 'The Delight', 'The Bliss'],
    rage: ['The Rage', 'The Fury', 'The Wrath', 'The Anger'],
    peace: ['The Peace', 'The Tranquil', 'The Calm', 'The Serene'],
    chaos: ['The Chaos', 'The Disorder', 'The Entropy', 'The Anarchy'],
    order: ['The Order', 'The Structure', 'The Law', 'The Pattern'],
    freedom: ['The Free', 'The Liberator', 'The Unbound', 'The Independent'],
    tyranny: ['The Tyrant', 'The Oppressor', 'The Despot', 'The Dictator'],
    hope: ['The Hope', 'The Optimist', 'The Believer', 'The Aspiring'],
    despair: ['The Despair', 'The Hopeless', 'The Despondent', 'The Forlorn'],
    truth: ['The Truth', 'The Honest', 'The Veracious', 'The Sincere'],
    lies: ['The Liar', 'The Deceiver', 'The False', 'The Untruthful'],
    secrets: ['The Secret Keeper', 'The Hidden', 'The Concealed', 'The Mysterious'],
    knowledge: ['The Knowledge', 'The Learned', 'The Wise', 'The Knowing'],
    ignorance: ['The Ignorant', 'The Unknowing', 'The Unaware', 'The Naive'],
    beauty: ['The Beautiful', 'The Fair', 'The Lovely', 'The Graceful'],
    ugliness: ['The Ugly', 'The Foul', 'The Hideous', 'The Repulsive'],
    strength: ['The Strong', 'The Mighty', 'The Powerful', 'The Forceful'],
    weakness: ['The Weak', 'The Feeble', 'The Frail', 'The Powerless'],
    cunning: ['The Cunning', 'The Clever', 'The Sly', 'The Shrewd'],
    stupidity: ['The Fool', 'The Simple', 'The Dull', 'The Unwise'],
    trade: ['The Merchant', 'The Trader', 'The Exchange', 'The Barter'],
    forge: ['The Forge Master', 'The Fire Shaper', 'The Hammer', 'The Anvil'],
    stone: ['The Stone Keeper', 'The Rock Shaper', 'The Granite', 'The Foundation'],
    metal: ['The Metal Smith', 'The Ore Master', 'The Iron Forge', 'The Steel'],
    mining: ['The Miner', 'The Delver', 'The Digger', 'The Prospector'],
    smithing: ['The Smith', 'The Artisan', 'The Maker', 'The Craft Master'],
    nature: ['The Nature Keeper', 'The Wild', 'The Natural', 'The Green'],
    forest: ['The Forest Lord', 'The Wood Keeper', 'The Grove', 'The Canopy'],
    magic: ['The Magic', 'The Arcane', 'The Mystic', 'The Enchanted'],
    life: ['The Life Giver', 'The Vital', 'The Living', 'The Breath'],
    growth: ['The Growth', 'The Blooming', 'The Flourishing', 'The Thriving'],
    battle: ['The Battle', 'The Combat', 'The Clash', 'The Conflict'],
    fury: ['The Fury', 'The Wrathful', 'The Furious', 'The Enraged'],
    beasts: ['The Beast Lord', 'The Wild', 'The Primal', 'The Animal'],
    trickery: ['The Trickster', 'The Deceiver', 'The Mischief', 'The Rogue'],
    stealth: ['The Shadow', 'The Hidden', 'The Unseen', 'The Silent'],
    greed: ['The Greedy', 'The Avaricious', 'The Covetous', 'The Grasping'],
    darkness: ['The Dark', 'The Shadow', 'The Night', 'The Black'],
    mischief: ['The Mischief', 'The Prankster', 'The Rascal', 'The Scamp'],
    comfort: ['The Comfort', 'The Cozy', 'The Warmth', 'The Ease'],
    home: ['The Hearth', 'The Home', 'The Hearth Keeper', 'The Homestead'],
    community: ['The Community', 'The Gathering', 'The Together', 'The Unity'],
    stories: ['The Storyteller', 'The Tale Keeper', 'The Narrative', 'The Legend'],
    invention: ['The Inventor', 'The Creator', 'The Innovator', 'The Designer'],
    curiosity: ['The Curious', 'The Seeker', 'The Wonderer', 'The Explorer'],
    tinkering: ['The Tinkerer', 'The Gadgeteer', 'The Fixer', 'The Mechanic'],
    wonder: ['The Wonder', 'The Marvel', 'The Astonishing', 'The Amazing'],
    survival: ['The Survivor', 'The Enduring', 'The Persevering', 'The Resilient'],
    traps: ['The Trap Master', 'The Snare', 'The Ambush', 'The Pit'],
    caves: ['The Cave Dweller', 'The Burrow', 'The Den', 'The Hollow'],
    hoarding: ['The Hoarder', 'The Collector', 'The Accumulator', 'The Gatherer'],
    servitude: ['The Servant', 'The Subservient', 'The Obedient', 'The Duty'],
    power: ['The Power', 'The Mighty', 'The Dominant', 'The Authority'],
    treasure: ['The Treasure', 'The Hoard', 'The Wealth', 'The Riches'],
    dominance: ['The Dominator', 'The Ruler', 'The Master', 'The Overlord'],
    ancient: ['The Ancient', 'The Old One', 'The Timeless', 'The Primeval'],
    sky: ['The Sky', 'The Heavens', 'The Firmament', 'The Celestial'],
    wind: ['The Wind', 'The Breeze', 'The Gust', 'The Gale'],
    travel: ['The Traveler', 'The Wanderer', 'The Journey', 'The Path'],
    heights: ['The Heights', 'The Summit', 'The Peak', 'The Elevation'],
    sea: ['The Sea', 'The Deep', 'The Ocean', 'The Waters'],
    water: ['The Water', 'The Flow', 'The Current', 'The Tide'],
    depths: ['The Depths', 'The Abyss', 'The Deep', 'The Underwater'],
    currents: ['The Current', 'The Flow', 'The Stream', 'The Rush'],
    mysteries: ['The Mystery', 'The Enigma', 'The Unknown', 'The Secret'],
  },

  demigod: {
    half_god: ['The Divine Child', 'The Half-Born', 'The Divine Mortal', 'The God-Touched'],
    ancient_creature: ['The First One', 'The Ancient', 'The Oldest', 'The Primeval'],
    divine_experiment: ['The Created', 'The Experiment', 'The Forged', 'The Made'],
    fallen_divine: ['The Fallen', 'The Cast Out', 'The Banished', 'The Exiled'],
    ascended_mortal: ['The Ascended', 'The Risen', 'The Elevated', 'The Transcended'],
    primordial_spawn: ['The Spawn', 'The Offspring', 'The Child', 'The Descendant'],
  },

  organization: {
    empire: ['The Great Empire', 'The Vast Dominion', 'The Grand Realm', 'The Mighty Empire'],
    kingdom: ['The Kingdom of', 'The Realm of', 'The Domain of', 'The Land of'],
    horde: ['The Red Horde', 'The War Horde', 'The Battle Horde', 'The Fierce Horde'],
    realm: ['The Elven Realm', 'The Fey Realm', 'The Mystic Realm', 'The Enchanted Realm'],
    city: ['The City of', 'The Great City of', 'The Fortress of', 'The Metropolis of'],
    town: ['The Town of', 'The Settlement of', 'The Village of', 'The Hamlet of'],
    tribe: ['The Tribe of', 'The Clan of', 'The People of', 'The Folk of'],
    guild: ["The Mage's Guild", "The Thieves' Guild", "The Warriors' Guild", "The Merchants' Guild"],
    band: ['The Band of', 'The Company of', 'The Group of', 'The Crew of'],
    clan: ['The Clan of', 'The House of', 'The Family of', 'The Line of'],
    circle: ['The Circle of', 'The Order of', 'The Fellowship of', 'The Brotherhood of'],
    company: ['The Company of', 'The Band of', 'The Group of', 'The Crew of'],
  },

  standout: {
    hero: ['The Brave', 'The Valiant', 'The Hero', 'The Champion'],
    villain: ['The Dark One', 'The Evil', 'The Malicious', 'The Wicked'],
    wizard: ['Archmage', 'Grand Wizard', 'Master Mage', 'The Sorcerer'],
    king: ['King', 'The King', 'The Ruler', 'The Monarch'],
    war_chief: ['War Chief', 'The Warlord', 'The Battle Leader', 'The Commander'],
    vampire: ['The Vampire', 'The Blood Drinker', 'The Night Walker', 'The Immortal'],
    lich: ['The Lich', 'The Undead Lord', 'The Death Keeper', 'The Necromancer'],
    dragon_lord: ['Dragon Lord', 'The Wyrm', 'The Great Dragon', 'The Dragon King'],
    dungeon_boss: ['The Guardian', 'The Keeper', 'The Warden', 'The Protector'],
    archmage: ['Archmage', 'The Archmage', 'Master of Magic', 'The Supreme Mage'],
    high_priest: ['High Priest', 'The High Priest', 'The Cleric', 'The Divine'],
    master_thief: ['Master Thief', 'The Shadow', 'The Rogue', 'The Stealth'],
    legendary_warrior: ['The Legend', 'The Warrior', 'The Champion', 'The Hero'],
    prince: ['Prince', 'The Prince', 'The Royal Heir', 'The Crown Prince'],
    princess: ['Princess', 'The Princess', 'The Royal Daughter', 'The Crown Princess'],
    commander: ['Commander', 'The Commander', 'The Leader', 'The Captain'],
    witch: ['The Witch', 'The Sorceress', 'The Enchantress', 'The Hex'],
    warlock: ['The Warlock', 'The Pact-Bound', 'The Dark Mage', 'The Bound One'],
    sorcerer: ['The Sorcerer', 'The Spellcaster', 'The Magic User', 'The Arcane'],
    druid: ['The Druid', 'The Nature Keeper', 'The Wild One', 'The Green'],
    ranger_lord: ['Ranger Lord', 'The Master Ranger', 'The Wild Lord', 'The Forest King'],
    paladin: ['The Paladin', 'The Holy Warrior', 'The Divine Champion', 'The Righteous'],
    cleric: ['The Cleric', 'The Priest', 'The Divine', 'The Holy One'],
    monk: ['The Monk', 'The Ascetic', 'The Disciplined', 'The Enlightened'],
    barbarian_chieftain: ['Barbarian Chieftain', 'The Savage Leader', 'The Wild Chief', 'The Fierce'],
    rogue_master: ['Rogue Master', 'The Shadow Master', 'The Thief Lord', 'The Stealth King'],
    bard_master: ['Bard Master', 'The Master Bard', 'The Song Lord', 'The Storyteller'],
    queen: ['Queen', 'The Queen', 'The Ruler', 'The Monarch'],
    empress: ['Empress', 'The Empress', 'The Great Ruler', 'The Imperial'],
    emperor: ['Emperor', 'The Emperor', 'The Great King', 'The Imperial'],
    duke: ['Duke', 'The Duke', 'The Noble Lord', 'The High Noble'],
    duchess: ['Duchess', 'The Duchess', 'The Noble Lady', 'The High Noble'],
    baron: ['Baron', 'The Baron', 'The Lord', 'The Noble'],
    baroness: ['Baroness', 'The Baroness', 'The Lady', 'The Noble'],
    count: ['Count', 'The Count', 'The Noble', 'The Lord'],
    countess: ['Countess', 'The Countess', 'The Noble Lady', 'The Lady'],
    shaman: ['The Shaman', 'The Spirit Walker', 'The Tribal Mystic', 'The Spirit Keeper'],
    oracle: ['The Oracle', 'The Seer', 'The Prophet', 'The Visionary'],
    prophet: ['The Prophet', 'The Foreteller', 'The Seer', 'The Visionary'],
    necromancer: ['The Necromancer', 'The Death Mage', 'The Undead Master', 'The Death Caller'],
    enchanter: ['The Enchanter', 'The Enchantment Master', 'The Charmer', 'The Bewitcher'],
    alchemist: ['The Alchemist', 'The Transmuter', 'The Potion Master', 'The Mixer'],
    artificer: ['The Artificer', 'The Maker', 'The Creator', 'The Builder'],
    inquisitor: ['The Inquisitor', 'The Questioner', 'The Investigator', 'The Seeker'],
    templar: ['The Templar', 'The Holy Knight', 'The Divine Warrior', 'The Sacred'],
    crusader: ['The Crusader', 'The Holy Warrior', 'The Zealot', 'The Devoted'],
    assassin_master: ['Assassin Master', 'The Master Killer', 'The Shadow Lord', 'The Death Dealer'],
    spymaster: ['The Spymaster', 'The Master of Secrets', 'The Intelligence Lord', 'The Shadow'],
    general: ['The General', 'The War Leader', 'The Battle Commander', 'The Strategist'],
    admiral: ['The Admiral', 'The Fleet Commander', 'The Sea Lord', 'The Naval Leader'],
    marshal: ['The Marshal', 'The Field Commander', 'The Battle Marshal', 'The War Leader'],
    champion: ['The Champion', 'The Victor', 'The Winner', 'The Best'],
    gladiator: ['The Gladiator', 'The Arena Fighter', 'The Combatant', 'The Warrior'],
    arena_master: ['Arena Master', 'The Arena Lord', 'The Fight Master', 'The Combat Master'],
    guildmaster: ['Guildmaster', 'The Guild Lord', 'The Master', 'The Leader'],
    thane: ['Thane', 'The Thane', 'The Noble', 'The Lord'],
    jarl: ['Jarl', 'The Jarl', 'The Chieftain', 'The Leader'],
    chieftain: ['Chieftain', 'The Chieftain', 'The Tribal Leader', 'The Chief'],
    elder: ['The Elder', 'The Old One', 'The Wise One', 'The Ancient'],
    matriarch: ['The Matriarch', 'The Mother Leader', 'The Female Ruler', 'The Head'],
    patriarch: ['The Patriarch', 'The Father Leader', 'The Male Ruler', 'The Head'],
  },

  role: {
    blacksmith: ['Blacksmith', 'Forge Master', 'Metal Worker', 'Smith'],
    playwright: ['Playwright', 'Bard', 'Storyteller', 'Dramatist'],
    assassin: ['Assassin', 'Shadow', 'Killer', 'Blade'],
    merchant: ['Merchant', 'Trader', 'Trader', 'Vendor'],
    farmer: ['Farmer', 'Cultivator', 'Grower', 'Tiller'],
    soldier: ['Soldier', 'Warrior', 'Fighter', 'Guard'],
    scholar: ['Scholar', 'Sage', 'Learned One', 'Academic'],
    priest: ['Priest', 'Cleric', 'Divine', 'Holy One'],
    noble: ['Noble', 'Lord', 'Lady', 'Aristocrat'],
    commoner: ['Commoner', 'Citizen', 'Person', 'Individual'],
    artisan: ['Artisan', 'Craftsman', 'Maker', 'Creator'],
    bard: ['Bard', 'Minstrel', 'Singer', 'Poet'],
    ranger: ['Ranger', 'Scout', 'Tracker', 'Hunter'],
    knight: ['Knight', 'Warrior', 'Champion', 'Paladin'],
    sailor: ['Sailor', 'Seafarer', 'Mariner', 'Seaman'],
    fisherman: ['Fisherman', 'Angler', 'Fisher', 'Net Caster'],
    guard: ['Guard', 'Watchman', 'Sentinel', 'Protector'],
    shepherd: ['Shepherd', 'Herder', 'Sheep Keeper', 'Pastoral'],
    carpenter: ['Carpenter', 'Woodworker', 'Builder', 'Joiner'],
    mason: ['Mason', 'Stoneworker', 'Stonemason', 'Builder'],
    weaver: ['Weaver', 'Textile Worker', 'Cloth Maker', 'Loom Worker'],
    tailor: ['Tailor', 'Seamstress', 'Clothier', 'Garment Maker'],
    cook: ['Cook', 'Chef', 'Kitchen Worker', 'Food Preparer'],
    baker: ['Baker', 'Bread Maker', 'Pastry Chef', 'Oven Worker'],
    brewer: ['Brewer', 'Ale Maker', 'Beer Master', 'Fermenter'],
    innkeeper: ['Innkeeper', 'Tavern Keeper', 'Host', 'Publican'],
    stablemaster: ['Stablemaster', 'Horse Keeper', 'Stable Keeper', 'Groom'],
    herbalist: ['Herbalist', 'Herb Gatherer', 'Plant Expert', 'Botanist'],
    apothecary: ['Apothecary', 'Medicine Maker', 'Potion Maker', 'Healer'],
    scribe: ['Scribe', 'Writer', 'Copyist', 'Record Keeper'],
    librarian: ['Librarian', 'Book Keeper', 'Archive Keeper', 'Scholar'],
    teacher: ['Teacher', 'Instructor', 'Educator', 'Master'],
    student: ['Student', 'Learner', 'Pupil', 'Apprentice'],
    apprentice: ['Apprentice', 'Learner', 'Trainee', 'Novice'],
    master: ['Master', 'Expert', 'Professional', 'Skilled'],
    journeyman: ['Journeyman', 'Skilled Worker', 'Craftsman', 'Tradesman'],
    miner: ['Miner', 'Digger', 'Tunnel Worker', 'Extractor'],
    jeweler: ['Jeweler', 'Gem Worker', 'Jewel Maker', 'Goldsmith'],
    leatherworker: ['Leatherworker', 'Tanner', 'Leather Maker', 'Hide Worker'],
    fletcher: ['Fletcher', 'Arrow Maker', 'Shaft Maker', 'Arrow Smith'],
    bowyer: ['Bowyer', 'Bow Maker', 'Archery Craftsman', 'Bow Smith'],
    tanner: ['Tanner', 'Hide Tanner', 'Leather Preparer', 'Hide Worker'],
    cooper: ['Cooper', 'Barrel Maker', 'Cask Maker', 'Container Maker'],
    wheelwright: ['Wheelwright', 'Wheel Maker', 'Cart Builder', 'Wagon Maker'],
    miller: ['Miller', 'Grain Grinder', 'Mill Worker', 'Flour Maker'],
    butcher: ['Butcher', 'Meat Cutter', 'Slaughterer', 'Meat Seller'],
    hunter: ['Hunter', 'Tracker', 'Stalker', 'Game Seeker'],
    trapper: ['Trapper', 'Fur Trapper', 'Trap Setter', 'Fur Gatherer'],
    forester: ['Forester', 'Forest Keeper', 'Woodsman', 'Tree Expert'],
    lumberjack: ['Lumberjack', 'Wood Cutter', 'Logger', 'Tree Feller'],
    quarryman: ['Quarryman', 'Stone Quarry Worker', 'Rock Extractor', 'Mason'],
    stonemason: ['Stonemason', 'Stone Worker', 'Mason', 'Builder'],
    roofer: ['Roofer', 'Thatcher', 'Roof Builder', 'Tiler'],
    plumber: ['Plumber', 'Pipe Worker', 'Water Worker', 'Installation Worker'],
    tinker: ['Tinker', 'Repairer', 'Fixer', 'Mender'],
    peddler: ['Peddler', 'Traveling Merchant', 'Itinerant Seller', 'Hawker'],
    vendor: ['Vendor', 'Seller', 'Merchant', 'Trader'],
    shopkeeper: ['Shopkeeper', 'Store Owner', 'Merchant', 'Retailer'],
    banker: ['Banker', 'Money Keeper', 'Financial Manager', 'Lender'],
    moneylender: ['Moneylender', 'Usurer', 'Loan Provider', 'Creditor'],
    diplomat: ['Diplomat', 'Ambassador', 'Negotiator', 'Envoy'],
    envoy: ['Envoy', 'Messenger', 'Representative', 'Delegate'],
    messenger: ['Messenger', 'Courier', 'Runner', 'Herald'],
    courier: ['Courier', 'Message Bearer', 'Delivery Person', 'Runner'],
    scout: ['Scout', 'Reconnaissance', 'Explorer', 'Pathfinder'],
    spy: ['Spy', 'Informer', 'Intelligence Agent', 'Secret Agent'],
    watchman: ['Watchman', 'Guard', 'Sentry', 'Lookout'],
    sheriff: ['Sheriff', 'Law Keeper', 'Peace Officer', 'Constable'],
    judge: ['Judge', 'Magistrate', 'Arbiter', 'Justice'],
    lawyer: ['Lawyer', 'Advocate', 'Legal Advisor', 'Counselor'],
    bailiff: ['Bailiff', 'Court Officer', 'Law Enforcer', 'Officer'],
    executioner: ['Executioner', 'Headsman', 'Death Dealer', 'Killer'],
    torturer: ['Torturer', 'Interrogator', 'Questioner', 'Extractor'],
    jailer: ['Jailer', 'Prison Keeper', 'Warden', 'Guard'],
    tax_collector: ['Tax Collector', 'Revenue Agent', 'Collector', 'Assessor'],
    bureaucrat: ['Bureaucrat', 'Administrator', 'Official', 'Clerk'],
    clerk: ['Clerk', 'Record Keeper', 'Secretary', 'Administrator'],
    accountant: ['Accountant', 'Bookkeeper', 'Financial Recorder', 'Auditor'],
    steward: ['Steward', 'Manager', 'Administrator', 'Overseer'],
    chamberlain: ['Chamberlain', 'Household Manager', 'Administrator', 'Steward'],
    butler: ['Butler', 'Household Servant', 'Head Servant', 'Steward'],
    maid: ['Maid', 'Servant', 'Housekeeper', 'Domestic'],
    servant: ['Servant', 'Attendant', 'Helper', 'Domestic'],
    slave: ['Slave', 'Bondservant', 'Bonded', 'Enslaved'],
    serf: ['Serf', 'Bonded Worker', 'Tied to Land', 'Peasant'],
    peasant: ['Peasant', 'Commoner', 'Farmer', 'Rural Worker'],
    laborer: ['Laborer', 'Worker', 'Manual Worker', 'Day Laborer'],
    dockworker: ['Dockworker', 'Longshoreman', 'Port Worker', 'Harbor Worker'],
    porter: ['Porter', 'Carrier', 'Loader', 'Bearer'],
    carter: ['Carter', 'Cart Driver', 'Wagon Driver', 'Transport Worker'],
    coachman: ['Coachman', 'Carriage Driver', 'Coach Driver', 'Driver'],
    groom: ['Groom', 'Horse Handler', 'Stable Worker', 'Horse Keeper'],
    stablehand: ['Stablehand', 'Stable Worker', 'Horse Caretaker', 'Groom'],
    squire: ['Squire', 'Knight\'s Assistant', 'Page', 'Attendant'],
    page: ['Page', 'Young Attendant', 'Squire', 'Servant'],
    herald: ['Herald', 'Announcer', 'Messenger', 'Proclaimer'],
    minstrel: ['Minstrel', 'Entertainer', 'Singer', 'Bard'],
    jester: ['Jester', 'Fool', 'Entertainer', 'Court Fool'],
    fool: ['Fool', 'Jester', 'Entertainer', 'Court Jester'],
    entertainer: ['Entertainer', 'Performer', 'Actor', 'Showman'],
    dancer: ['Dancer', 'Performer', 'Movement Artist', 'Entertainer'],
    acrobat: ['Acrobat', 'Tumbler', 'Performer', 'Athlete'],
    performer: ['Performer', 'Entertainer', 'Actor', 'Artist'],
    actor: ['Actor', 'Performer', 'Thespian', 'Player'],
    poet: ['Poet', 'Verse Maker', 'Wordsmith', 'Bard'],
    author: ['Author', 'Writer', 'Novelist', 'Scribe'],
    historian: ['Historian', 'Chronicler', 'Record Keeper', 'Scholar'],
    chronicler: ['Chronicler', 'Historian', 'Record Keeper', 'Scribe'],
    cartographer: ['Cartographer', 'Map Maker', 'Chart Maker', 'Surveyor'],
    navigator: ['Navigator', 'Pilot', 'Guide', 'Pathfinder'],
    shipwright: ['Shipwright', 'Ship Builder', 'Boat Maker', 'Naval Builder'],
    sailmaker: ['Sailmaker', 'Sail Worker', 'Canvas Worker', 'Sailor'],
    ropemaker: ['Ropemaker', 'Cord Maker', 'Rope Worker', 'Twister'],
    netmaker: ['Netmaker', 'Net Weaver', 'Fishing Net Maker', 'Weaver'],
    fishmonger: ['Fishmonger', 'Fish Seller', 'Seafood Merchant', 'Fish Trader'],
    grocer: ['Grocer', 'Food Merchant', 'Provisioner', 'Food Seller'],
    greengrocer: ['Greengrocer', 'Vegetable Seller', 'Produce Merchant', 'Fruit Seller'],
    spice_merchant: ['Spice Merchant', 'Spice Trader', 'Spice Seller', 'Spice Dealer'],
    cloth_merchant: ['Cloth Merchant', 'Fabric Seller', 'Textile Trader', 'Cloth Dealer'],
    grain_merchant: ['Grain Merchant', 'Grain Trader', 'Cereal Seller', 'Grain Dealer'],
    livestock_merchant: ['Livestock Merchant', 'Animal Trader', 'Cattle Dealer', 'Livestock Seller'],
    horse_trader: ['Horse Trader', 'Horse Dealer', 'Equine Merchant', 'Horse Seller'],
    slave_trader: ['Slave Trader', 'Slave Dealer', 'Human Trafficker', 'Bondservant Seller'],
    smuggler: ['Smuggler', 'Contraband Trader', 'Illegal Merchant', 'Secret Trader'],
    pirate: ['Pirate', 'Raider', 'Sea Robber', 'Buccaneer'],
    bandit: ['Bandit', 'Highwayman', 'Robber', 'Outlaw'],
    thief: ['Thief', 'Robber', 'Stealer', 'Criminal'],
    pickpocket: ['Pickpocket', 'Thief', 'Purse Snatcher', 'Stealer'],
    burglar: ['Burglar', 'House Breaker', 'Thief', 'Intruder'],
  },
};

/**
 * Description templates
 */
export function getPrimordialDescription(type: PrimordialType, name: string): string {
  const descriptions: Record<PrimordialType, string> = {
    space: `${name} is the fundamental force of space itself, the emptiness between all things, the nothingness and absence that contains existence.`,
    time: `${name} is the eternal flow of time, the progression of moments from past to future, the infinite and endless.`,
    light: `${name} is the radiance that illuminates all, the source of vision and clarity.`,
    dark: `${name} is the shadow that conceals, the absence of light and the unknown.`,
    order: `${name} is the structure and pattern that brings stability to chaos.`,
    chaos: `${name} is the entropy and disorder that breaks down all structure.`,
  };
  return descriptions[type] || `${name} is a primordial force of the universe.`;
}

export function getCosmicDescription(element: CosmicElement, name: string, createdBy: string): string {
  const descriptions: Record<CosmicElement, string> = {
    rock: `${name} shaped the mountains and stones of the world, forging the very foundation of the land.`,
    wind: `${name} breathed life into the skies, creating the winds and storms that move across the world.`,
    water: `${name} filled the oceans and rivers, bringing the flow of life to all corners of the world.`,
    life: `${name} seeded the world with living things, bringing forth all mortal races and creatures.`,
    fire: `${name} kindled the flames of creation, bringing warmth and light to the world.`,
    earth: `${name} molded the soil and ground, creating the fertile earth that sustains life.`,
    ice: `${name} shaped the frozen lands, creating glaciers and tundras in the coldest regions.`,
    magic: `${name} wove magic throughout the world, infusing the very fabric of reality with mystical power and arcane energy.`,
  };
  return descriptions[element] || `${name} is a cosmic creator of ${element}.`;
}

export function getGeographyDescription(
  geographyType: GeographyType,
  name: string,
  createdBy: string
): string {
  const base = `${name} is a ${geographyType.replace('_', ' ')}`;
  return `${base}, shaped by the cosmic forces that created the world.`;
}

/**
 * Get description for a demi-god based on type and subtype
 */
export function getDemiGodDescription(
  demiGodType: string,
  name: string,
  origin: string,
  subtype?: {
    halfGodRace?: HalfGodRace | string;
    ancientCreatureType?: AncientCreatureType | string;
    divineExperimentFeatures?: AnimalFeature[] | string[];
    fallenDivineType?: FallenDivineType | string;
    primordialSpawnType?: PrimordialSpawnType | string;
  }
): string {
  switch (demiGodType) {
    case 'half_god':
      const race = subtype?.halfGodRace || 'mortal';
      return `${name} is a half-divine being, born of divine essence and ${race} blood, bridging the mortal and divine realms.`;
    
    case 'ancient_creature':
      const creatureType = subtype?.ancientCreatureType || 'ancient being';
      const creatureNames: Record<string, string> = {
        hydra: 'a many-headed serpent',
        kraken: 'a colossal sea monster',
        phoenix: 'an immortal fire bird',
        colossus: 'a giant stone guardian',
        leviathan: 'a massive sea serpent',
        behemoth: 'a titanic land beast',
        basilisk: 'a deadly serpent king',
        chimera: 'a fire-breathing hybrid',
        griffin: 'a noble eagle-lion hybrid',
        roc: 'a gigantic bird of prey',
        sphinx: 'a wise riddle-keeper',
        wyvern: 'a two-legged dragon',
        manticore: 'a man-eating beast',
        cerberus: 'a three-headed hound',
        pegasus: 'a winged horse',
        unicorn: 'a pure horned steed',
        dragon_turtle: 'a massive armored sea dragon',
        tarrasque: 'an unstoppable world-ender',
      };
      const creatureDesc = creatureNames[creatureType] || `an ancient ${creatureType}`;
      return `${name} is ${creatureDesc}, one of the first creatures born at the dawn of creation.`;
    
    case 'divine_experiment':
      const features = subtype?.divineExperimentFeatures || [];
      return getDivineExperimentDescription(name, features);
    
    case 'fallen_divine':
      const fallenType = subtype?.fallenDivineType || 'fallen being';
      const fallenNames: Record<string, string> = {
        fallen_angel: 'a once-celestial angel',
        risen_demon: 'a demon who ascended from darkness',
        lost_celestial: 'a celestial being who lost their way',
        corrupted_seraph: 'a corrupted seraph of light',
        exiled_archon: 'an exiled archon of law',
        tainted_deva: 'a tainted deva of goodness',
        dark_angel: 'a dark angel of shadow',
        infernal_being: 'an infernal being of fire',
      };
      const fallenDesc = fallenNames[fallenType] || `a ${fallenType}`;
      return `${name} is ${fallenDesc}, cast out from the divine realm and now dwelling in the mortal world.`;
    
    case 'ascended_mortal':
      return `${name} is a mortal who achieved divinity through great deeds, sacrifice, or divine favor, transcending the limits of mortality.`;
    
    case 'primordial_spawn':
      const spawnType = subtype?.primordialSpawnType || 'primordial essence';
      const spawnNames: Record<string, string> = {
        chaos_born: 'born from pure chaos',
        order_manifest: 'a manifestation of order',
        time_child: 'a child of time',
        space_fragment: 'a fragment of space',
        light_shard: 'a shard of light',
        dark_essence: 'an essence of darkness',
      };
      const spawnDesc = spawnNames[spawnType] || `born from ${spawnType}`;
      return `${name} is ${spawnDesc}, a direct offspring of the primordial forces that shaped existence.`;
    
    default:
      return `${name} is a demi-god, a being of divine power and mortal connection.`;
  }
}

/**
 * Generate description for divine experiment based on animal features
 */
function getDivineExperimentDescription(name: string, features: AnimalFeature[] | string[]): string {
  if (features.length === 0) {
    return `${name} is a divine experiment, a creature forged by the gods combining features from multiple beings.`;
  }

  const featureDescriptions: Record<string, string> = {
    // Basic features
    wings: 'soaring wings',
    scales: 'reptilian scales',
    fur: 'thick fur',
    feathers: 'colorful feathers',
    claws: 'razor-sharp claws',
    fangs: 'venomous fangs',
    horns: 'mighty horns',
    tentacles: 'writhing tentacles',
    tail: 'a powerful tail',
    mane: 'a flowing mane',
    shell: 'a protective shell',
    venom: 'deadly venom',
    multiple_heads: 'multiple heads',
    multiple_limbs: 'extra limbs',
    gills: 'aquatic gills',
    trunk: 'a prehensile trunk',
    hooves: 'heavy hooves',
    paws: 'dexterous paws',
    beak: 'a sharp beak',
    antlers: 'majestic antlers',
    // Bug-like features
    scorpion_stinger: 'a scorpion-like stinger',
    web_spinner: 'web-spinning glands',
    compound_eyes: 'compound insect eyes',
    carapace: 'a chitinous carapace',
    antenna: 'sensitive antennae',
    finger_like_mandibles: 'finger-like mandibles',
    // Wing varieties
    bat_wings: 'leathery bat wings',
    bird_wings: 'feathered bird wings',
    insect_wings: 'translucent insect wings',
    // Non-animal specific features
    bony_protrusions: 'bony protrusions',
    patches_of_hair: 'patches of matted hair',
    skin_boils: 'festering skin boils',
    crawling_with_maggots: 'maggots crawling across its body',
    // Attack methods
    searing_hot_to_touch: 'searing hot to the touch',
    emits_noxious_fumes: 'emits noxious fumes',
    breathes_thick_smokescreen: 'breathes a thick smokescreen',
    dims_light_around_it: 'dims light around it',
    rusts_metal_with_spit: 'rusts metal with its spit',
  };

  const describedFeatures = features.map(f => featureDescriptions[f] || f);
  
  // Build description based on number of features
  if (describedFeatures.length === 1) {
    return `${name} is a divine experiment, a creature with ${describedFeatures[0]}, forged by the gods as a test of creation.`;
  } else if (describedFeatures.length === 2) {
    return `${name} is a divine experiment, a hybrid creature combining ${describedFeatures[0]} and ${describedFeatures[1]}, created by the gods in their experiments.`;
  } else if (describedFeatures.length === 3) {
    return `${name} is a divine experiment, a complex chimera with ${describedFeatures[0]}, ${describedFeatures[1]}, and ${describedFeatures[2]}, forged by divine will.`;
  } else {
    const lastFeature = describedFeatures.pop();
    const others = describedFeatures.join(', ');
    return `${name} is a divine experiment, a nightmarish fusion of multiple creatures, bearing ${others}, and ${lastFeature}, created as a testament to divine power.`;
  }
}

/**
 * Generate a name from templates using seed
 * If usedNames set is provided, ensures uniqueness by avoiding duplicates
 * Uses random selection and descriptive suffixes (never numerical)
 */
export function generateName(
  templates: string[],
  seed: string,
  index: number = 0,
  usedNames?: Set<string>,
  rng?: () => number
): string {
  // Create RNG if not provided
  const random = rng || (() => {
    const hash = simpleHash(`${seed}-${index}-${Date.now()}`);
    return (hash % 10000) / 10000;
  });
  
  // If usedNames tracking is enabled, ensure uniqueness
  if (usedNames) {
    // Get available templates (not yet used)
    const availableTemplates = templates.filter(t => !usedNames.has(t));
    
    let finalName: string;
    
    if (availableTemplates.length > 0) {
      // Random selection from available templates
      const templateIndex = Math.floor(random() * availableTemplates.length);
      finalName = availableTemplates[templateIndex];
    } else {
      // All templates used - need to create variants with descriptive suffixes
      // Pick a random base template
      let baseTemplateIndex = Math.floor(random() * templates.length);
      let baseName = templates[baseTemplateIndex];
      
      // Descriptive suffixes (never numerical!)
      const descriptiveSuffixes = [
        'the Elder', 'the Ancient', 'the First', 'the Last',
        'the Great', 'the Lesser', 'the Old', 'the New',
        'the Northern', 'the Southern', 'the Eastern', 'the Western',
        'the Upper', 'the Lower', 'the Inner', 'the Outer',
        'the Central', 'the Distant', 'the Hidden', 'the Lost',
        'the Sacred', 'the Cursed', 'the Forbidden', 'the Forgotten'
      ];
      
      // Try to find an unused variant
      let variantIndex = Math.floor(random() * descriptiveSuffixes.length);
      let attempts = 0;
      const maxAttempts = descriptiveSuffixes.length * 5; // Try more combinations
      
      do {
        // Try with single suffix first
        finalName = `${baseName} ${descriptiveSuffixes[variantIndex]}`;
        
        // If that's taken and we've tried all single suffixes, try with double suffix
        if (usedNames.has(finalName) && attempts >= descriptiveSuffixes.length) {
          const secondSuffixes = ['of the North', 'of the South', 'of the East', 'of the West'];
          const secondSuffix = secondSuffixes[Math.floor(random() * secondSuffixes.length)];
          finalName = `${baseName} ${descriptiveSuffixes[variantIndex]} ${secondSuffix}`;
        }
        
        variantIndex = (variantIndex + 1) % descriptiveSuffixes.length;
        attempts++;
      } while (usedNames.has(finalName) && attempts < maxAttempts);
      
      // Final check - if somehow still not unique, try a different base template
      if (usedNames.has(finalName)) {
        baseTemplateIndex = (baseTemplateIndex + 1) % templates.length;
        baseName = templates[baseTemplateIndex];
        finalName = `${baseName} ${descriptiveSuffixes[0]}`;
        let fallbackAttempts = 0;
        while (usedNames.has(finalName) && fallbackAttempts < descriptiveSuffixes.length) {
          finalName = `${baseName} ${descriptiveSuffixes[fallbackAttempts]}`;
          fallbackAttempts++;
        }
      }
    }
    
    usedNames.add(finalName);
    return finalName;
  }
  
  // No uniqueness tracking - just random selection
  const templateIndex = Math.floor(random() * templates.length);
  return templates[templateIndex];
}

/**
 * Simple hash function for deterministic selection
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}
