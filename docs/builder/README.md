# The item builder

> **In short:** The builder makes custom items in three steps: **Define** (what it is and how big),
> **Build** (add parts) and **Save**. You start from an empty item. Building is four moves: **drop**
> a part onto the item, **pull** its handles, **repeat** it, **paint** it. A few general parts do
> most of the work: draw an outline and **spin** or **push** it, or use a smart part (a case with
> shelves, a draped cloth) that fills in its own detail by fixed rules, with no AI. The result is a
> normal model, saved in a **pack**.

## What is shared and what is the game's

The builder is one engine for every game. Each game lays its own things over it.

| Shared (`@glade/builder`)                             | The game's (`@glade/<id>-builder`)                                    |
| ----------------------------------------------------- | --------------------------------------------------------------------- |
| The recipe, the part tree and the layout of each part | Templates: what an item can be in the game, and their fields          |
| Basic shapes, Spin and Push, catalog items as parts   | Smart parts (legs, cushion, case, roof…) and which shapes it offers   |
| Compiling to a model, the part limit, the checklist   | Its checks of the finished entry                                      |
| Undo, the steps, the screens, the 3D view             | Materials and colours, the backdrop and footprint colours             |
| Footprint handles, steppers, marks as a list          | Its grid: footprint steps, block height, the unit's words ("tiles")   |
| A preview hook for templates with no model            | How a recipe becomes a catalog entry (a path's preview, water decor…) |

Example: Petit Planet's **Water decor** switch is a field on its Item template. The shared Save
step shows every template field; it doesn't know what water is.

## Where it opens

| Way in                                              | What happens                                                              |
| --------------------------------------------------- | ------------------------------------------------------------------------- |
| `/<game>/builder`                                   | Full page builder. Title bar has a game picker and (later) a Home button. |
| **+ New item** in the planner toolbox               | Builder window opens on Define, empty, over the planner.                  |
| **Create new** on an item (drawer card or map item) | Builder window opens on Build with a copy of that item.                   |
| Phones                                              | Builder always opens full screen.                                         |

## The three steps

A step bar runs along the top: **Define → Build → Save**. A step unlocks only when the one before it
is done.

| Step       | You do                                                       | Done when                                                            |
| ---------- | ------------------------------------------------------------ | -------------------------------------------------------------------- |
| **Define** | Pick a template (a kind or a trait), then draw the footprint | Both are set                                                         |
| **Build**  | Add and shape parts                                          | The item has at least one part, and every part the template requires |
| **Save**   | Name it, pick a pack and a category                          | Saved                                                                |

You can go back to any earlier step. Going back to Define and changing the template **converts**
the item ([switching templates](#switching-templates)).

Every item starts empty. Deleting every part gives you an empty item again, so there is no separate
"blank" template.

## Define

### Templates (Petit Planet)

A template is a game **kind** or a **trait**. It sets the footprint limits, what the item must have,
and what the preview shows. Templates live in the game's builder package
(`@glade/petit-planet-builder`).

| Template           | Kind + fields                               | Footprint                         | Must have / special                                                                                              |
| ------------------ | ------------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Item**           | `item`                                      | 0.5 × 0.5 to 4 × 4 tiles          | Option: mark a **surface**.                                                                                      |
| **Fence / hedge**  | `item` + `connects`                         | Always 1 × 1 tile; body 0.5 to 1  | Connection preview                                                                                               |
| **Building**       | `building` (a sort of `item`)               | 2 × 2 to 6 × 6 tiles              | **A door is required** ([markings](#markings-surface-and-door)). Things you can enter: houses, shops, galleries. |
| **Tree**           | `tree` (a sort of `plant`)                  | Whole tiles                       | Tree spacing (L6) shown as a ring                                                                                |
| **Shrub / flower** | `shrub` or `flower`                         | Whole tiles                       | —                                                                                                                |
| **Crop**           | `crop` (a sort of `plant`)                  | 1 × 1 or 2 × 2 tiles              | —                                                                                                                |
| **Bridge**         | `bridge` + `majorSize`                      | 1 or 2 wide, 4 to 7 long          | Footprint must match `majorSize`                                                                                 |
| **Incline**        | `incline`                                   | 1 × 2 or 2 × 2                    | Climbs one level                                                                                                 |
| **Path**           | `path` + `color`, `pattern`, `allowsPlants` | —                                 | No model, so no Build step: pick colours, a pattern, "plants allowed"                                            |
| **Placeable**      | `item` + `placeable`                        | 0.5 × 0.5 to 1 × 1                | Also its size on a table top. Preview on a sample table. Can't have a surface (nothing stacks).                  |
| **Wall item**      | `item` + `mount: "wall"` (homes)            | Half cells across and up the wall | Faces south, back on the wall. Preview on a wall.                                                                |
| **Ceiling item**   | `item` + `mount: "ceiling"` (homes)         | Like floor items                  | Preview from below                                                                                               |

Big furniture is an **Item**, not a Building. A windmill you can't walk into is an item.

Wallpaper and flooring (homes, after 1.0) are 2D sheets: colours and a pattern, no model.

### The footprint

Drag the footprint's corners on the grid in the 3D view. It snaps to the template's grid and stays
inside its limits, and a readout under it says its size ("1.5 × 2 tiles").

The width and depth steppers are one row of floating cream pills **in the 3D view**, never in the
template panel: bottom left of the view on the page, just above the sheet in the window and on a
phone. Any on/off options a template has sit in the same row as small pills. A fixed footprint
(Path, Tree) shows its size but no handles or steppers.

**Path** has no model, so it skips Build. On the page, its panel shows base colour, edge colour,
pattern and "Plants allowed". In the window and on a phone these are compact pills: tap for the next
colour or pattern.
Example: a Crop snaps to 1 × 1 or 2 × 2 tiles and nothing else.

### Switching templates

Changing the template after building **converts** the item. Glade keeps every part and changes
only what the new template needs.

| From → to                    | What happens                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------ |
| Item → Placeable             | Works if the footprint fits 1 × 1. A marked surface is dropped (nothing stacks); a hint says so. |
| Item → Building              | Works. Build is not done until you mark a door.                                                  |
| Building → Item              | Works. The door marking is dropped; the door part stays as a plain part.                         |
| Item → Fence / hedge         | Works if the footprint is 1 × 1.                                                                 |
| Tree ↔ Shrub ↔ Flower ↔ Crop | Works if the footprint fits the new template.                                                    |
| Item → Wall or Ceiling item  | Works. The parts turn to face the wall, or to hang down.                                         |
| Anything ↔ Path              | Can't convert: a path has no model.                                                              |

When a footprint no longer fits, Glade first offers to **fit** it (shrink the footprint and scale
the parts). When the item can't convert at all, Glade asks: **Save it first**, **Clear and switch**,
or **Cancel**.

## Build

### The screen

| Part               | Detail                                                                                                                        |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Step bar           | Define → Build → Save, along the top                                                                                          |
| 3D view            | Turn with drag, zoom with wheel or pinch. The footprint grid sits under the item. Click a part to select it.                  |
| Shelf              | Right side. The parts, by group (below). Search with `/`. Drag a part onto the item, or click to add it to the selected part. |
| Handles            | On the selected part, in the 3D view. Pull them to shape it.                                                                  |
| Part panel         | Bottom left, when a part is selected: its settings, Repeat, Paint, Mark, Duplicate, Delete.                                   |
| Problems           | Live check result and part count ("14 of 256 parts"). Click a problem to select its part.                                     |
| Connection preview | Fences only: three small 3D previews, linked straight, in an L, and diagonally (posed so it reads as diagonal)                |

### Four moves

| Move       | You do                                        | Example                                                    |
| ---------- | --------------------------------------------- | ---------------------------------------------------------- |
| **Drop**   | Drag a part from the shelf onto the item      | Drop **Legs** under a tabletop: they snap to its underside |
| **Pull**   | Drag a handle on the selected part            | Pull the legs' height handle down to make a low table      |
| **Repeat** | Mirror it, or copy it in a row or a circle    | Repeat a sail 4 times in a circle                          |
| **Paint**  | Pick a material, a colour and maybe a pattern | Fabric, blue and white stripes                             |

**Dropping:** while a part is dragged in, a see-through ghost shows where it will land and the face
it lands on lights up. It lands on the face under the cursor, sized to fit it, facing out. Where the
cursor is between parts, Glade picks in this order: a seat, then a surface, then any box, then the
floor. On a curved
face (a tower, a dome) it stays flat and is sunk into the face so its edges touch it
([curved faces](#curved-faces)). A dropped part becomes a child of the part it lands on: move the
parent and the child comes along.

### Curved faces

A flat part on a round wall touches the wall only in its middle; its edges stand off a little. So
Glade **sinks** the part into the wall until its edges touch. The middle goes slightly inside the
wall, where nobody sees it.

How far it sinks depends on how wide the part is next to how round the wall is. For small parts on
a big curve it is tiny.

| On a tower of radius 0.9 tiles (a 2 × 2 windmill) | Part width | Edge gap before sinking |
| ------------------------------------------------- | ---------- | ----------------------- |
| Round window                                      | 0.35 tiles | 0.02 tiles              |
| Arched door                                       | 0.5 tiles  | 0.035 tiles             |
| A sign half the tower's width                     | 0.9 tiles  | 0.12 tiles              |

The door and window look like they sit on the curve. A part as wide as the sign looks flat, so
Glade shows a hint when the gap passes 0.1 tiles: "This part is wide for this curve." Bending a
part to follow the curve is [later](#later).

**Mirror is on by default** across the footprint's centre lines. Drop one leg near a corner and the
other three appear. The Repeat button turns mirroring off for that part.

**Handles** replace move, rotate and scale tools. A part shows only the handles it has: a box shows
width, depth, height and corner rounding; legs show height, thickness and inset; a spin shape shows
its outline's points. Drag a part's middle to slide it on its face. Rotate snaps every 15°.

### The shelf: parts

**Basic shapes**

| Part     | Settings                                                   |
| -------- | ---------------------------------------------------------- |
| Box      | Size, corner rounding, cut corners (for angled fronts)     |
| Cylinder | Radius, height, top radius (a tapered tower), sides (3–32) |
| Sphere   | Radius, squash, half (a dome)                              |
| Cone     | Radius, height, sides                                      |
| Wedge    | Size                                                       |
| Ring     | Radius, thickness, arc                                     |

**Draw a shape.** Two parts take an outline you draw in a small 2D panel: click to add points, click
a point to make it round or sharp. Points snap to a fine grid, and the outline can mirror itself
(for arches).

| Part     | Draw                                    | It makes                                                                                                  | Examples                                                                    |
| -------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **Spin** | Half an outline, next to an axis        | A round shape: the outline spun around the axis. **Sides** (3–32) makes it faceted. **Ribs** adds flutes. | Lamp base and column, an 8-sided lamp shade, a tower, a bottle, a pot       |
| **Push** | An outline, from the side or from above | The outline pushed out to a thickness                                                                     | Bookshelf sides, arched legs, an arched door, a 5-sided corner cabinet body |

**Smart parts.** You set a few numbers; rules work out the rest.

| Part           | Settings                                                                                        | Rules fill in                                                                                |
| -------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **Legs**       | Style (straight, tapered, arched, ball feet, cantilever, sled), count, height, thickness, inset | Spread evenly on the parent's underside: corners of a rectangle, around a circle             |
| **Case**       | Outline (the footprint, or a drawn one), open sides, shelves, drawers, doors, inside colour     | Panels, shelves, drawer fronts, the back. No holes needed: open sides are just left out.     |
| **Drawer**     | Count, handle style                                                                             | Drawer fronts in a column, each with a handle                                                |
| **Drape**      | How far it falls, flare, hem (straight, wavy, scalloped, lace), lining colour                   | Cloth over the parent's edges: flat on top, hanging down the sides                           |
| **Sling**      | The two parts it hangs between, sag                                                             | Cloth stretched between them: a deck-chair seat, a hammock                                   |
| **Cushion**    | Size, puffiness                                                                                 | A soft rounded pad that fills the face it is dropped on                                      |
| **Tube frame** | Points (clicked on a side view), thickness, sharp or round bends                                | A bent pipe through the points; mirrored like any part                                       |
| **Book row**   | Fullness, colours, lean                                                                         | Books of varied height, width and colour along a shelf                                       |
| **Handle**     | Style (knob, bar, ring, pull chain)                                                             | Sits at the middle of the face it is dropped on                                              |
| **Trim**       | Thickness, style (line, beads, bricks)                                                          | Runs along an edge or an outline: the gold lines on a lamp shade, a brick arch around a door |
| **Roof**       | Shape (cone, dome, gable), overhang                                                             | A roof sized to the part below it                                                            |

**Items as parts.** The shelf's last group is the catalog: drop any item (base or from your packs)
into a build. A bottle and a cup on a cabinet shelf are just two placeables dropped in. The item's
model is copied in, so later changes to the original don't change your build.

### Repeat

| Repeat     | Does                                                 | Example                          |
| ---------- | ---------------------------------------------------- | -------------------------------- |
| **Mirror** | Copies across the footprint's centre lines (default) | 4 legs from 1                    |
| **Row**    | N copies along a direction, evenly spaced            | 3 shelves, 2 drawers, flutes     |
| **Circle** | N copies around an axis                              | 4 windmill sails, 8 shade panels |

A repeat stays one part: change the original and every copy follows. It compiles to one group with
`mirror` or `repeat`, which keeps models small ([item models](../profiles/models.md#groups)).

### Paint: materials and patterns

**Material** sets how a part looks; **colour** tints it; **pattern** adds a design on top. All of
them are made by rules from a few colours (procedural): no pictures, no game assets, no AI.

| Material | Look                 | Colours you pick           |
| -------- | -------------------- | -------------------------- |
| Wood     | Grain lines          | Wood, grain                |
| Marble   | Soft veins           | Stone, veins               |
| Stone    | Speckles             | Stone, speckles            |
| Plaster  | Flat, slightly rough | One                        |
| Fabric   | Soft weave           | One                        |
| Metal    | Shiny                | One (gold, bronze, steel…) |
| Ceramic  | Glossy               | One                        |
| Glass    | See-through          | Tint                       |
| Leaves   | Clumps               | Leaf, shade                |

| Pattern | Settings                   | Seen on                  |
| ------- | -------------------------- | ------------------------ |
| Stripes | 2–4 colours, width, angle  | Beach lounger            |
| Plaid   | 2–3 colours, size          | Cabinet cloth            |
| Waves   | 2 colours, size            | Kotatsu blanket          |
| Dots    | 2 colours, size, spacing   | —                        |
| Flowers | 2–3 colours, size, spacing | Bedding                  |
| Scales  | 2 colours, size            | Windmill roof tiles      |
| Bricks  | 2 colours, size            | Door arches, bases       |
| Panels  | Line colour, count         | Stained-glass lamp shade |

**Glow** (any material): lit at night in the planner. A glass shade with Glow is a lamp.

### Markings: surface and door

Some parts mean something to the game. You **mark** them in the part panel.

| Marking     | Templates     | Mark                         | Then                                                                                                                            |
| ----------- | ------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Surface** | Item, Fence   | The top face of a part       | Placeable things can stand on it. Glade lays the top's half-cell grid on that face (a 2 × 2 table's top might be 12 × 12).      |
| **Door**    | Building only | A part (or a group of parts) | The door's wall is the building's **front**: the row in front must stay clear (rule B1). Required: Build isn't done without it. |

A building needs exactly one door. Glade doesn't add one of its own when the entry has a marked
door.

### How "smart without AI" works

1. **A tree of parts.** Each part sits on one face of its parent: `top`, `bottom`, `sides`,
   `edges`, or a point on a curve.
2. **Layout rules.** Each part type has one function: given its parent's face and its own
   settings, work out where it goes and how big it is.
   - Legs on a rectangle: at the corners, inset. Legs on a circle: evenly around the edge.
   - A drape: flat on the parent's top, then down each side by its fall, flaring out.
   - A case: one panel per closed side of its outline, shelves evenly spaced, drawers at the bottom.
3. **Rebuild in order.** After any change Glade rebuilds top-down: footprint → parts on the
   footprint → parts on those. Always the same order, so the same settings always give the same
   item.
4. **Compile.** The tree becomes plain model parts: boxes, wedges, cylinders, cones, spheres,
   rings, tubes, groups, and **meshes** for spin, push, drape, sling and cushion. Mirrors and
   repeats stay groups. Limit: 256 solids.
5. **Check.** The profile's `entryProblems(planet, entry)` checks the entry: its fields, its model
   against its footprint, the game's limits, the required markings. Problems name the part, so
   Glade shows each one next to it.
6. **Draw.** The 3D view uses `modelMesh(model, { blockSize })` from `@glade/render`. Each vertex
   knows its part, so a click picks a part.

**Recipe vs model:** a model stores only the finished parts, so the builder keeps its own settings.
Each saved item has:

- `entry`: the catalog entry with the compiled `model` (what the planner uses),
- `recipe`: the builder's part tree, settings and outlines (what the builder edits).

## Save

| Field       | Required               | Example                                                          |
| ----------- | ---------------------- | ---------------------------------------------------------------- |
| Name        | Yes                    | Beach lounger                                                    |
| Pack        | Yes (pick or create)   | My furniture                                                     |
| Category    | Yes                    | Basic Furniture (the game's categories, as one row of chips)     |
| Water decor | A switch, always shown | On for a boat: "Can be placed on water, like ponds and the sea." |
| Tags        | No                     | striped, outdoor                                                 |
| Description | No                     | A folding lounger with a pillow                                  |

Kind, fields and markings come from Define and Build. Saving puts the item in its pack, and it
appears in the planner's toolbox under its category. Water decor items get the wavy water badge in
the planner and can be filtered. Beside the form: a preview of the item, its size and part count, and
**Save to <pack>**, locked until Build is done (a building needs its door).

## Test items

Seven real items from the game, from simple to hard. Each recipe is also an end-to-end test: it
must work with no more steps than listed.

### 1. Marble square table

1. **Define:** Item, footprint 1 × 1.
2. **Drop** a Box on the footprint. Pull its height handle to make a thick top; pull **rounding** up.
3. **Paint:** Marble, cream with gold veins. **Mark → Surface.**
4. **Drop** Legs under the top. Style **Arched**: the legs flare into the top's underside. Mirror
   makes 4.
5. **Paint** the legs: Metal, bronze. **Save.**

### 2. Kotatsu

1. **Define:** Item, footprint 2 × 2.
2. **Drop** a Box: a low frame, painted dark green.
3. **Drop** a Drape on it. Fall: to the floor. Flare: a little. Hem: wavy. Lining: white.
4. **Paint** the drape: Fabric, light green, pattern **Waves**.
5. **Drop** a Box on the drape: the tabletop. Pull rounding up. **Paint:** Wood, honey.
   **Mark → Surface. Save.**

### 3. Beach lounger

1. **Define:** Item, footprint 1.5 × 2.
2. **Drop** a Tube frame. On the side view, click 5 points: foot, seat, hip, back, top. Round
   bends. Mirror makes the other side. **Paint:** Metal, white.
3. **Drop** a Tube frame for the legs: a loop under the seat, and one under the back.
4. **Drop** a Sling between the two side frames. **Paint:** Fabric, stripes (white, blue, yellow).
5. **Drop** a Cushion at the top of the sling: the pillow, same stripes.
6. **Drop** a Box on each side frame: the armrests. Round them. **Paint:** Wood, yellow. **Save.**

### 4. Lamp

1. **Define:** Item, footprint 1 × 1.
2. **Drop** a Spin. Draw the base and column outline: a wide foot, a thin stem. **Ribs:** 12.
   **Paint:** Metal, gold.
3. **Drop** a Spin on top: the shade. Draw a bell outline. **Sides:** 8.
4. **Paint** the shade: Glass, blue, pattern **Panels**, **Glow**. **Drop** Trim on its edges:
   gold lines.
5. **Drop** a Handle on the shade's rim, style **pull chain**. **Drop** a Cone on top: the
   finial. **Save.**

### 5. Bookshelf

1. **Define:** Item, footprint 1 × 1.
2. **Drop** a Case. Open side: front. Shelves: 3. Drawers: 1. Inside colour: darker wood.
3. Select the Case's side panel. **Push** outline: draw the stepped curve of the top. Both sides
   follow (mirror).
4. **Drop** a Book row on each of the top 2 shelves. **Drop** Legs: style **Ball feet**.
5. **Drop** items from the catalog onto the top and the shelves: a clock, a plant pot.
6. **Paint:** Wood, red-brown. Handles: Metal, gold. **Save.**

### 6. Corner cabinet

1. **Define:** Item, footprint 1 × 1.
2. **Drop** a Case. Outline: **draw** a 5-sided shape from above (a corner unit with an angled
   front). Open: the upper front. Shelves: 1. Drawers: 2. Inside colour: dark red.
3. **Drop** a Box on the drawers' top: the counter. **Paint:** Stone, grey.
4. **Drop** a Drape under the upper shelf's top edge: falls a little, hem **lace**. **Paint:**
   Fabric, plaid. **Drop** a small flower decoration on it.
5. **Drop** a bottle and a cup from the catalog on the shelf. **Drop** Legs: short, 4.
6. **Paint:** Wood, yellow. **Save.**

### 7. Windmill or silo (farm furniture)

1. **Define:** Item, footprint 2 × 2.
2. **Drop** a Cylinder. Pull the **top radius** smaller: a tapered tower. **Paint:** Plaster,
   yellow.
3. **Drop** a Ring at its foot. **Paint:** Stone, pattern **Bricks**.
4. **Drop** a Roof on top: cone. **Paint:** pattern **Scales**, red.
5. **Drop** a Box on the tower's front: one sail. **Drop** a Cylinder at its centre: the hub.
   **Repeat → Circle**, 4: four sails.
6. **Drop** a Push on the tower: draw an arched door. **Paint:** Wood. **Drop** Trim around it,
   style **bricks**. **Drop** a Spin for the round window, and a Box cross on it.
7. **Save.**

The door and window are flat parts on a round tower. Glade sinks each one into the wall just far
enough that its edges touch the curve, so nothing floats ([curved faces](#curved-faces)).

## Later

- **Bend to a curve:** a part follows a curved face instead of sitting flat against it (a band
  around a tower). This needs Glade to bend its own triangles (Phase 9).
- **Soft blend:** parts melt smoothly into each other, for blobby, cushiony shapes.
- More patterns and materials, and patterns you draw yourself.

## The builder window (inside the planner)

| Action         | Result                                                                                                           |
| -------------- | ---------------------------------------------------------------------------------------------------------------- |
| Opens          | Small window (420 × 540) at the top right of the planner (96 px in from the right and top).                      |
| Drag title bar | Moves the window.                                                                                                |
| Drag corner    | Resizes it.                                                                                                      |
| Minimise       | Becomes a small chip in the bottom-right corner (24 px in): the item icon, name, unsaved dot, restore and close. |
| Maximise       | Fills the planner. Click again to restore.                                                                       |
| Close          | If not saved: "Save changes to Lounge chair?" Save / Don't save / Cancel.                                        |
| Keyboard       | `F6` moves focus between the planner and the builder.                                                            |

## Builder keys

| Key                     | Action                                                     |
| ----------------------- | ---------------------------------------------------------- |
| `Ctrl + Z` / `Ctrl + Y` | Undo / redo (builder's own history)                        |
| `Ctrl + S`              | Save                                                       |
| `Delete`                | Delete part                                                |
| `Ctrl + D`              | Duplicate part                                             |
| `.` / `,`               | Select next / previous part (`Tab` stays for moving focus) |
| `Q` / `E`               | Turn the view                                              |
| `F`                     | Fit the item                                               |
| `/`                     | Search the shelf                                           |
