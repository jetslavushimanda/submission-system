const ZONES = {
  "Mpumba": {
    centre: "Kapengwe",
    schools: [
      { name: "Mununga Primary", type: "Primary School" },
      { name: "Mpumba Primary", type: "Primary School" },
      { name: "Mwenda Primary", type: "Primary School" },
      { name: "Kapengwe Open Centre", type: "Open Centre School" },
      { name: "Salamo Primary", type: "Primary School" },
      { name: "Tubondo Primary", type: "Primary School" },
      { name: "Muchelenje Open Centre", type: "Open Centre School" },
      { name: "Mununga Secondary", type: "Secondary School" },
      { name: "Salamo Secondary", type: "Secondary School" },
      { name: "Red Rhino Secondary", type: "Secondary School" },
      { name: "Khem Private School", type: "Private School" },
      { name: "St. Rochester Private School", type: "Private School" }
    ]
  },
  "Chiundaponde": {
    centre: "Chiundaponde",
    schools: [
      { name: "Chiundaponde Primary", type: "Primary School" },
      { name: "Lulimala Primary", type: "Primary School" },
      { name: "Chifinshi Primary", type: "Primary School" },
      { name: "Makanga Primary", type: "Primary School" },
      { name: "Ngweshi Primary", type: "Primary School" },
      { name: "Chiundaponde Secondary", type: "Secondary School" }
    ]
  },
  "Lukulu": {
    centre: "Lukulu",
    schools: [
      { name: "Kapololo Primary", type: "Primary School" },
      { name: "Kapwanya Primary", type: "Primary School" },
      { name: "Mabonga Primary", type: "Primary School" },
      { name: "Lukulu Primary", type: "Primary School" },
      { name: "Nsansha Primary", type: "Primary School" },
      { name: "Mpomfu Primary", type: "Primary School" },
      { name: "Chito Primary", type: "Primary School" },
      { name: "Lukulu Secondary", type: "Secondary School" }
    ]
  },
  "Kalonje": {
    centre: "Kalonje",
    schools: [
      { name: "Mupamadzi Open Centre", type: "Open Centre School" },
      { name: "Chilebela Primary", type: "Primary School" },
      { name: "Kamwendo Primary", type: "Primary School" },
      { name: "Mutumba Community School", type: "Community School" },
      { name: "Kalonje Primary", type: "Primary School" },
      { name: "Mabyulu Primary", type: "Primary School" },
      { name: "Finkuli Open Centre", type: "Open Centre School" },
      { name: "Kalonje Secondary", type: "Secondary School" }
    ]
  },
  "Mwelushi": {
    centre: "Muwele",
    schools: [
      { name: "Mwila Chilembwe Primary", type: "Primary School" },
      { name: "Mwendachabe Primary", type: "Primary School" },
      { name: "Chipelembe Primary", type: "Primary School" },
      { name: "Kapilya Open Centre", type: "Open Centre School" },
      { name: "Mwelushi Primary", type: "Primary School" },
      { name: "Muwele Primary", type: "Primary School" },
      { name: "Milomfi Primary", type: "Primary School" },
      { name: "Chibali Primary", type: "Primary School" }
    ]
  }
};

const LEVELS_BY_SCHOOL_TYPE = {
  "Primary School": ["ECE", "Primary (Grade 1-7)"],
  "Open Centre School": ["ECE", "Primary (Grade 1-7)", "Junior Secondary (Form 1-2)"],
  "Secondary School": ["Junior Secondary (Form 1-2)", "Senior Secondary (Grade 10-12)"],
  "Private School": ["ECE", "Primary (Grade 1-7)", "Junior Secondary (Form 1-2)", "Senior Secondary (Grade 10-12)"],
  "Community School": ["ECE", "Primary (Grade 1-7)"]
};

const INNOVATION_CATEGORIES = [
  "Agricultural Science Innovations",
  "Chemistry Innovations",
  "Physics & Renewable Energy Innovations",
  "Computer Science & Software Development Innovations",
  "Mathematics Innovations",
  "Medicine & Health Innovations",
  "Robotics & Artificial Intelligence Innovations",
  "Food Science, Technology & Hospitality Innovations",
  "Environmental Sustainable Development Innovations"
];

const ACADEMICS_BY_LEVEL = {
  "ECE": ["Quiz & Olympiads - Mathematics", "Quiz & Olympiads - Science", "Quiz & Olympiads - CTS"],
  "Primary (Grade 1-7)": ["Quiz & Olympiads - Mathematics", "Quiz & Olympiads - Science", "Quiz & Olympiads - CTS"],
  "Junior Secondary (Form 1-2)": ["Quiz & Olympiads - Physics/Mathematics", "Quiz & Olympiads - Biology/Chemistry"],
  "Senior Secondary (Grade 10-12)": ["Quiz & Olympiads - Physics/Mathematics", "Quiz & Olympiads - Biology/Chemistry"]
};

const SKILLS = {
  "Civil Engineering": {
    subSkills: ["Wall & Floor Tiling", "Landscape & Gardening", "Bricklaying & Plastering"],
    slots: 4,
    requiresReport: false
  },
  "Mechanical Engineering": {
    subSkills: ["Welding", "Carpentry & Joinery", "Electrical Installations", "Panel Beating", "Spray Painting"],
    slots: 4,
    requiresReport: false
  },
  "Electronics Services": {
    subSkills: ["Wearable Technology", "Communication Technology", "Industrial Electronics", "Repair & Maintenance"],
    slots: 2,
    requiresReport: false
  },
  "Fashion Technology": {
    subSkills: ["Design & Innovation", "Sustainable Practices", "Manufacturing & Production"],
    slots: 1,
    requiresReport: false
  },
  "Cosmetology": {
    subSkills: ["Hairstyling", "Skincare", "Nail Care", "Makeup Application"],
    slots: 1,
    requiresReport: true
  }
};

const SLOT_TOTALS = {
  "Primary School": 30,
  "Open Centre School": 53,
  "Secondary School": 52,
  "Private School": 52,
  "Community School": 30
};

function requiresReport(participantType, skillCategory = null) {
  if (participantType === "Learner Innovation") return true;
  if (participantType === "Teacher") return true;
  if (participantType === "Out-of-School Youth") return true;
  if (participantType === "Technical Skills" && skillCategory === "Cosmetology") return true;
  return false;
}
