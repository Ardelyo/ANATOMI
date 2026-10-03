export type SystemId =
  | "skeletal"
  | "muscular"
  | "circulatory"
  | "respiratory"
  | "digestive"
  | "nervous"
  | "urinary"
  | "endocrine"
  | "integumentary";

export interface SystemInfo {
  id: SystemId;
  label: string;
  color: string;
  /** opasitas awal pada layer ini */
  opacity: number;
  visible: boolean;
}

export const SYSTEMS: SystemInfo[] = [
  { id: "integumentary", label: "Kulit", color: "#9dbbe6", opacity: 0.1, visible: true },
  { id: "muscular", label: "Otot", color: "#c58f93", opacity: 1, visible: false },
  { id: "skeletal", label: "Rangka", color: "#e6e3da", opacity: 0.85, visible: true },
  { id: "circulatory", label: "Peredaran darah", color: "#bb6a73", opacity: 1, visible: true },
  { id: "respiratory", label: "Pernapasan", color: "#d3a3a9", opacity: 0.9, visible: true },
  { id: "digestive", label: "Pencernaan", color: "#cf9f7c", opacity: 1, visible: true },
  { id: "urinary", label: "Kemih", color: "#a2675f", opacity: 1, visible: true },
  { id: "endocrine", label: "Endokrin", color: "#d9a35f", opacity: 1, visible: true },
  { id: "nervous", label: "Saraf", color: "#d9cd96", opacity: 1, visible: true },
];

export const SYSTEM_BY_ID = Object.fromEntries(SYSTEMS.map((s) => [s.id, s])) as Record<SystemId, SystemInfo>;

export interface PartMeta {
  name: string;
  latin: string;
  system: SystemId;
  desc: string;
  tags?: string[];
}

const m = (system: SystemId, name: string, latin: string, desc: string, tags?: string[]): PartMeta => ({
  system,
  name,
  latin,
  desc,
  tags,
});

