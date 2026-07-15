/**
 * Coarse world coastlines for the live-music map.
 *
 * Stored as geographic rings of `[lng, lat]` rather than a pre-baked SVG path
 * string, for one load-bearing reason: `map.ts` projects these through the
 * *same* `projectPoint` as the show pins, so the land and the dots can never
 * drift out of alignment — and re-fitting the viewBox to a user's shows zooms
 * both together for free.
 *
 * Fidelity is deliberately low. This is a stylized poster of where you've been,
 * not a cartographic reference: outlines are simplified to tens of points, small
 * islands and inland seas are omitted, and Antarctica is cropped. Rings are
 * traced along the coast in order; each is drawn as one closed path.
 *
 * **Every ring must be simple** — no segment may cross another in the same ring.
 * A self-intersecting ring doesn't just look wobbly, it fills its own interior:
 * an early draft traced all of Eurasia as one heroic outline and painted the
 * Mediterranean solid. Overlapping *separate* rings are free (same fill colour,
 * so seams are invisible), which is why Europe/Asia/Italy are split rather than
 * heroically traced in one go. `world.test.ts` enforces simplicity, keeps known
 * cities on land, and keeps known seas wet.
 */

/** A closed coastline ring: `[lng, lat]` pairs traced along the coast. */
export type Ring = readonly (readonly [number, number])[];

export interface LandMass {
  /** Debug/readability only — never rendered. */
  name: string;
  ring: Ring;
}

