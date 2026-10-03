export type BP3DSystemId =
  | "skeletal"
  | "muscular"
  | "cardiac"
  | "arterial"
  | "venous"
  | "nervous"
  | "respiratory"
  | "digestive"
  | "urinary"
  | "lymphatic"
  | "endocrine"
  | "reproductive"
  | "integumentary"
  | "connective"
  | "sensory";

export interface BP3DSystemInfo {
  id: BP3DSystemId;
  name: string;
  nameId: string;
  color: string;
  description: string;
}

export const BP3D_SYSTEMS: BP3DSystemInfo[] = [
  {
    id: "skeletal",
    name: "Skeleton",
    nameId: "Rangka",
    color: "#e2d9ba",
    description: "Tulang membentuk kerangka penopang tubuh, melindungi organ dalam vital, dan tempat melekatnya otot rangka.",
  },
  {
    id: "muscular",
    name: "Muscles",
    nameId: "Otot Rangka",
    color: "#a85b50",
    description: "Otot rangka menghasilkan gerakan sadar melalui tarikan tendon, menjaga postur, dan memproduksi panas tubuh.",
  },
  {
    id: "cardiac",
    name: "Heart",
    nameId: "Jantung",
    color: "#b96760",
    description: "Organ pompa otot 4 ruang dengan katup yang mengalirkan darah ke sirkulasi pulmonalis dan sistemik.",
  },
  {
    id: "sensory",
    name: "Sensory organs",
    nameId: "Organ Sensorik",
    color: "#b0c8ce",
    description: "Organ indera penglihatan (mata), pendengaran, dan keseimbangan tubuh.",
  },
  {
    id: "arterial",
    name: "Arteries",
    nameId: "Arteri (Pembuluh Nadi)",
    color: "#c05245",
    description: "Membawa darah kaya oksigen dari jantung ke seluruh jaringan tubuh.",
  },
  {
    id: "venous",
    name: "Veins",
    nameId: "Vena (Pembuluh Balik)",
    color: "#527c9f",
    description: "Mengembalikan darah miskin oksigen dari jaringan tubuh kembali menuju jantung.",
  },
  {
    id: "nervous",
    name: "Nervous system",
    nameId: "Sistem Saraf",
    color: "#d8b565",
    description: "Otak, sumsum tulang belakang, dan saraf perifer yang mengoordinasikan sinyal motorik, sensorik, dan otonom.",
  },
  {
    id: "respiratory",
    name: "Respiratory",
    nameId: "Pernapasan",
    color: "#b98991",
    description: "Saluran napas, laring, trakea, dan paru-paru tempat terjadinya pertukaran oksigen dan karbon dioksida.",
  },
  {
    id: "digestive",
    name: "Digestive",
    nameId: "Pencernaan",
    color: "#b8916b",
    description: "Saluran cerna dari rongga mulut, lambung, hati, empedu, pankreas hingga usus dan rektum.",
  },
  {
    id: "urinary",
    name: "Urinary",
    nameId: "Perkemihan",
    color: "#b47961",
    description: "Ginjal, ureter, kandung kemih, dan uretra yang menyaring darah dan membuang zat sisa metabolisme dalam urine.",
  },
  {
    id: "lymphatic",
    name: "Lymphatic",
    nameId: "Limfatik & Imun",
    color: "#879f7c",
    description: "Kelenjar dan pembuluh getah bening yang memelihara keseimbangan cairan tubuh dan pertahanan imunologis.",
  },
  {
    id: "endocrine",
    name: "Endocrine",
    nameId: "Endokrin",
    color: "#c5a09a",
    description: "Kelenjar penghasil hormon yang mengatur metabolisme, pertumbuhan, dan homeostasis.",
  },
  {
    id: "reproductive",
    name: "Reproductive",
    nameId: "Reproduksi",
    color: "#bda098",
    description: "Organ sistem reproduksi yang memproduksi sel gamet dan hormon seksual.",
  },
  {
    id: "integumentary",
    name: "Body surface",
    nameId: "Permukaan Kulit",
    color: "#ba9b7d",
    description: "Lapisan kulit semi-transparan sebagai penunjuk kontur luar tubuh manusia.",
  },
  {
    id: "connective",
    name: "Connective tissue",
    nameId: "Jaringan Ikat & Ligamen",
    color: "#aec3bb",
    description: "Tulang rawan, ligamen sendi, dan fasia yang menstabilkan persendian dan mendistribusikan beban mekanis.",
  },
];

export interface BP3DPart {
  id: string;
  name: string;
  conceptId: string;
  system: BP3DSystemId;
  chunk: number;
  positions: number;
  normals: number;
  indices: number;
  vertexCount: number;
  indexCount: number;
  bounds: [number[], number[]];
}

export interface BP3DConcept {
  id: string;
  name: string;
  elements: string[];
}

export interface BP3DChunk {
  url: string;
  bytes: number;
  gzip?: string;
  gzipBytes?: number;
}

export interface BP3DAtlas {
  version: string;
  sex?: "male";
  source?: string;
  scope?: string;
  parts: BP3DPart[];
  concepts: BP3DConcept[];
  chunks: BP3DChunk[];
  triangles: number;
}

export type BP3DView = "three-quarter" | "front" | "back" | "side";

export interface BP3DSceneState {
  explode: number;
  visible: BP3DSystemId[];
  selected: string[];
  isolate: boolean;
  view: BP3DView;
  rotate: boolean;
  reset: number;
}

export const BP3D_DEFAULT_VISIBLE: BP3DSystemId[] = [
  "cardiac",
  "sensory",
  "skeletal",
  "muscular",
  "arterial",
  "venous",
  "nervous",
  "respiratory",
  "digestive",
  "urinary",
  "lymphatic",
  "endocrine",
  "reproductive",
  "connective",
];
