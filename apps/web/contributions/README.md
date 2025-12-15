# Contributions

This folder contains code additions and features that are ready for review and testing by the main branch developer.

## 📖 Getting Started

**Before creating your first contribution, please read:**
- **[CONTRIBUTION_GUIDE.md](./CONTRIBUTION_GUIDE.md)** - Comprehensive guide covering:
  - Game structure and scope
  - Technology stack and programming languages
  - Coding conventions and style patterns
  - Integration points and where code should go
  - Testing requirements
  - Common patterns and best practices

## Structure

Each contribution should be organized in its own subfolder with:
- The code files (or references to where they should be integrated)
- A `README.md` file explaining:
  - What the contribution does
  - Where it should be integrated
  - How to test it
  - Any dependencies or requirements
  - Any breaking changes or considerations

**Template**: Use [CONTRIBUTION_TEMPLATE.md](./CONTRIBUTION_TEMPLATE.md) as a starting point for your contribution README.

## Current Contributions

### Game Logging System
**Location**: `contributions/game-logging-system/`

A two-tier logging system that provides:
- **Detailed Log (Temporary)**: Comprehensive in-memory logging for agent summarization of character activity during idle time
- **Key Events Log (Permanent)**: Filtered permanent storage of important events for game history

Includes event importance classification, agent activity summaries, and database integration for permanent event storage.

### World Content Hierarchy System
**Location**: `contributions/world-content-hierarchy/`

A top-down hierarchical system for game world contents that tracks provenance, history, and lore of all game elements. Answers "where did this come from?" by building a persistent world lore database.

Features:
- **Provenance Tracking**: Every element knows its origin, creator, and history
- **Lore Generation**: Automatic generation of narrative stories and significance
- **Hierarchical Structure**: World → Regions → Locations → Dungeons → Items/Bosses
- **Connection Building**: Elements are automatically linked based on relationships
- **Persistent World**: World content grows over time, creating a living world history

### World Generation System
**Location**: `contributions/world-generation-system/`

A comprehensive world generation system that creates a complete game world from cosmic forces down to individual mortals. Generates world content in 9 hierarchical levels following a specific world-building structure.

Features:
- **9-Level Hierarchy**: Primordials → Cosmic Creators → Geography → Conceptual Beings → Demi-Gods → Mortal Races → Organizations → Standout Mortals → Family and Role
- **Deterministic Generation**: Seed-based generation for reproducibility
- **Template-Based**: Uses templates for names, descriptions, and relationships
- **Extensible**: Easy to add new types and expand each level
- **Integrated**: Works with world-content-hierarchy system

### Themed Dungeon Generation System
**Location**: `contributions/themed-dungeon-generation/`

A themed dungeon generation system that creates dungeons with pre-generated bosses and on-demand room generation. Generates cohesive dungeon experiences where bosses influence theme selection.

Features:
- **Themed Dungeons**: Multiple themes (Undead, Fire, Ice, Nature, Shadow, Mechanical, Abyssal, Crystal) that influence monster types, room types, and atmosphere
- **Pre-Generated Bosses**: Final boss at bottom level and mid-bosses at strategic intervals
- **Boss Theme Influence**: Bosses influence theme selection (e.g., Necromancer → Undead theme)
- **On-Demand Room Generation**: Regular rooms generated on-demand as player progresses
- **Deterministic Generation**: Seed-based generation for reproducibility
- **List Data Structure**: Level layout stored as a list for deterministic access

### Adventurer Tracking System
**Location**: `contributions/adventurer-tracking/`

A comprehensive system for tracking hero/adventurer stats and attributes. Manages health, mana, combat stats, trap interactions, and stat restoration.

Features:
- **Core Stats**: Health, mana, and all primary attributes (STR, DEX, WIS, INT, CON, CHA)
- **Combat Calculations**: Melee, ranged, and spell attack rolls with proper stat modifiers
- **Trap Interactions**: Detection and disarming using appropriate stats (STR, DEX, WIS, INT)
- **Restoration System**: Health/mana restoration in safe rooms or between adventures
- **Stat History**: Optional tracking of stat changes for analytics
- **Wallet-Based**: All heroes tracked by wallet address as root identifier

### Inventory Tracking System
**Location**: `contributions/inventory-tracking/`

A comprehensive inventory management system that tracks equipped and non-equipped items. Manages item acquisition, equipping, transfers, and inventory queries.

Features:
- **Dual Inventory**: Equipped items (per character) and non-equipped items (shared per wallet)
- **Equipment Management**: Equip/unequip items to/from heroes with slot validation
- **Item Transfers**: Transfer items between wallets with support for partial transfers
- **Inventory Queries**: Filter and search by category, rarity, class, and more
- **Item History**: Optional tracking of transfers and equipment changes
- **Wallet-Based**: All inventory owned by wallet addresses, accessible to all characters

### Monster Stat Block System
**Location**: `contributions/monster-stat-blocks/`

A comprehensive monster stat block system based on D&D 5e. Provides complete stat blocks for all monsters generated by procedural systems, organized by dungeon theme.

Features:
- **D&D 5e Stat Blocks**: Complete stat blocks following D&D 5e Monster Manual format
- **Theme Organization**: Monsters organized by dungeon theme (Undead, Fire, Ice, Nature, Shadow, Mechanical, Abyssal, Crystal, Bandit, Goblin, Necromancer Tower)
- **XP Rewards**: Automatic XP calculation based on Challenge Rating (CR)
- **Combat Ready**: Ready-to-use stat blocks for combat encounters
- **Monster Registry**: Centralized registry of all available monsters with full stat blocks
- **100+ Monsters**: Complete stat blocks for all monsters from procedural generation systems

## How to Use

1. **Read the Contribution Guide** - Understand the codebase structure and conventions
2. **Create a new subfolder** - Use descriptive names (e.g., `contributions/feature-name/`)
3. **Add your code and documentation** - Follow the template and guide patterns
4. **Update this README** - Add a brief description of your contribution below
5. **The main branch developer** will review, test, and integrate as appropriate

