# Development Tools

This directory contains standalone development and testing tools for the various contribution systems.

## Master Generation Tool

**Location:** `master-generator/`

A comprehensive HTML tool that unifies all generation systems (World, Map, Dungeon, Item) into a single tabbed interface with full integration between systems. This tool provides a complete testing interface for all contribution systems as they would integrate into the main game.

**Features:**
- Tabbed interface consolidating to 3 systems (World, Dungeon, Item)
- Full integration workflow (seeded World ΓåÆ associated seeded Dungeon)
- (some) Parametric configuration via UI
- Real-time integration statistics

See `master-generator/README.md` for detailed documentation.

## Usage

All tools are standalone HTML files that can be opened directly in any modern web browser. No build process, server, or dependencies required.

## Adding New Tools

When adding new tools to this directory:

1. Create a new subdirectory for your tool
2. Include the tool file(s) and a README.md explaining usage
3. Update this README.md to list the new tool