export const WORLD: readonly LandMass[] = [
  {
    name: 'North America',
    ring: [
      [-168, 65], [-162, 59], [-152, 59], [-146, 61], [-136, 58], [-130, 54],
      [-124, 48], [-124, 42], [-122, 37], [-118, 34], [-114, 30], [-110, 23],
      [-106, 23], [-100, 17], [-95, 16], [-92, 15], [-88, 16], [-84, 10],
      [-78, 9], [-83, 15], [-87, 21], [-91, 19], [-94, 29], [-90, 29],
      [-84, 30], [-82, 25], [-81, 32], [-76, 35], [-74, 41], [-70, 43],
      [-66, 45], [-60, 45], [-53, 48], [-56, 54], [-64, 58], [-78, 53],
      [-79, 60], [-70, 62], [-70, 70], [-85, 70], [-95, 69], [-110, 68],
      [-125, 70], [-140, 70], [-156, 71], [-166, 68],
    ],
  },
  {
    name: 'South America',
    ring: [
      [-77, 8], [-72, 12], [-62, 10], [-52, 5], [-50, 1], [-44, -2],
      [-38, -5], [-35, -8], [-38, -13], [-39, -18], [-43, -23], [-48, -25],
      [-52, -32], [-57, -35], [-62, -39], [-65, -45], [-68, -55], [-75, -50],
      [-74, -44], [-73, -40], [-72, -33], [-70, -24], [-70, -18], [-77, -12],
      [-81, -6], [-80, -2], [-78, 2], [-77, 6],
    ],
  },
  {
    name: 'Africa',
    ring: [
      // North coast west→east. Egypt reaches ~34°E (Sinai counted with Africa),
      // then down the Red Sea's western shore.
      [-6, 36], [3, 37], [10, 37], [20, 32], [25, 32], [30, 31], [34, 31],
      [34, 28], [37, 22], [40, 15], [44, 12], [51, 12], [48, 6], [45, 2], [41, -2],
      [40, -4], [39, -7], [40, -11], [40, -16], [35, -21], [33, -26],
      [31, -30], [26, -34], [18, -34], [15, -27], [12, -23], [12, -17],
      [13, -12], [12, -6], [9, -1], [9, 4], [6, 4], [3, 6], [0, 5],
      [-5, 5], [-9, 5], [-13, 8], [-15, 12], [-17, 15], [-16, 21],
      [-14, 27], [-10, 30], [-9, 33],
    ],
  },
  {
    // West of the Urals, bounded south by the Mediterranean. Overlaps Asia
    // around the Urals — invisible, and it keeps both rings simple.
    name: 'Europe',
    ring: [
      // Iberia north along the Atlantic
      [-9, 37], [-9, 43], [-1, 46], [-4, 48], [2, 51], [4, 53], [8, 55],
      [5, 59], [5, 62], [11, 64], [16, 68], [25, 71],
      // Arctic coast east to the Urals
      [33, 70], [40, 66], [45, 60], [48, 54],
      // South-east to the Black Sea
      [48, 50], [45, 47], [38, 46], [30, 46], [28, 41],
      // Down around Greece, back up the Adriatic
      [26, 40], [24, 37.5], [22, 37], [21, 39], [19, 40], [19, 42],
      // West along the northern Mediterranean (the Alps, not the boot — Italy
      // is its own ring, so this line can stay monotonic and simple)
      [13, 45], [7, 44], [3, 43], [0, 39], [-2, 37], [-6, 36],
    ],
  },
  {
    // East of the Urals plus Arabia and India. Traced Arctic → Pacific → SE Asia
    // → India → Arabia → Turkey → back north.
    name: 'Asia',
    ring: [
      // Arctic Russia, west to east
      [58, 68], [73, 72], [80, 74], [100, 76], [113, 74], [130, 72],
      [150, 70], [170, 68], [180, 65],
      // Pacific coast south
      [170, 60], [163, 57], [155, 50], [143, 53], [140, 45], [132, 43],
      [126, 38], [122, 31], [118, 24], [114, 22], [108, 16], [106, 10],
      [104, 2], [99, 7], [97, 16], [91, 22],
      // India's triangle
      [85, 19], [80, 13], [77, 8], [73, 18], [69, 22], [66, 25],
      // Arabia: the Gulf side, round the south coast, up the Red Sea
      [61, 25], [57, 25], [59, 22], [55, 17], [52, 15], [45, 13], [43, 12],
      [39, 21], [35, 28], [34, 31], [36, 36],
      // Turkey + the Black Sea, then north-east back to the Urals
      [30, 40], [28, 41], [30, 46], [38, 46], [45, 47], [50, 50], [55, 58],
    ],
  },
  {
    // The boot, as its own ring — trying to trace it inside a bigger outline is
    // what made the first draft self-intersect.
    name: 'Italy',
    ring: [
      [7, 44], [12, 46], [13, 45], [16, 41], [18, 40], [17, 39], [16, 38],
      [15, 38], [12, 41], [10, 43], [8, 44],
    ],
  },
  {
    // East coast north, then back down the west coast. Monotonic in latitude on
    // each side so the ring can't cross itself.
    name: 'Great Britain',
    ring: [
      [-5, 50], [-3, 51], [1, 51], [0, 53], [-1, 54], [-2, 56], [-3, 58],
      [-5, 58], [-6, 56], [-5, 54], [-4, 53], [-5, 52], [-5, 51],
    ],
  },
  {
    name: 'Ireland',
    ring: [[-10, 52], [-10, 55], [-7, 55], [-6, 54], [-6, 52], [-8, 51]],
  },
  {
    name: 'Iceland',
    ring: [[-24, 65], [-22, 66], [-14, 66], [-13, 65], [-18, 64], [-22, 64]],
  },
  {
    name: 'Greenland',
    ring: [
      [-45, 60], [-52, 65], [-55, 70], [-58, 75], [-45, 78], [-30, 79],
      [-20, 76], [-22, 70], [-30, 68], [-38, 65],
    ],
  },
  {
    name: 'Japan',
    ring: [
      [130, 31], [132, 34], [136, 35], [140, 35], [141, 39], [142, 43],
      [145, 44], [143, 44], [140, 41], [137, 37], [133, 35], [130, 33],
    ],
  },
  {
    name: 'Madagascar',
    ring: [[49, -12], [50, -16], [48, -22], [45, -25], [44, -21], [44, -16], [46, -13]],
  },
  {
    name: 'Sumatra',
    ring: [[95, 5], [99, 3], [104, -3], [106, -6], [104, -6], [98, 0], [94, 5]],
  },
  {
    name: 'Borneo',
    ring: [[109, 2], [113, 5], [117, 7], [119, 3], [117, -3], [110, -3], [109, 0]],
  },
  {
    name: 'Java',
    ring: [[105, -6], [110, -7], [114, -8], [114, -9], [108, -8], [105, -7]],
  },
  {
    name: 'Australia',
    ring: [
      [114, -22], [122, -18], [130, -12], [137, -12], [142, -11], [146, -19],
      [150, -22], [153, -25], [153, -30], [151, -34], [147, -38], [140, -38],
      [135, -35], [129, -32], [122, -34], [118, -34], [114, -29],
    ],
  },
  {
    name: 'Tasmania',
    ring: [[144, -41], [148, -41], [148, -43], [145, -43]],
  },
  {
    name: 'New Zealand (North)',
    ring: [[173, -35], [176, -37], [178, -38], [176, -41], [174, -41], [173, -38]],
  },
  {
    name: 'New Zealand (South)',
    ring: [[172, -41], [174, -43], [171, -45], [167, -46], [167, -44], [170, -42]],
  },
];
