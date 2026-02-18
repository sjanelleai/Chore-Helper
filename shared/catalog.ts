export interface CatalogChoreItem {
  id: string;
  name: string;
  defaultPoints: number;
}

export interface CatalogChoreCategory {
  categoryId: string;
  categoryName: string;
  items: CatalogChoreItem[];
}

export interface CatalogRewardItem {
  id: string;
  name: string;
  defaultCost: number;
}

export interface CatalogRewardCategory {
  categoryId: string;
  categoryName: string;
  items: CatalogRewardItem[];
}

export interface BonusReasonDef {
  id: string;
  name: string;
}

export const CATALOG = {
  chores: [
    {
      categoryId: "room",
      categoryName: "Room",
      items: [
        { id: "make_bed", name: "Make bed", defaultPoints: 15 },
        { id: "hamper", name: "Put clothes in hamper", defaultPoints: 15 },
        { id: "pick_up_floor", name: "Pick up floor", defaultPoints: 20 },
        { id: "desk_tidy", name: "Tidy desk", defaultPoints: 20 },
        { id: "clean_room_quick", name: "Clean room (quick)", defaultPoints: 35 },
        { id: "clean_room_deep", name: "Clean room (deep)", defaultPoints: 120 },
      ],
    },
    {
      categoryId: "kitchen",
      categoryName: "Kitchen",
      items: [
        { id: "clear_plate", name: "Clear your plate", defaultPoints: 15 },
        { id: "load_dishwasher", name: "Load dishwasher", defaultPoints: 30 },
        { id: "unload_dishwasher", name: "Unload dishwasher", defaultPoints: 40 },
        { id: "wipe_counters", name: "Wipe counters", defaultPoints: 35 },
        { id: "set_table", name: "Set the table", defaultPoints: 20 },
      ],
    },
    {
      categoryId: "pets",
      categoryName: "Pets",
      items: [
        { id: "feed_pet", name: "Feed pet", defaultPoints: 20 },
        { id: "water_pet", name: "Water bowl", defaultPoints: 15 },
        { id: "pet_cleanup", name: "Help with pet cleanup", defaultPoints: 40 },
      ],
    },
    {
      categoryId: "school",
      categoryName: "School",
      items: [
        { id: "homework_15", name: "Homework (15 min)", defaultPoints: 25 },
        { id: "homework_30", name: "Homework (30 min)", defaultPoints: 50 },
        { id: "reading_15", name: "Reading (15 min)", defaultPoints: 25 },
        { id: "pack_bag", name: "Pack backpack", defaultPoints: 20 },
      ],
    },
    {
      categoryId: "family",
      categoryName: "Family",
      items: [
        { id: "help_sibling", name: "Help sibling (kindly)", defaultPoints: 25 },
        { id: "trash_small", name: "Take out small trash", defaultPoints: 25 },
        { id: "laundry_helper", name: "Laundry helper", defaultPoints: 40 },
      ],
    },
  ] as CatalogChoreCategory[],

  rewards: [
    {
      categoryId: "privileges",
      categoryName: "Privileges",
      items: [
        { id: "priv_music_car", name: "Pick music in the car", defaultCost: 700 },
        { id: "priv_game_choice", name: "Pick a family game", defaultCost: 650 },
        { id: "priv_screen_15", name: "Extra screen time +15 min", defaultCost: 1200 },
        { id: "priv_screen_30", name: "Extra screen time +30 min", defaultCost: 2000 },
        { id: "priv_stay_up_15", name: "Stay up +15 min", defaultCost: 1400 },
        { id: "priv_stay_up_30", name: "Stay up +30 min", defaultCost: 2400 },
        { id: "priv_stay_up_60", name: "Stay up +60 min (VERY expensive)", defaultCost: 4500 },
      ],
    },
    {
      categoryId: "experiences",
      categoryName: "Experiences",
      items: [
        { id: "exp_ice_cream", name: "Ice cream outing", defaultCost: 2200 },
        { id: "exp_movie_night", name: "Movie night (pick the movie)", defaultCost: 2600 },
        { id: "exp_arcade", name: "Arcade trip", defaultCost: 3500 },
        { id: "exp_bowling", name: "Bowling night", defaultCost: 4200 },
        { id: "exp_playdate", name: "Friend playdate", defaultCost: 3000 },
      ],
    },
    {
      categoryId: "food",
      categoryName: "Food Treats",
      items: [
        { id: "food_dessert", name: "Special dessert", defaultCost: 1200 },
        { id: "food_smoothie", name: "Smoothie / fancy drink", defaultCost: 1500 },
        { id: "food_pick_dinner", name: "Pick dinner (within rules)", defaultCost: 3200 },
      ],
    },
    {
      categoryId: "toys",
      categoryName: "Toys / Items",
      items: [
        { id: "toy_small", name: "Small toy / trinket", defaultCost: 3000 },
        { id: "toy_book", name: "New book", defaultCost: 4200 },
        { id: "toy_big", name: "Bigger toy (rare)", defaultCost: 9000 },
      ],
    },
    {
      categoryId: "allowance",
      categoryName: "Allowance",
      items: [
        { id: "allow_1", name: "Allowance cash-out: $1", defaultCost: 0 },
        { id: "allow_5", name: "Allowance cash-out: $5", defaultCost: 0 },
        { id: "allow_10", name: "Allowance cash-out: $10", defaultCost: 0 },
      ],
    },
  ] as CatalogRewardCategory[],

  bonusReasons: [
    { id: "initiative", name: "Did it without being asked" },
    { id: "kindness", name: "Kindness / helped someone" },
    { id: "attitude", name: "Great attitude" },
    { id: "honesty", name: "Honesty / owned a mistake" },
    { id: "extra_effort", name: "Extra effort" },
  ] as BonusReasonDef[],
};

export const STARTER_CHORES = ["make_bed", "hamper", "pick_up_floor", "homework_15", "pack_bag", "feed_pet"];
export const STARTER_REWARDS = ["exp_movie_night", "exp_arcade", "priv_stay_up_15", "food_dessert", "priv_music_car"];

export function flattenCatalog<T>(catArray: { items: T[] }[]): T[] {
  const out: T[] = [];
  catArray.forEach(group => group.items.forEach(item => out.push(item)));
  return out;
}

export function findCategoryName(groups: { categoryName: string; items: { id: string }[] }[], itemId: string): string {
  for (const g of groups) {
    if (g.items.some(i => i.id === itemId)) return g.categoryName;
  }
  return "Other";
}

export function clampNumber(n: number | null | undefined, min: number, max: number): number {
  const x = Number(n);
  if (Number.isNaN(x)) return min;
  return Math.max(min, Math.min(max, x));
}

export function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