export const CATALOG: Record<string, PartMeta> = {
  // ───── Rangka
  cranium: m("skeletal", "Tengkorak (kranium)", "Cranium", "Kotak tulang yang melindungi otak, tersusun dari tulang frontal, parietal, temporal, oksipital, sfenoid, dan etmoid yang disatukan oleh sutura.", ["skull"]),
  "frontal-bone": m("skeletal", "Tulang dahi", "Os frontale", "Membentuk dahi, atap rongga mata (orbita), dan bagian depan lantai kranium anterior.", ["skull", "cranium"]),
  "parietal-bone": m("skeletal", "Tulang ubun-ubun", "Os parietale", "Sepasang tulang kubah tengkorak yang membentuk atap dan sisi samping kranium, bertemu di sutura sagitalis.", ["skull", "cranium"]),
  "temporal-bone": m("skeletal", "Tulang pelipis", "Os temporale", "Membentuk dasar dan sisi samping tengkorak; memuat organ pendengaran dan keseimbangan, prosesus mastoid, serta prosesus stiloid.", ["skull", "cranium"]),
  "occipital-bone": m("skeletal", "Tulang kepala belakang", "Os occipitale", "Membentuk bagian belakang dan dasar tempurung kepala; ditembus oleh foramen magnum tempat lewatnya sumsum tulang belakang.", ["skull", "cranium"]),
  "sphenoid-bone": m("skeletal", "Tulang baji", "Os sphenoidale", "Tulang berbentuk kelelawar di dasar tengkorak yang menghubungkan tulang kranial dan fasial; memuat sela tursika tempat kelenjar hipofisis.", ["skull", "cranium"]),
  mandible: m("skeletal", "Rahang bawah", "Mandibula", "Satu-satunya tulang kepala yang dapat bergerak; bersendi dengan tulang temporal pada sendi temporomandibular.", ["skull"]),
  maxilla: m("skeletal", "Rahang atas", "Maxilla", "Membentuk langit-langit keras, dasar rongga mata, dan tempat tumbuh gigi atas.", ["skull"]),
  zygomatic: m("skeletal", "Tulang pipi", "Os zygomaticum", "Membentuk tonjolan pipi dan sebagian dinding luar rongga mata.", ["skull"]),
  "nasal-bone": m("skeletal", "Tulang hidung", "Os nasale", "Sepasang tulang kecil yang membentuk batang hidung bagian atas.", ["skull"]),
  hyoid: m("skeletal", "Tulang lidah", "Os hyoideum", "Tulang berbentuk U di leher depan yang tidak bersendi dengan tulang lain; menjadi penambat otot lidah dan laring.", ["neck"]),
  "teeth-upper": m("skeletal", "Gigi atas", "Dentes maxillares", "Deretan gigi pada rahang atas untuk memotong dan menggiling makanan.", ["teeth"]),
  "teeth-lower": m("skeletal", "Gigi bawah", "Dentes mandibulares", "Deretan gigi pada rahang bawah.", ["teeth"]),
  sacrum: m("skeletal", "Tulang kelangkang", "Os sacrum", "Lima ruas menyatu berbentuk baji, menghubungkan tulang belakang dengan panggul melalui sendi sakroiliaka.", ["spine", "pelvis"]),
  coccyx: m("skeletal", "Tulang ekor", "Os coccygis", "Sisa ruas ekor (3–5 ruas menyatu) di ujung bawah tulang belakang.", ["spine", "pelvis"]),
  manubrium: m("skeletal", "Manubrium", "Manubrium sterni", "Bagian atas tulang dada; bersendi dengan klavikula dan iga pertama–kedua.", ["ribcage", "sternum"]),
  "sternal-body": m("skeletal", "Badan sternum", "Corpus sterni", "Bagian tengah tulang dada tempat melekat tulang rawan iga 2–7.", ["ribcage", "sternum"]),
  "xiphoid-process": m("skeletal", "Prosesus xifoid", "Processus xiphoideus", "Ujung tulang rawan di bawah sternum; titik penanda untuk kompresi dada dan perlekatan diafragma.", ["ribcage", "sternum"]),
  "costal-cartilage": m("skeletal", "Tulang rawan iga", "Cartilago costalis", "Menghubungkan ujung depan iga dengan sternum sehingga rongga dada lentur saat bernapas.", ["ribcage"]),
  clavicle: m("skeletal", "Tulang selangka", "Clavicula", "Tulang berbentuk S yang menahan bahu menjauh dari dada; paling sering patah akibat jatuh ke bahu.", ["shoulder"]),
  scapula: m("skeletal", "Tulang belikat", "Scapula", "Tulang pipih segitiga di punggung atas dengan rongga glenoid untuk kepala humerus.", ["shoulder"]),
  humerus: m("skeletal", "Tulang lengan atas", "Humerus", "Tulang panjang lengan atas; kepala bulatnya masuk ke glenoid, ujung bawahnya membentuk siku.", ["arm-bone"]),
  radius: m("skeletal", "Tulang pengumpil", "Radius", "Tulang lengan bawah di sisi ibu jari; ujung bawahnya sering patah (fraktur Colles).", ["arm-bone"]),
  ulna: m("skeletal", "Tulang hasta", "Ulna", "Tulang lengan bawah sisi jari kelingking; olekranon membentuk ujung siku.", ["arm-bone"]),
  carpals: m("skeletal", "Tulang pergelangan tangan", "Ossa carpi", "Delapan tulang kecil dalam dua baris yang memberi fleksibilitas pergelangan; terowongan karpal dilalui saraf median.", ["hand"]),
  metacarpals: m("skeletal", "Tulang telapak tangan", "Ossa metacarpi", "Lima tulang telapak yang menghubungkan pergelangan dengan jari.", ["hand"]),
  "phalanges-hand": m("skeletal", "Ruas jari tangan", "Phalanges manus", "14 ruas jari: dua pada ibu jari, tiga pada tiap jari lainnya.", ["hand"]),
  ilium: m("skeletal", "Tulang usus", "Os ilium", "Bagian panggul terbesar berbentuk sayap; krista iliaka mudah diraba di pinggang.", ["pelvis"]),
  ischium: m("skeletal", "Tulang duduk", "Os ischii", "Bagian bawah-belakang panggul; tuberositas iskium menopang tubuh saat duduk.", ["pelvis"]),
  pubis: m("skeletal", "Tulang kemaluan", "Os pubis", "Bagian depan panggul; kedua sisi bertemu di simfisis pubis.", ["pelvis"]),
  femur: m("skeletal", "Tulang paha", "Femur", "Tulang terpanjang dan terkuat; leher femur adalah lokasi patah pinggul tersering pada lansia.", ["leg-bone"]),
  patella: m("skeletal", "Tempurung lutut", "Patella", "Tulang sesamoid dalam tendon otot kuadriseps yang meningkatkan daya ungkit ekstensi lutut.", ["knee"]),
  tibia: m("skeletal", "Tulang kering", "Tibia", "Tulang penopang beban utama tungkai bawah.", ["leg-bone"]),
  fibula: m("skeletal", "Tulang betis", "Fibula", "Tulang ramping di sisi luar tungkai bawah; tidak menopang banyak beban tetapi menstabilkan pergelangan kaki.", ["leg-bone"]),
  calcaneus: m("skeletal", "Tulang tumit", "Calcaneus", "Tulang tarsal terbesar; tendon Achilles melekat di bagian belakangnya.", ["foot"]),
  tarsals: m("skeletal", "Tulang pergelangan kaki", "Ossa tarsi", "Talus, navikular, kuboid, dan tulang baji yang membentuk lengkung kaki.", ["foot"]),
  metatarsals: m("skeletal", "Tulang telapak kaki", "Ossa metatarsi", "Lima tulang telapak kaki; metatarsal pertama menumpu sebagian besar beban saat mendorong tubuh.", ["foot"]),
  "phalanges-foot": m("skeletal", "Ruas jari kaki", "Phalanges pedis", "14 ruas jari kaki; ibu jari kaki (hallux) hanya punya dua ruas.", ["foot"]),

  // ───── Otot
  masseter: m("muscular", "Otot masseter", "M. masseter", "Otot pengunyah paling kuat; menutup rahang.", ["head-muscle"]),
  temporalis: m("muscular", "Otot temporalis", "M. temporalis", "Otot berbentuk kipas di pelipis yang menutup dan menarik rahang ke belakang.", ["head-muscle"]),
  sternocleidomastoid: m("muscular", "Otot sternokleidomastoid", "M. sternocleidomastoideus", "Memutar dan menekuk kepala; penanda utama segitiga leher.", ["neck-muscle"]),
  trapezius: m("muscular", "Otot trapezius", "M. trapezius", "Otot lebar berbentuk layang-layang di punggung atas yang mengangkat, menarik, dan memutar belikat.", ["back-muscle"]),
  "latissimus-dorsi": m("muscular", "Otot latissimus dorsi", "M. latissimus dorsi", "Otot punggung terlebar; menarik lengan ke bawah dan ke belakang.", ["back-muscle"]),
  "erector-spinae": m("muscular", "Otot erektor spinae", "M. erector spinae", "Kelompok otot panjang di sisi tulang belakang yang menegakkan punggung.", ["back-muscle"]),
  "pectoralis-major": m("muscular", "Otot pektoralis mayor", "M. pectoralis major", "Otot dada besar yang menggerakkan lengan ke depan dan ke dalam.", ["chest-muscle"]),
  "pectoralis-minor": m("muscular", "Otot pektoralis minor", "M. pectoralis minor", "Otot segitiga tipis di bawah pektoralis mayor yang menarik belikat ke bawah dan depan serta membantu inspirasi dalam.", ["chest-muscle"]),
  intercostals: m("muscular", "Otot antartulang iga", "Mm. intercostales", "Otot di antara celah iga yang mengangkat dan menurunkan dinding dada saat bernapas.", ["chest-muscle", "breathing"]),
  "rectus-abdominis": m("muscular", "Otot rektus abdominis", "M. rectus abdominis", "Otot 'six-pack' yang menekuk badan; dibagi oleh intersepsi tendon.", ["abdominal-muscle"]),
  "external-oblique": m("muscular", "Otot oblik eksternus", "M. obliquus externus abdominis", "Otot sisi perut terluar; memutar dan menekuk batang tubuh serta menekan isi perut.", ["abdominal-muscle"]),
  "gluteus-maximus": m("muscular", "Otot gluteus maksimus", "M. gluteus maximus", "Otot bokong besar yang mengekstensikan pinggul; penting untuk berdiri dari duduk dan menaiki tangga.", ["hip-muscle"]),
  deltoid: m("muscular", "Otot deltoid", "M. deltoideus", "Membentuk kontur bulat bahu dan mengangkat lengan ke samping.", ["arm-muscle"]),
  "biceps-brachii": m("muscular", "Otot bisep", "M. biceps brachii", "Menekuk siku dan memutar lengan bawah ke arah telapak menghadap atas.", ["arm-muscle"]),
  "triceps-brachii": m("muscular", "Otot trisep", "M. triceps brachii", "Meluruskan siku; otot utama bagian belakang lengan atas.", ["arm-muscle"]),
  "forearm-flexors": m("muscular", "Otot fleksor lengan bawah", "Mm. flexores antebrachii", "Menekuk pergelangan tangan dan jari.", ["arm-muscle"]),
  "forearm-extensors": m("muscular", "Otot ekstensor lengan bawah", "Mm. extensores antebrachii", "Meluruskan pergelangan tangan dan jari; terlibat pada 'tennis elbow'.", ["arm-muscle"]),
  "rectus-femoris": m("muscular", "Otot rektus femoris", "M. rectus femoris", "Bagian kuadriseps yang melintasi pinggul dan lutut; menekuk pinggul dan meluruskan lutut.", ["quadriceps", "leg-muscle"]),
  "vastus-lateralis": m("muscular", "Otot vastus lateralis", "M. vastus lateralis", "Bagian kuadriseps terbesar di sisi luar paha.", ["quadriceps", "leg-muscle"]),
  "vastus-medialis": m("muscular", "Otot vastus medialis", "M. vastus medialis", "Bagian kuadriseps sisi dalam yang menstabilkan tempurung lutut.", ["quadriceps", "leg-muscle"]),
  sartorius: m("muscular", "Otot sartorius", "M. sartorius", "Otot terpanjang tubuh, melintang miring di paha depan.", ["leg-muscle"]),
  "iliotibial-tract": m("muscular", "Traktus iliotibialis (IT band)", "Tractus iliotibialis", "Pita jaringan ikat fibrosa tebal di sisi luar paha yang menstabilkan lutut dan pinggul saat berlari dan berdiri.", ["leg-muscle"]),
  adductors: m("muscular", "Otot adduktor paha", "Mm. adductores", "Menarik paha ke arah garis tengah tubuh.", ["leg-muscle"]),
  "biceps-femoris": m("muscular", "Otot bisep femoris", "M. biceps femoris", "Hamstring sisi luar; menekuk lutut dan meluruskan pinggul.", ["hamstrings", "leg-muscle"]),
  semitendinosus: m("muscular", "Otot semitendinosus", "M. semitendinosus", "Hamstring sisi dalam dengan tendon panjang.", ["hamstrings", "leg-muscle"]),
  gastrocnemius: m("muscular", "Otot betis (gastroknemius)", "M. gastrocnemius", "Otot betis dua kepala yang mengangkat tumit; melekat ke tumit melalui tendon Achilles.", ["leg-muscle"]),
  soleus: m("muscular", "Otot soleus betis", "M. soleus", "Otot betis lebar di bawah gastroknemius; pompa vena utama tungkai bawah ('jantung kedua') saat berdiri tegak.", ["leg-muscle"]),
  "tibialis-anterior": m("muscular", "Otot tibialis anterior", "M. tibialis anterior", "Mengangkat punggung kaki (dorsofleksi) sehingga ujung kaki tidak tersandung.", ["leg-muscle"]),
  "achilles-tendon": m("muscular", "Tendon Achilles", "Tendo calcaneus", "Tendon terkuat dan terbesar tubuh; menghubungkan otot betis ke tulang tumit.", ["leg-muscle"]),
  "patellar-ligament": m("muscular", "Ligamen tempurung lutut", "Ligamentum patellae", "Lanjutan tendon kuadriseps dari patella ke tuberositas tibia; lokasi pengetukan refleks lutut (refleks patela).", ["knee", "leg-muscle"]),

  // ───── Peredaran darah
  "right-atrium": m("circulatory", "Serambi kanan", "Atrium dextrum", "Menerima darah miskin oksigen dari vena kava; di dindingnya terdapat nodus sinoatrial, pemacu irama jantung.", ["heart"]),
  "right-ventricle": m("circulatory", "Bilik kanan", "Ventriculus dexter", "Memompa darah ke paru melalui arteri pulmonalis.", ["heart"]),
  "left-atrium": m("circulatory", "Serambi kiri", "Atrium sinistrum", "Menerima darah kaya oksigen dari empat vena pulmonalis; tempat pembentukan bekuan pada fibrilasi atrium.", ["heart"]),
  "left-ventricle": m("circulatory", "Bilik kiri", "Ventriculus sinister", "Ruang berdinding paling tebal yang memompa darah ke seluruh tubuh melalui aorta.", ["heart"]),
  "left-coronary-artery": m("circulatory", "Arteri koroner kiri", "A. coronaria sinistra", "Bercabang dari sinus aorta kiri, memperdarahi dinding ventrikel kiri dan septum interventrikular.", ["heart", "vessels", "coronary"]),
  "anterior-interventricular-artery": m("circulatory", "Arteri desenden anterior kiri (LAD)", "Ramus interventricularis anterior", "Cabang arteri koroner kiri terpenting ('the widow maker'); sumbatannya memicu infark miokard luas dinding anterior.", ["heart", "vessels", "coronary"]),
  "circumflex-artery": m("circulatory", "Cabang sirkumfleksa kiri", "Ramus circumflexus", "Melingkari sulkus koroner kiri untuk memperdarahi dinding lateral dan posterior ventrikel kiri.", ["heart", "vessels", "coronary"]),
  "right-coronary-artery": m("circulatory", "Arteri koroner kanan", "A. coronaria dextra", "Memperdarahi atrium kanan, ventrikel kanan, nodus SA, dan nodus AV; oklusi menyebabkan infark miokard inferior.", ["heart", "vessels", "coronary"]),
  "cardiac-vein": m("circulatory", "Vena kardiak & sinus koronarius", "V. cardiaca & Sinus coronarius", "Mengumpulkan darah vena dari miokardium dan bermuara langsung ke serambi kanan.", ["heart", "vessels", "coronary"]),
  aorta: m("circulatory", "Aorta", "Aorta", "Arteri terbesar; membentuk lengkung aorta di dada, turun sebagai aorta torakalis dan abdominalis, lalu bercabang menjadi arteri iliaka.", ["vessels"]),
  "celiac-trunk": m("circulatory", "Trunkus seliakus", "Truncus coeliacus", "Cabang aorta abdominalis pertama yang memperdarahi lambung, hati, limpa, dan sebagian duodenum.", ["vessels"]),
  "superior-mesenteric-artery": m("circulatory", "Arteri mesenterika superior (SMA)", "A. mesenterica superior", "Memasok darah kaya oksigen ke seluruh usus halus, sekum, apendiks, dan dua pertiga kolon transversum.", ["vessels"]),
  "inferior-mesenteric-artery": m("circulatory", "Arteri mesenterika inferior (IMA)", "A. mesenterica inferior", "Memperdarahi kolon desenden, kolon sigmoid, dan sebagian besar rektum.", ["vessels"]),
  "pulmonary-trunk": m("circulatory", "Batang arteri pulmonalis", "Truncus pulmonalis", "Membawa darah miskin oksigen dari bilik kanan ke paru.", ["vessels"]),
  "vena-cava-superior": m("circulatory", "Vena kava superior", "Vena cava superior", "Mengalirkan darah dari kepala, leher, dan lengan ke serambi kanan.", ["vessels"]),
  "vena-cava-inferior": m("circulatory", "Vena kava inferior", "Vena cava inferior", "Vena terbesar; mengalirkan darah dari tubuh bagian bawah ke serambi kanan.", ["vessels"]),
  "carotid-artery": m("circulatory", "Arteri karotis", "A. carotis communis", "Memasok darah ke otak, wajah, dan leher; denyutnya teraba di sisi leher. Penyempitan karotis merupakan penyebab stroke.", ["vessels", "neck"]),
  "jugular-vein": m("circulatory", "Vena jugularis", "V. jugularis interna", "Mengalirkan darah dari otak dan wajah kembali ke jantung.", ["vessels", "neck"]),
  "subclavian-artery": m("circulatory", "Arteri subklavia", "A. subclavia", "Memasok darah ke lengan, bagian leher, dan sebagian otak.", ["vessels"]),
  "brachial-artery": m("circulatory", "Arteri brakialis", "A. brachialis", "Arteri utama lengan atas; tempat pengukuran tekanan darah dengan manset.", ["vessels"]),
  "iliac-artery": m("circulatory", "Arteri iliaka", "A. iliaca communis", "Cabang aorta yang memasok panggul dan tungkai.", ["vessels"]),
  "femoral-artery": m("circulatory", "Arteri femoralis", "A. femoralis", "Arteri utama paha; denyut dapat diraba di lipat paha.", ["vessels"]),
  "femoral-vein": m("circulatory", "Vena femoralis", "V. femoralis", "Vena dalam paha; tempat tersering terjadinya trombosis vena dalam.", ["vessels"]),
  "tibial-artery": m("circulatory", "Arteri tibialis", "A. tibialis", "Memasok tungkai bawah dan kaki.", ["vessels"]),
  "renal-artery": m("circulatory", "Arteri renalis", "A. renalis", "Cabang aorta yang menyalurkan sekitar seperlima curah jantung ke ginjal.", ["vessels"]),
  "portal-vein": m("circulatory", "Vena porta hati", "V. portae hepatis", "Membawa darah kaya nutrien dari usus dan limpa ke hati.", ["vessels"]),
  "renal-vein": m("circulatory", "Vena renalis", "V. renalis", "Mengalirkan darah tersaring dari ginjal ke vena kava inferior; vena renalis kiri melintas di depan aorta abdominalis.", ["vessels"]),
  "common-iliac-vein": m("circulatory", "Vena iliaka komunis", "V. iliaca communis", "Mengalirkan darah dari tungkai dan organ panggul menuju vena kava inferior.", ["vessels"]),
  "lymph-nodes": m("circulatory", "Kelenjar getah bening", "Nodi lymphoidei", "Jaringan penyaring getah bening di leher, ketiak, dan lipat paha yang memproduksi sel imun serta melawan infeksi dan keganasan.", ["lymphatic", "immune"]),
  spleen: m("circulatory", "Limpa", "Splen (Lien)", "Menyaring darah, mendaur ulang sel darah merah tua, dan menjadi bagian imunitas. Rentan pecah akibat trauma perut kiri atas.", ["abdomen-organ"]),

  // ───── Pernapasan
  larynx: m("respiratory", "Laring (pita suara)", "Larynx", "Kotak suara; tulang rawan tiroid membentuk 'jakun'. Epiglotis menutup saluran napas saat menelan.", ["airway", "neck"]),
  "cricoid-cartilage": m("respiratory", "Tulang rawan krikoid", "Cartilago cricoidea", "Cincin tulang rawan lengkap satu-satunya pada laring; penanda anatomis batas bawah saluran napas atas setinggi C6.", ["airway", "neck"]),
  epiglottis: m("respiratory", "Epiglotis", "Epiglottis", "Katup tulang rawan elastis berbentuk daun yang menutup laring saat menelan agar makanan tidak masuk ke paru-paru.", ["airway", "neck"]),
  trachea: m("respiratory", "Trakea", "Trachea", "Pipa napas sepanjang ±11 cm yang ditopang cincin tulang rawan berbentuk C.", ["airway"]),
  carina: m("respiratory", "Karina trakea", "Carina tracheae", "Tonjolan tulang rawan di percabangan trakea menjadi bronkus utama kiri dan kanan; sangat sensitif terhadap refleks batuk.", ["airway"]),
  bronchus: m("respiratory", "Bronkus utama", "Bronchus principalis", "Cabang trakea menuju paru; bronkus kanan lebih lebar dan vertikal sehingga benda asing lebih sering masuk ke kanan.", ["airway", "bronchi"]),
  "lobe-superior": m("respiratory", "Lobus atas paru", "Lobus superior pulmonis", "Lobus paru bagian atas; lokasi khas tuberkulosis reaktivasi.", ["lung"]),
  "lobe-middle": m("respiratory", "Lobus tengah paru kanan", "Lobus medius pulmonis dextri", "Hanya ada pada paru kanan, memisah oleh fisura horizontal.", ["lung"]),
  "lobe-inferior": m("respiratory", "Lobus bawah paru", "Lobus inferior pulmonis", "Lobus terbesar yang mengembang saat napas dalam; sering terlibat pada pneumonia aspirasi.", ["lung"]),
  diaphragm: m("respiratory", "Diafragma", "Diaphragma", "Otot berbentuk kubah di antara dada dan perut; berkontraksi mendatar saat menarik napas.", ["breathing"]),

  // ───── Pencernaan
  tongue: m("digestive", "Lidah", "Lingua", "Organ otot di dasar mulut untuk mengecap rasa, membantu mastikasi, menelan, dan artikulasi bicara.", ["oral-cavity"]),
  pharynx: m("digestive", "Faring (tekak)", "Pharynx", "Saluran persimpangan pernapasan dan pencernaan dari belakang rongga hidung/mulut hingga kerongkongan.", ["gi-tract", "neck"]),
  esophagus: m("digestive", "Kerongkongan", "Oesophagus", "Pipa otot ±25 cm yang mendorong makanan ke lambung dengan gerak peristaltik.", ["gi-tract"]),
  stomach: m("digestive", "Lambung", "Gaster (Ventriculus)", "Kantong otot yang mengaduk makanan dengan asam lambung dan enzim; mampu menampung 1–1,5 liter.", ["gi-tract"]),
  "liver-right-lobe": m("digestive", "Lobus kanan hati", "Lobus dexter hepatis", "Bagian terbesar hati; mensintesis protein, menetralkan racun, dan menghasilkan empedu.", ["liver"]),
  "liver-left-lobe": m("digestive", "Lobus kiri hati", "Lobus sinister hepatis", "Lobus yang lebih kecil, memanjang melewati garis tengah di bawah jantung.", ["liver"]),
  gallbladder: m("digestive", "Kandung empedu", "Vesica biliaris", "Menyimpan dan memekatkan empedu; berkontraksi setelah makan berlemak.", ["gi-tract"]),
  "bile-duct": m("digestive", "Saluran empedu utama", "Ductus choledochus", "Menyalurkan cairan empedu dari hati dan kandung empedu menuju duodenum untuk mengemulsikan lemak.", ["gi-tract"]),
  pancreas: m("digestive", "Pankreas", "Pancreas", "Kelenjar ganda: enzim pencernaan (eksokrin) dan insulin/glukagon (endokrin).", ["gi-tract"]),
  "pancreatic-duct": m("digestive", "Saluran pankreas", "Ductus pancreaticus", "Saluran pembawa enzim pencernaan bikarbonat dan lipase/amilase dari pankreas ke duodenum.", ["gi-tract"]),
  duodenum: m("digestive", "Usus dua belas jari", "Duodenum", "Bagian pertama usus halus berbentuk C, tempat empedu dan enzim pankreas masuk.", ["small-intestine", "gi-tract"]),
  jejunum: m("digestive", "Usus kosong", "Jejunum", "Bagian usus halus tempat sebagian besar nutrien diserap.", ["small-intestine", "gi-tract"]),
  ileum: m("digestive", "Usus penyerapan", "Ileum", "Bagian akhir usus halus; menyerap vitamin B12 dan garam empedu, bermuara ke sekum.", ["small-intestine", "gi-tract"]),
  cecum: m("digestive", "Sekum (usus buntu besar)", "Caecum", "Kantong awal usus besar di perut kanan bawah; tempat menempelnya apendiks.", ["large-intestine", "gi-tract"]),
  appendix: m("digestive", "Apendiks (usus buntu)", "Appendix vermiformis", "Tabung buntu sepanjang ±9 cm dari sekum; peradangannya (apendisitis) adalah penyebab tersering operasi perut darurat.", ["large-intestine", "gi-tract"]),
  "ascending-colon": m("digestive", "Kolon asenden", "Colon ascendens", "Naik di sisi kanan perut dan menyerap air serta elektrolit.", ["large-intestine", "gi-tract"]),
  "transverse-colon": m("digestive", "Kolon transversum", "Colon transversum", "Melintang di perut atas dari fleksura hepatika ke fleksura splenika.", ["large-intestine", "gi-tract"]),
  "descending-colon": m("digestive", "Kolon desenden", "Colon descendens", "Turun di sisi kiri perut dan menyimpan feses.", ["large-intestine", "gi-tract"]),
  "sigmoid-colon": m("digestive", "Kolon sigmoid", "Colon sigmoideum", "Bagian berbentuk S sebelum rektum; lokasi tersering divertikulitis.", ["large-intestine", "gi-tract"]),
  rectum: m("digestive", "Rektum", "Rectum", "Bagian akhir usus besar yang menampung feses sebelum dikeluarkan melalui anus.", ["large-intestine", "gi-tract"]),

  // ───── Saraf
  cerebrum: m("nervous", "Otak besar (hemisfer serebri)", "Cerebrum", "Pusat pikiran, ingatan, bahasa, gerak sadar, dan sensasi. Hemisfer kiri dan kanan dihubungkan korpus kalosum.", ["brain"]),
  cerebellum: m("nervous", "Otak kecil", "Cerebellum", "Mengoordinasi gerak halus, keseimbangan, dan postur.", ["brain"]),
  brainstem: m("nervous", "Batang otak", "Truncus encephali", "Mengendalikan pernapasan, denyut jantung, dan kesadaran; menghubungkan otak dengan sumsum tulang belakang.", ["brain"]),
  "optic-nerve": m("nervous", "Saraf optik & kiasma", "N. opticus (N. II)", "Membawa impuls penglihatan dari retina menuju korteks visual otak; persilangan serabut terjadi di kiasma optikum.", ["head", "nerve", "cns"]),
  "olfactory-bulb": m("nervous", "Bulbus olfaktorius", "Bulbus & tractus olfactorius (N. I)", "Pusat penerima sinyal saraf penciuman dari hidung ke sistem limbik otak.", ["head", "nerve"]),
  "trigeminal-nerve": m("nervous", "Saraf trigeminus", "N. trigeminus (N. V)", "Saraf kranial terbesar; mempersarafi sensasi sensorik wajah dan motorik otot mengunyah.", ["head", "nerve"]),
  "spinal-cord": m("nervous", "Sumsum tulang belakang", "Medulla spinalis", "Jalur utama sinyal antara otak dan tubuh; berakhir setinggi L1–L2 lalu berlanjut sebagai kauda ekuina.", ["spine", "cns"]),
  "cauda-equina": m("nervous", "Kauda ekuina", "Cauda equina", "Kumpulan serabut saraf lumbal dan sakral berbentuk 'ekor kuda' di bawah konus medularis; kompresinya memicu sindrom kauda ekuina gawat darurat.", ["spine", "nerve"]),
  "brachial-plexus": m("nervous", "Pleksus brakialis", "Plexus brachialis", "Jalinan saraf dari C5–T1 yang mempersarafi bahu dan lengan.", ["nerve"]),
  "radial-nerve": m("nervous", "Saraf radialis", "N. radialis", "Mempersarafi otot ekstensor siku, pergelangan, dan jari tangan; cedera menyebabkan tangan lunglai ('wrist drop').", ["nerve"]),
  "median-nerve": m("nervous", "Saraf median", "N. medianus", "Mempersarafi otot fleksor lengan bawah dan sensasi ibu jari–jari manis; tertekan pada sindrom terowongan karpal.", ["nerve"]),
  "ulnar-nerve": m("nervous", "Saraf ulnaris", "N. ulnaris", "Melintasi belakang sendi siku ('funny bone') ke sisi kelingking; kerusakan menyebabkan kekakuan jari ('claw hand').", ["nerve"]),
  "femoral-nerve": m("nervous", "Saraf femoralis", "N. femoralis", "Saraf terbesar pleksus lumbalis yang menginervasi otot kuadriseps paha depan dan sensasi paha medial.", ["nerve"]),
  "sciatic-nerve": m("nervous", "Saraf iskiadikus", "N. ischiadicus", "Saraf terpanjang dan terbesar tubuh, dari pleksus lumbosakral turun di paha belakang. Penekanan menimbulkan nyeri ischialgia.", ["nerve"]),
  "common-fibular-nerve": m("nervous", "Saraf fibularis komunis", "N. fibularis communis", "Melingkari leher tulang betis ke tungkai depan; cedera menyebabkan kaki terkulai ('foot drop').", ["nerve"]),
  "tibial-nerve": m("nervous", "Saraf tibialis", "N. tibialis", "Lanjutan saraf iskiadikus di tungkai bawah; mempersarafi otot betis dan telapak kaki.", ["nerve"]),
  "vagus-nerve": m("nervous", "Saraf vagus", "N. vagus (N. X)", "Saraf kranial yang mengatur denyut jantung, pencernaan, dan pernapasan (sistem parasimpatis).", ["nerve"]),
  eye: m("nervous", "Bola mata", "Bulbus oculi", "Organ penglihatan; retina mengubah cahaya menjadi sinyal saraf yang dibawa saraf optik ke otak.", ["head"]),

  // ───── Kemih
  kidney: m("urinary", "Ginjal", "Ren", "Menyaring darah, membentuk urine, mengatur tekanan darah, keseimbangan cairan, dan elektrolit; terletak di belakang rongga perut setinggi T12–L3.", ["urinary-tract"]),
  ureter: m("urinary", "Ureter", "Ureter", "Saluran otot ±25 cm yang membawa urine dari ginjal ke kandung kemih.", ["urinary-tract"]),
  bladder: m("urinary", "Kandung kemih", "Vesica urinaria", "Kantong otot penampung urine, kapasitas ±400–600 ml.", ["urinary-tract"]),

  // ───── Endokrin
  "pituitary-gland": m("endocrine", "Kelenjar hipofisis", "Glandula pituitaria (Hypophysis)", "Kelenjar master di sela tursika dasar otak yang mengendalikan kelenjar tiroid, adrenal, dan hormon pertumbuhan.", ["head", "brain"]),
  thymus: m("endocrine", "Kelenjar timus", "Thymus", "Organ limfoid dan endokrin di mediastinum anterior; tempat pematangan limfosit T untuk kekebalan tubuh adaptif.", ["neck", "chest"]),
  thyroid: m("endocrine", "Kelenjar tiroid", "Glandula thyroidea", "Kelenjar berbentuk kupu-kupu di leher depan yang menghasilkan hormon pengatur metabolisme (T3/T4).", ["neck"]),
  "adrenal-gland": m("endocrine", "Kelenjar adrenal", "Glandula suprarenalis", "Duduk di atas ginjal; menghasilkan kortisol, aldosteron, dan adrenalin.", ["abdomen-organ"]),

  // ───── Kulit
  skin: m("integumentary", "Kulit", "Cutis", "Organ terbesar tubuh; pelindung, pengatur suhu, dan indera sentuh. Ditampilkan transparan sebagai penunjuk bentuk tubuh.", ["skin"]),
};

