import "@testing-library/jest-dom/vitest";
import { beforeEach } from "vitest";
import { resetEventBudget } from "~/engine/entity";

// Reset per-frame event budget before each test so tests don't interfere
beforeEach(() => {
  resetEventBudget();
});
