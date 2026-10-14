import type { BenefitFrequency } from "./types";

/** Recurring statement credits to track. Not lounge access, insurance, or subscriptions. */
export type CatalogBenefit = {
  name: string;
  frequency: BenefitFrequency;
  expectedAmount: number | null;
  cycleStartMonth: number;
  notes: string;
  /** Lowercase merchant/description fragments. Omitted for credits too broad to auto-match. */
  matchers?: string[];
};

export const SAPPHIRE_RESERVE_BENEFITS: CatalogBenefit[] = [
  {
    name: "The Edit (1st stay)",
    frequency: "annual",
    expectedAmount: 250,
    cycleStartMonth: 1,
    notes: "Two $250 credits per calendar year; cannot combine on one stay. Prepaid The Edit booking, 2-night minimum.",
    matchers: ["the edit"],
  },
  {
    name: "The Edit (2nd stay)",
    frequency: "annual",
    expectedAmount: 250,
    cycleStartMonth: 1,
    notes: "Second $250 The Edit credit. Same two-night prepaid Chase Travel stay rules.",
    matchers: ["the edit"],
  },
  {
    name: "Select hotels (IHG & others)",
    frequency: "annual",
    expectedAmount: 250,
    cycleStartMonth: 1,
    notes: "2026 only, through Dec 31. Prepaid Chase Travel, 2-night min. IHG, Montage, Pendry, Omni, Virgin, Minor, Pan Pacific. Can stack with The Edit on overlapping properties.",
    matchers: ["ihg", "montage", "pendry"],
  },
  {
    name: "Travel",
    frequency: "annual",
    expectedAmount: 300,
    cycleStartMonth: 1,
    notes: "Resets on card anniversary year, not calendar year. Broad travel purchases (airlines, hotels, transit, etc.).",
  },
  {
    name: "StubHub / viagogo",
    frequency: "semiannual",
    expectedAmount: 150,
    cycleStartMonth: 1,
    notes: "$150 Jan–Jun and $150 Jul–Dec ($300/year). Activation required. StubHub.com and viagogo.com through Dec 31, 2027.",
    matchers: ["stubhub", "viagogo"],
  },
  {
    name: "Exclusive Tables dining",
    frequency: "semiannual",
    expectedAmount: 150,
    cycleStartMonth: 1,
    notes: "$150 Jan–Jun and $150 Jul–Dec ($300/year). Pay with CSR at Sapphire Reserve Exclusive Tables restaurants on OpenTable. Link card to OpenTable.",
    matchers: ["exclusive tables"],
  },
  {
    name: "DoorDash grocery",
    frequency: "monthly",
    expectedAmount: 10,
    cycleStartMonth: 1,
    notes: "First of two $10 monthly non-restaurant DoorDash promos (grocery, convenience, retail).",
    matchers: ["doordash"],
  },
  {
    name: "DoorDash grocery (2nd)",
    frequency: "monthly",
    expectedAmount: 10,
    cycleStartMonth: 1,
    notes: "Second $10 monthly non-restaurant DoorDash promo.",
    matchers: ["doordash"],
  },
  {
    name: "DoorDash restaurant",
    frequency: "monthly",
    expectedAmount: 5,
    cycleStartMonth: 1,
    notes: "$5 monthly DoorDash restaurant promo. DashPass is separate (activate by Dec 31, 2027).",
    matchers: ["doordash"],
  },
  {
    name: "Lyft",
    frequency: "monthly",
    expectedAmount: 10,
    cycleStartMonth: 1,
    notes: "$10 monthly in-app Lyft credit through Sep 30, 2027. Not Wait & Save, bikes, or scooters.",
    matchers: ["lyft"],
  },
];

export const AMEX_GOLD_BENEFITS: CatalogBenefit[] = [
  {
    name: "Dining (Grubhub+)",
    frequency: "monthly",
    expectedAmount: 10,
    cycleStartMonth: 1,
    notes: "Enrollment required. Grubhub/Seamless, Cheesecake Factory, Five Guys, Buffalo Wild Wings, Wonder. $10/month, does not roll over.",
    matchers: ["grubhub", "seamless", "cheesecake", "five guys", "buffalo wild"],
  },
  {
    name: "Uber Cash",
    frequency: "monthly",
    expectedAmount: 10,
    cycleStartMonth: 1,
    notes: "Add Gold as a payment method in Uber. $10 Uber Cash each month for US rides or Uber Eats. Unused Cash expires at month end.",
    matchers: ["uber"],
  },
  {
    name: "Resy",
    frequency: "semiannual",
    expectedAmount: 50,
    cycleStartMonth: 1,
    notes: "Enrollment required. $50 Jan–Jun and $50 Jul–Dec at US Resy restaurants. No reservation required.",
    matchers: ["resy"],
  },
  {
    name: "Dunkin'",
    frequency: "monthly",
    expectedAmount: 7,
    cycleStartMonth: 1,
    notes: "Enrollment required. $7/month at US Dunkin' locations (not airport/gas station shops or gift cards).",
    matchers: ["dunkin"],
  },
];

export const UNITED_EXPLORER_BENEFITS: CatalogBenefit[] = [
  {
    name: "Instacart",
    frequency: "monthly",
    expectedAmount: 10,
    cycleStartMonth: 1,
    notes: "$10/month through Instacart, through Dec 31, 2027.",
    matchers: ["instacart"],
  },
  {
    name: "Rideshare (Uber/Lyft)",
    frequency: "monthly",
    expectedAmount: 5,
    cycleStartMonth: 1,
    notes: "$5/month, up to $60/year. Yearly opt-in required. Uber, Lyft, taxi, limo — not Uber Eats.",
    matchers: ["uber", "lyft"],
  },
  {
    name: "Avis/Budget TravelBank (1st)",
    frequency: "annual",
    expectedAmount: 25,
    cycleStartMonth: 1,
    notes: "$25 United TravelBank on 1st Avis/Budget rental booked via cars.united.com each anniversary year.",
    matchers: ["avis", "budget"],
  },
  {
    name: "Avis/Budget TravelBank (2nd)",
    frequency: "annual",
    expectedAmount: 25,
    cycleStartMonth: 1,
    notes: "$25 United TravelBank on 2nd Avis/Budget rental via cars.united.com.",
    matchers: ["avis", "budget"],
  },
];

export const ALL_CATALOG_BENEFITS: CatalogBenefit[] = [
  ...SAPPHIRE_RESERVE_BENEFITS,
  ...AMEX_GOLD_BENEFITS,
  ...UNITED_EXPLORER_BENEFITS,
];

const MATCHERS_BY_NAME = new Map(
  ALL_CATALOG_BENEFITS.map((item) => [
    item.name.trim().toLowerCase(),
    item.matchers ?? [],
  ]),
);

/** Catalog merchant fragments for a saved benefit, matched by name. */
export function catalogMatchersForName(name: string): string[] {
  return MATCHERS_BY_NAME.get(name.trim().toLowerCase()) ?? [];
}