const SIDE_LABEL: Record<string, string> = { L: "kiri", R: "kanan" };

const REGION_DESC: Record<string, string> = {
  C: "Ruas leher; menopang kepala dan memungkinkan gerak menoleh serta mengangguk. C1 (atlas) dan C2 (aksis) memberi rotasi kepala.",
  T: "Ruas punggung atas; bersendi dengan iga sehingga lebih kaku dan membentuk lengkung kifosis alami.",
  L: "Ruas pinggang; paling besar karena menopang berat badan atas. L4–L5 dan L5–S1 adalah lokasi tersering hernia diskus.",
};

const REGION_NAME: Record<string, string> = { C: "servikal", T: "torakal", L: "lumbal" };
const REGION_LATIN: Record<string, string> = { C: "cervicalis", T: "thoracica", L: "lumbalis" };

export interface ResolvedMeta extends PartMeta {
  base: string;
  side: "L" | "R" | null;
}

export function splitId(id: string): { base: string; side: "L" | "R" | null } {
  const m2 = /^(.*)\.(L|R)$/.exec(id);
  return m2 ? { base: m2[1], side: m2[2] as "L" | "R" } : { base: id, side: null };
}

/** Metadata untuk id apa pun (termasuk vertebra/iga/diskus yang dibuat dinamis). */
export function metaFor(id: string): ResolvedMeta {
  const { base, side } = splitId(id);
  const sideTxt = side ? ` ${SIDE_LABEL[side]}` : "";

  const v = /^vertebra-([CTL])(\d+)$/.exec(base);
  if (v) {
    const r = v[1];
    return {
      base,
      side,
      system: "skeletal",
      name: `Vertebra ${REGION_NAME[r]} ${v[2]} (${r}${v[2]})`,
      latin: `Vertebra ${REGION_LATIN[r]} ${v[2]}`,
      desc: REGION_DESC[r],
      tags: ["spine", "vertebra", REGION_NAME[r]],
    };
  }
  const d = /^disc-(.+)-(.+)$/.exec(base);
  if (d) {
    return {
      base,
      side,
      system: "skeletal",
      name: `Diskus intervertebralis ${d[1]}–${d[2]}`,
      latin: `Discus intervertebralis ${d[1]}–${d[2]}`,
      desc: "Bantalan kenyal berisi inti gel (nukleus pulposus) dan cincin serat (anulus fibrosus) yang meredam beban antar-ruas tulang belakang.",
      tags: ["spine", "disc"],
    };
  }
  const r = /^rib-(\d+)$/.exec(base);
  if (r) {
    const n = Number(r[1]);
    const kind = n <= 7 ? "iga sejati" : n <= 10 ? "iga palsu" : "iga melayang";
    return {
      base,
      side,
      system: "skeletal",
      name: `Iga ${n}${sideTxt} (${kind})`,
      latin: `Costa ${n}`,
      desc:
        n <= 7
          ? "Iga sejati melekat langsung ke sternum melalui tulang rawan iga sendiri."
          : n <= 10
            ? "Iga palsu tulang rawannya menyatu dengan tulang rawan iga di atasnya membentuk arkus kosta."
            : "Iga melayang hanya melekat di tulang belakang dan berujung bebas di otot dinding perut.",
      tags: ["ribcage", "rib"],
    };
  }
  const b = CATALOG[base] ?? (base.startsWith("skin-") ? CATALOG.skin : undefined);
  if (b) return { ...b, name: `${b.name}${sideTxt}`, base, side, tags: b.tags ?? [] };
  return { base, side, system: "skeletal", name: id, latin: "", desc: "", tags: [] };
}
