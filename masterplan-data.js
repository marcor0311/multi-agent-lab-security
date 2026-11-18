// Shared conceptual plan data. Source: masterplan.json.
window.ALPHA_MASTERPLAN = {
  "project": "Alpha Site — diseño oficial del campus",
  "version": "09",
  "units": "m",
  "origin": "southwest corner",
  "axes": {
    "x": "east",
    "y": "north"
  },
  "site": {
    "width": 240,
    "depth": 150
  },
  "buildings": [
    {
      "id": "A01",
      "name": "Administration and R&D",
      "x": 114,
      "y": 82,
      "width": 49,
      "depth": 37,
      "floors": 3,
      "atrium": {
        "x": 127,
        "y": 90,
        "width": 22,
        "depth": 17
      }
    },
    {
      "id": "L01",
      "name": "Laboratory 1",
      "x": 36,
      "y": 79,
      "width": 18,
      "depth": 39,
      "floors": 1
    },
    {
      "id": "L02",
      "name": "Laboratory 2",
      "x": 59,
      "y": 79,
      "width": 18,
      "depth": 39,
      "floors": 1
    },
    {
      "id": "L03",
      "name": "Laboratory 3",
      "x": 82,
      "y": 79,
      "width": 18,
      "depth": 39,
      "floors": 1
    },
    {
      "id": "L04",
      "name": "Support laboratory",
      "x": 36,
      "y": 56,
      "width": 65,
      "depth": 12,
      "floors": 1
    },
    {
      "id": "H01",
      "name": "Science pavilion",
      "x": 175,
      "y": 66,
      "width": 33,
      "depth": 50,
      "floors": 2,
      "core": {
        "x": 181,
        "y": 78,
        "width": 21,
        "depth": 26
      }
    },
    {
      "id": "P01",
      "name": "Prototyping",
      "x": 162,
      "y": 31,
      "width": 45,
      "depth": 21,
      "floors": 1
    },
    {
      "id": "S01",
      "name": "Integrated security operations station",
      "x": 108,
      "y": 2,
      "width": 16,
      "depth": 15,
      "floors": 1
    }
  ],
  "parking": {
    "id": "PK01",
    "x": 36,
    "y": 28,
    "width": 68,
    "depth": 23,
    "spaces": 42,
    "accessible_spaces": 2,
    "cover": false,
    "stall": {
      "width": 2.6,
      "depth": 5.2
    },
    "aisle_width": 6.4,
    "rows": 2,
    "aisle_y": 36.2,
    "stall_start_x": 41.6,
    "row_y": [
      31,
      42.6
    ],
    "standard_stalls_per_row": 20,
    "accessible_stall_width": 3.6,
    "accessible_aisle_width": 1.2,
    "driveway_width": 5.6
  },
  "roads": [
    {
      "id": "R01",
      "type": "rounded_rectangle_loop",
      "x": 18,
      "y": 24,
      "width": 204,
      "depth": 112,
      "radius": 12,
      "road_width": 8
    },
    {
      "id": "R02",
      "type": "entry_connector",
      "points": [
        [
          131,
          -12
        ],
        [
          131,
          24
        ]
      ],
      "road_width": 8.8
    },
    {
      "id": "R03",
      "type": "parking_entry",
      "points": [
        [
          38.8,
          24
        ],
        [
          38.8,
          39.4
        ]
      ],
      "road_width": 5.6
    },
    {
      "id": "R04",
      "type": "parking_exit",
      "points": [
        [
          101.2,
          24
        ],
        [
          101.2,
          39.4
        ]
      ],
      "road_width": 5.6
    }
  ],
  "gate": {
    "id": "G01",
    "x": 124,
    "y": 2,
    "width": 24,
    "depth": 12,
    "lanes": 2,
    "vehicle_lane_width": 4,
    "median_width": 0.8,
    "canopy": {
      "x": 120,
      "y": 3,
      "width": 27,
      "depth": 10
    },
    "pedestrian_portal": {
      "x": 149,
      "y": 2,
      "width": 8,
      "depth": 11
    },
    "sliding_gates": "white panels retracted into side pockets",
    "barriers": "long arms raised at the checkpoint, pedestals outside clear lanes"
  },
  "perimeter_security": {
    "wall_alignment": "conceptual_site_boundary",
    "wall_type": "continuous solid white architectural concrete wall",
    "wall_plan_thickness": 1.2,
    "main_opening_x": [
      124,
      148
    ],
    "pedestrian_opening_x": [
      149,
      157
    ],
    "secondary_fence": false,
    "controlled_opening": "G01 vehicle lanes and integrated pedestrian portal",
    "status": "conceptual_visualization",
    "note": "White wall replaces all secondary black fencing; conceptual geometry, not a surveyed or construction plan."
  },
  "plaza": {
    "id": "PL01",
    "x": 104,
    "y": 34,
    "width": 60,
    "depth": 42,
    "reflecting_pools": [
      {
        "x": 113,
        "y": 44,
        "width": 7,
        "depth": 18
      },
      {
        "x": 148,
        "y": 44,
        "width": 7,
        "depth": 18
      }
    ],
    "planters": [
      {
        "x": 108,
        "y": 44,
        "width": 2.5,
        "depth": 18
      },
      {
        "x": 122.5,
        "y": 44,
        "width": 2.5,
        "depth": 18
      },
      {
        "x": 143,
        "y": 44,
        "width": 2.5,
        "depth": 18
      },
      {
        "x": 157.5,
        "y": 44,
        "width": 2.5,
        "depth": 18
      }
    ],
    "benches": [
      {
        "x": 113,
        "y": 40,
        "width": 7,
        "depth": 1.5
      },
      {
        "x": 113,
        "y": 65,
        "width": 7,
        "depth": 1.5
      },
      {
        "x": 148,
        "y": 40,
        "width": 7,
        "depth": 1.5
      },
      {
        "x": 148,
        "y": 65,
        "width": 7,
        "depth": 1.5
      }
    ],
    "sculpture": {
      "x": 132,
      "y": 52,
      "width": 4,
      "depth": 4
    },
    "clear_pedestrian_axis_x": 138.5
  },
  "concept": "Revisión V09 / Concepto 02A: muro blanco sin valla interior, estación de seguridad integrada en la llegada, plaza decorativa y parqueo con pasillo central continuo. Las huellas de los siete edificios científicos se conservan de V08.",
  "design_notes": [
    "Conceptual V09 coordination based on the selected Concept 02A visualization; not a survey or construction plan.",
    "Seven scientific building footprints remain from V08. S01 is relocated to the south entry with an integrated gate canopy and pedestrian portal.",
    "PK01 retains 42 spaces including two accessible bays: two rows open directly onto a 6.4 m clear aisle, connected at both ends to ring-road driveways.",
    "Plaza reflecting pools, benches, sculpture and single-species hedge planters leave a continuous pedestrian route.",
    "White perimeter wall only; no secondary black fence and no cameras."
  ],
  "pedestrian_routes": [
    {
      "id": "W01",
      "name": "Protected pedestrian portal to plaza and administration",
      "width": 3,
      "points": [
        [
          153,
          13
        ],
        [
          153,
          29
        ],
        [
          138.5,
          29
        ],
        [
          138.5,
          82
        ]
      ]
    },
    {
      "id": "W02",
      "name": "Laboratory promenade",
      "width": 2.4,
      "points": [
        [
          29,
          74
        ],
        [
          138.5,
          74
        ],
        [
          138.5,
          82
        ]
      ]
    },
    {
      "id": "W03",
      "name": "Parking accessible bays to plaza",
      "width": 2.4,
      "points": [
        [
          97.8,
          28
        ],
        [
          106,
          28
        ],
        [
          106,
          34
        ],
        [
          110,
          34
        ]
      ]
    },
    {
      "id": "W04",
      "name": "South accessible bay connection",
      "width": 1.2,
      "points": [
        [
          97.8,
          31
        ],
        [
          97.8,
          28
        ]
      ]
    },
    {
      "id": "W05",
      "name": "North accessible bay connection",
      "width": 1.2,
      "points": [
        [
          97.8,
          47.8
        ],
        [
          97.8,
          52.8
        ],
        [
          106,
          52.8
        ],
        [
          106,
          34
        ]
      ]
    },
    {
      "id": "W06",
      "name": "Scientific hall entrance",
      "width": 2.4,
      "points": [
        [
          164,
          70
        ],
        [
          169,
          70
        ],
        [
          169,
          92
        ],
        [
          175,
          92
        ]
      ]
    },
    {
      "id": "W07",
      "name": "Prototyping entrance",
      "width": 2.4,
      "points": [
        [
          164,
          60
        ],
        [
          169,
          60
        ],
        [
          169,
          52
        ]
      ]
    },
    {
      "id": "W08",
      "name": "Security station protected personnel access",
      "width": 2,
      "points": [
        [
          153,
          17
        ],
        [
          119,
          17
        ]
      ]
    },
    {
      "id": "W09",
      "name": "Support lab entrance",
      "width": 2.4,
      "points": [
        [
          29,
          74
        ],
        [
          29,
          62
        ],
        [
          36,
          62
        ]
      ]
    },
    {
      "id": "W10",
      "name": "L01 entrance",
      "width": 2,
      "points": [
        [
          45,
          74
        ],
        [
          45,
          79
        ]
      ]
    },
    {
      "id": "W11",
      "name": "L02 entrance",
      "width": 2,
      "points": [
        [
          68,
          74
        ],
        [
          68,
          79
        ]
      ]
    },
    {
      "id": "W12",
      "name": "L03 entrance",
      "width": 2,
      "points": [
        [
          91,
          74
        ],
        [
          91,
          79
        ]
      ]
    }
  ],
  "pedestrian_design": {
    "surface": "light matte paving, flush with adjacent paths",
    "primary_clear_width_m": 3,
    "secondary_clear_width_m": 2,
    "rule": "Continuous clear pedestrian routes; plaza decoration in lateral islands, crossings at ring road and east parking driveway.",
    "crossings": [
      {
        "id": "X01",
        "road": "R01",
        "center_xy_m": [
          153,
          24
        ],
        "width_m": 8,
        "marking": "zebra across the south ring road"
      },
      {
        "id": "X02",
        "road": "R04",
        "center_xy_m": [
          101.2,
          28
        ],
        "width_m": 5.6,
        "marking": "flush zebra on accessible parking connection"
      }
    ],
    "accessibility_note": "Conceptual plan routes only. Verify local accessible-route clear widths, slopes, landings and tactile cues after survey."
  },
  "landscape_rule": "Uniform lawn and one repeated clipped low hedge species; no interior ornamental trees, mixed planting or secondary black fences. Pine forest outside the wall.",
  "route_graphics": "Continuous sidewalk surfaces with a single white outer edge; all white edging is drawn before paving so branch junctions remain clean.",
  "status": "conceptual_coordination",
  "visual_reference": "brochure/alpha_site_security_modular_v02a.png",
  "lighting": {
    "style": "integrated neutral-white linear lighting",
    "pole_locations": [
      [
        7,
        20
      ],
      [
        7,
        65
      ],
      [
        7,
        110
      ],
      [
        233,
        20
      ],
      [
        233,
        65
      ],
      [
        233,
        110
      ],
      [
        46,
        144
      ],
      [
        94,
        144
      ],
      [
        166,
        144
      ],
      [
        212,
        144
      ],
      [
        31,
        53
      ],
      [
        101,
        54.8
      ],
      [
        166,
        29.5
      ],
      [
        166,
        63
      ]
    ],
    "rule": "All light bases in grass verges, outside pedestrian routes and vehicle circulation; no cameras."
  }
};
