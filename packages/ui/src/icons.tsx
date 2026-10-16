// Icons. Every id the shared screens use has a drawing in the shared open-source set (Lucide), so
// a game works with no icons of its own. A game may draw its own version of any icon (an SVG file
// in its `ui` package); <Icon> uses that instead. Drawings by people, never by AI (docs/ui).

import {
  ArrowUpDown,
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleDashed,
  CircleX,
  Copy,
  Download,
  Ellipsis,
  Eraser,
  Eye,
  EyeOff,
  FilePlus,
  Flag,
  Folder,
  Globe,
  Grid3x3,
  Hand,
  House,
  Info,
  Lasso,
  Layers,
  Library,
  Link,
  Lock,
  LogIn,
  LogOut,
  Maximize2,
  Menu,
  Minimize2,
  Minus,
  Moon,
  MousePointer2,
  Package,
  PaintBucket,
  Paintbrush,
  Pencil,
  Plus,
  Redo2,
  RotateCcw,
  RotateCw,
  Ruler,
  Save,
  Scan,
  Scissors,
  Search,
  Settings,
  SlidersHorizontal,
  Snowflake,
  SquareDashed,
  Sun,
  Sunrise,
  Sunset,
  Trash2,
  TriangleAlert,
  Undo2,
  Upload,
  User,
  WandSparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import { createContext, useContext, type ReactNode } from "react";

/** The shared set: an id for every icon a shared screen uses. */
export const SHARED_ICONS = {
  alert: TriangleAlert,
  book: BookOpen,
  brush: Paintbrush,
  check: Check,
  "chevron-down": ChevronDown,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  "chevron-up": ChevronUp,
  clear: CircleX,
  close: X,
  copy: Copy,
  cut: Scissors,
  download: Download,
  eraser: Eraser,
  eye: Eye,
  "eye-off": EyeOff,
  fill: PaintBucket,
  filter: SlidersHorizontal,
  fit: Scan,
  folder: Folder,
  globe: Globe,
  grab: Hand,
  grid: Grid3x3,
  home: House,
  info: Info,
  lasso: Lasso,
  layers: Layers,
  library: Library,
  link: Link,
  lock: Lock,
  "log-in": LogIn,
  "log-out": LogOut,
  magic: WandSparkles,
  maximize: Maximize2,
  menu: Menu,
  minimize: Minimize2,
  minus: Minus,
  moon: Moon,
  more: Ellipsis,
  "new-file": FilePlus,
  pack: Package,
  pencil: Pencil,
  plus: Plus,
  pointer: MousePointer2,
  redo: Redo2,
  report: Flag,
  "rotate-left": RotateCcw,
  "rotate-right": RotateCw,
  ruler: Ruler,
  save: Save,
  search: Search,
  "select-circle": CircleDashed,
  "select-rect": SquareDashed,
  settings: Settings,
  snow: Snowflake,
  sort: ArrowUpDown,
  sun: Sun,
  sunrise: Sunrise,
  sunset: Sunset,
  trash: Trash2,
  undo: Undo2,
  upload: Upload,
  user: User,
} satisfies Record<string, LucideIcon>;

export type SharedIconId = keyof typeof SHARED_ICONS;

/** A shared id, or one a game adds for its own screens (a mode, a layer). */
export type IconId = SharedIconId | (string & {});

/** A game's own drawings: icon id → the SVG file's text. */
export type GameIcons = Readonly<Record<string, string>>;

const IconContext = createContext<GameIcons>({});

export function IconProvider(props: { icons: GameIcons; children: ReactNode }) {
  return <IconContext.Provider value={props.icons}>{props.children}</IconContext.Provider>;
}

/** Whether an id has a drawing: the game's own, or the shared set's. */
export function iconResolves(id: string, gameIcons: GameIcons): boolean {
  return id in gameIcons || id in SHARED_ICONS;
}

export interface IconProps {
  id: IconId;
  /** Width and height in CSS pixels. */
  size?: number;
  /** Line weight for shared icons, which follow the text colour. */
  strokeWidth?: number;
}

/** An icon, for decoration: the control around it carries the name. Unknown ids draw nothing. */
export function Icon({ id, size = 20, strokeWidth = 2.4 }: IconProps) {
  const own = useContext(IconContext)[id];
  if (own) {
    return (
      <span
        className="glade-icon"
        aria-hidden="true"
        style={{ width: size, height: size }}
        // A game's own SVG file from its repo, never content a user sent.
        dangerouslySetInnerHTML={{ __html: own }}
      />
    );
  }
  const Shared = (SHARED_ICONS as Record<string, LucideIcon>)[id];
  if (!Shared) return null;
  return (
    <Shared
      className="glade-icon"
      aria-hidden="true"
      size={size}
      strokeWidth={strokeWidth}
      absoluteStrokeWidth={false}
    />
  );
}
