import type { BenefitFrequency } from "./types";

/** Recurring statement credits to track. Not lounge access, insurance, or subscriptions. */
export type CatalogBenefit = {
  name: string;
  frequency: BenefitFrequency;
  expectedAmount: number | null;
  cycleStartMonth: number;
  notes: string;
};

export const SAPPHIRE_RESERVE_BENEFITS: CatalogBenefit[] = [
  {
    name: "The Edit (1st stay)",
    frequency: "annual",
    expectedAmount: 250,
    cycleStartMonth: 1,
    notes: "Two $250 credits per calendar year; cannot combine on one stay. Prepaid The Edit booking, 2-night minimum.",
  },
  {
    name: "The Edit (2nd stay)",
    frequency: "annual",
    expectedAmount: 250,
    cycleStartMonth: 1,
    notes: "Second $250 The Edit credit. Same two-night prepaid Chase Travel stay rules.",
  },
  {
    name: "Select hotels (IHG & others)",
    frequency: "annual",
    expectedAmount: 250,
    cycleStartMonth: 1,
    notes: "2026 only, through Dec 31. Prepaid Chase Travel, 2-night min. IHG, Montage, Pendry, Omni, Virgin, Minor, Pan Pacific. Can stack with The Edit on overlapping properties.",
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
  },
  {
    name: "Exclusive Tables dining",
    frequency: "semiannual",
    expectedAmount: 150,
    cycleStartMonth: 1,
    notes: "$150 Jan–Jun and $150 Jul–Dec ($300/year). Pay with CSR at Sapphire Reserve Exclusive Tables restaurants on OpenTable. Link card to OpenTable.",
  },
  {
    name: "DoorDash grocery",
    frequency: "monthly",
    expectedAmount: 10,
    cycleStartMonth: 1,
    notes: "First of two $10 monthly non-restaurant DoorDash promos (grocery, convenience, retail).",
  },
  {
    name: "DoorDash grocery (2nd)",
    frequency: "monthly",
    expectedAmount: 10,
    cycleStartMonth: 1,
    notes: "Second $10 monthly non-restaurant DoorDash promo.",
  },
  {
    name: "DoorDash restaurant",
    frequency: "monthly",
    expectedAmount: 5,
    cycleStartMonth: 1,
    notes: "$5 monthly DoorDash restaurant promo. DashPass is separate (activate by Dec 31, 2027).",
  },
  {
    name: "Lyft",
    frequency: "monthly",
    expectedAmount: 10,
    cycleStartMonth: 1,
    notes: "$10 monthly in-app Lyft credit through Sep 30, 2027. Not Wait & Save, bikes, or scooters.",
  },
  {
    name: "Peloton membership",
    frequency: "monthly",
    expectedAmount: 10,
    cycleStartMonth: 1,
    notes: "$10/month toward Peloton memberships through Dec 31, 2027. Activation required. Hide this if you don't use Peloton.",
  },
];

export const AMEX_GOLD_BENEFITS: CatalogBenefit[] = [
  {
    name: "Dining (Grubhub+)",
    frequency: "monthly",
    expectedAmount: 10,
    cycleStartMonth: 1,
    notes: "Enrollment required. Grubhub/Seamless, Cheesecake Factory, Five Guys, Buffalo Wild Wings, Wonder. $10/month, does not roll over.",
  },
  {
    name: "Uber Cash",
    frequency: "monthly",
    expectedAmount: 10,
    cycleStartMonth: 1,
    notes: "Add Gold as a payment method in Uber. $10 Uber Cash each month for US rides or Uber Eats. Unused Cash expires at month end.",
  },
  {
    name: "Resy",
    frequency: "semiannual",
    expectedAmount: 50,
    cycleStartMonth: 1,
    notes: "Enrollment required. $50 Jan–Jun and $50 Jul–Dec at US Resy restaurants. No reservation required.",
  },
  {
    name: "Dunkin'",
    frequency: "monthly",
    expectedAmount: 7,
    cycleStartMonth: 1,
    notes: "Enrollment required. $7/month at US Dunkin' locations (not airport/gas station shops or gift cards).",
  },
];

export const UNITED_EXPLORER_BENEFITS: CatalogBenefit[] = [
  {
    name: "Instacart",
    frequency: "monthly",
    expectedAmount: 10,
    cycleStartMonth: 1,
    notes: "$10/month through Instacart, through Dec 31, 2027.",
  },
  {
    name: "Rideshare (Uber/Lyft)",
    frequency: "monthly",
    expectedAmount: 5,
    cycleStartMonth: 1,
    notes: "$5/month, up to $60/year. Yearly opt-in required. Uber, Lyft, taxi, limo — not Uber Eats.",
  },
  {
    name: "United Hotels (1st stay)",
    frequency: "annual",
    expectedAmount: 50,
    cycleStartMonth: 1,
    notes: "$50 back on 1st prepaid United Hotels stay each anniversary year (up to $100 on two stays).",
  },
  {
    name: "United Hotels (2nd stay)",
    frequency: "annual",
    expectedAmount: 50,
    cycleStartMonth: 1,
    notes: "$50 back on 2nd prepaid United Hotels stay each anniversary year.",
  },
  {
    name: "Avis/Budget TravelBank (1st)",
    frequency: "annual",
    expectedAmount: 25,
    cycleStartMonth: 1,
    notes: "$25 United TravelBank on 1st Avis/Budget rental booked via cars.united.com each anniversary year.",
  },
  {
    name: "Avis/Budget TravelBank (2nd)",
    frequency: "annual",
    expectedAmount: 25,
    cycleStartMonth: 1,
    notes: "$25 United TravelBank on 2nd Avis/Budget rental via cars.united.com.",
  },
  {
    name: "United travel ($10k spend)",
    frequency: "annual",
    expectedAmount: 100,
    cycleStartMonth: 1,
    notes: "$100 United travel credit after $10,000 calendar-year spend.",
  },
  {
    name: "JSX flights",
    frequency: "annual",
    expectedAmount: 100,
    cycleStartMonth: 1,
    notes: "Up to $100/year on flights booked directly with JSX. Hide if you don't fly JSX.",
  },
];
