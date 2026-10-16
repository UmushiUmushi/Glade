// Runs before story tests: applies Storybook's own setup (decorators, globals, the a11y addon) so
// each story renders in tests exactly as in Storybook.

import * as a11yAddon from "@storybook/addon-a11y/preview";
import { setProjectAnnotations } from "@storybook/react-vite";
import * as projectAnnotations from "./preview";

setProjectAnnotations([a11yAddon, projectAnnotations]);
