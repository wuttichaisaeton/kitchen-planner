import { CatalogItem } from '../types/kitchen'

const WIDTHS = [300, 400, 450, 600, 800, 900, 1000, 1200]

function makeBaseCabinets(): CatalogItem[] {
  return WIDTHS.map(w => ({
    id: `base-${w}`,
    category: 'base-cabinet' as const,
    nameTH: `${'\u0E15\u0E39\u0E49\u0E25\u0E48\u0E32\u0E07'} ${w}`,
    nameEN: `Base Cabinet ${w}`,
    width: w,
    depth: 600,
    height: 850,
    materialThickness: 1.0,
    priceBase: 2500 + w * 5,
  }))
}

function makeWallCabinets(): CatalogItem[] {
  return WIDTHS.filter(w => w <= 1000).map(w => ({
    id: `wall-${w}`,
    category: 'wall-cabinet' as const,
    nameTH: `${'\u0E15\u0E39\u0E49\u0E1A\u0E19'} ${w}`,
    nameEN: `Wall Cabinet ${w}`,
    width: w,
    depth: 350,
    height: 700,
    materialThickness: 0.8,
    priceBase: 1800 + w * 4,
  }))
}

const extras: CatalogItem[] = [
  {
    id: 'countertop-1000',
    category: 'countertop',
    nameTH: '\u0E40\u0E04\u0E32\u0E19\u0E4C\u0E40\u0E15\u0E2D\u0E23\u0E4C\u0E17\u0E47\u0E2D\u0E1B 1000',
    nameEN: 'Countertop 1000',
    width: 1000,
    depth: 600,
    height: 40,
    materialThickness: 1.2,
    priceBase: 3500,
  },
  {
    id: 'countertop-600',
    category: 'countertop',
    nameTH: '\u0E40\u0E04\u0E32\u0E19\u0E4C\u0E40\u0E15\u0E2D\u0E23\u0E4C\u0E17\u0E47\u0E2D\u0E1B 600',
    nameEN: 'Countertop 600',
    width: 600,
    depth: 600,
    height: 40,
    materialThickness: 1.2,
    priceBase: 2200,
  },
  {
    id: 'sink-single',
    category: 'sink',
    nameTH: '\u0E2D\u0E48\u0E32\u0E07\u0E25\u0E49\u0E32\u0E07\u0E08\u0E32\u0E19\u0E40\u0E14\u0E35\u0E48\u0E22\u0E27',
    nameEN: 'Single Bowl Sink',
    width: 500,
    depth: 450,
    height: 200,
    materialThickness: 1.0,
    priceBase: 4500,
  },
  {
    id: 'sink-double',
    category: 'sink',
    nameTH: '\u0E2D\u0E48\u0E32\u0E07\u0E25\u0E49\u0E32\u0E07\u0E08\u0E32\u0E19\u0E04\u0E39\u0E48',
    nameEN: 'Double Bowl Sink',
    width: 800,
    depth: 450,
    height: 200,
    materialThickness: 1.0,
    priceBase: 6500,
  },
  {
    id: 'shelf-600',
    category: 'accessory',
    nameTH: '\u0E0A\u0E31\u0E49\u0E19\u0E27\u0E32\u0E07 600',
    nameEN: 'Shelf 600',
    width: 600,
    depth: 300,
    height: 30,
    materialThickness: 1.0,
    priceBase: 800,
  },
  {
    id: 'drawer-600',
    category: 'accessory',
    nameTH: '\u0E25\u0E34\u0E49\u0E19\u0E0A\u0E31\u0E01 600',
    nameEN: 'Drawer Unit 600',
    width: 600,
    depth: 500,
    height: 200,
    materialThickness: 0.8,
    priceBase: 3200,
  },
]

export const catalogItems: CatalogItem[] = [
  ...makeBaseCabinets(),
  ...makeWallCabinets(),
  ...extras,
]

export const categoryLabels: Record<string, string> = {
  'base-cabinet': '\u0E15\u0E39\u0E49\u0E25\u0E48\u0E32\u0E07',
  'wall-cabinet': '\u0E15\u0E39\u0E49\u0E1A\u0E19',
  'countertop': '\u0E40\u0E04\u0E32\u0E19\u0E4C\u0E40\u0E15\u0E2D\u0E23\u0E4C\u0E17\u0E47\u0E2D\u0E1B',
  'sink': '\u0E2D\u0E48\u0E32\u0E07\u0E25\u0E49\u0E32\u0E07',
  'accessory': '\u0E2D\u0E38\u0E1B\u0E01\u0E23\u0E13\u0E4C',
}
