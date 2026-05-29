const ZONES = {
  Mpumba: {
    schools: [
      "Mununga Primary","Mpumba Primary","Mwenda Primary","Kapengwe Open Centre",
      "Salamo Primary","Tubondo Primary","Muchelenje Open Centre","Mununga Secondary",
      "Salamo Secondary","Red Rhino Secondary"
    ]
  },
  Chiundaponde: {
    schools: [
      "Chiundaponde Primary","Lulimala Primary","Chifinshi Primary","Makanga Primary",
      "Ngweshi Primary","Chiundaponde Secondary"
    ]
  },
  Lukulu: {
    schools: [
      "Kapololo Primary","Kapwanya Primary","Mabonga Primary","Lukulu Primary",
      "Nsansha Primary","Mpomfu Primary","Chito Primary","Lukulu Day Secondary"
    ]
  },
  Kalonje: {
    schools: [
      "Mupamadzi Open Centre","Chilebela Primary","Kamwendo Primary",
      "Mutumba Community School","Kalonje Primary","Mabyulu Primary",
      "Finkuli Open Centre","Kalonje Secondary"
    ]
  },
  Mwelushi: {
    schools: [
      "Mwila Chilembwe Primary","Mwendachabe Primary","Chipelembe Primary",
      "Kapilya Open Centre","Mwelushi Primary","Muwele Primary","Milomfi Primary","Chibali Primary"
    ]
  }
};

const LEVELS_BY_TYPE = {
  "Primary School": ["ECE & Primary"],
  "Open Centre School": ["ECE & Primary","Junior Secondary"],
  "Secondary School": ["Junior Secondary","Senior Secondary"],
  "Community School": ["ECE & Primary"]
};

const GRADES_BY_LEVEL = {
  "ECE & Primary": ["Level 1","Level 2","Grade 1","Grade 2","Grade 3","Grade 4","Grade 5","Grade 6","Grade 7"],
  "Junior Secondary": ["Form 1","Form 2"],
  "Senior Secondary": ["Grade 10","Grade 11","Grade 12"]
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
  "ECE & Primary": ["Mathematics","Science","CTS"],
  "Junior Secondary": ["Physics/Mathematics","Biology/Chemistry"],
  "Senior Secondary": ["Physics/Mathematics","Biology/Chemistry"]
};

const SKILLS = {
  "Civil Engineering": {
    subSkills: ["Wall & Floor Tiling","Landscape & Gardening","Bricklaying & Plastering"],
    max: 4
  },
  "Mechanical Engineering": {
    subSkills: ["Welding","Carpentry & Joinery","Electrical Installations","Panel Beating","Spray Painting"],
    max: 4
  },
  "Electronics Services": {
    subSkills: ["Wearable Technology","Communication Technology","Industrial Electronics","Repair & Maintenance"],
    max: 2
  },
  "Fashion Technology": {
    subSkills: ["Design & Innovation","Sustainable Practices","Manufacturing & Production"],
    max: 1
  },
  "Cosmetology": {
    subSkills: ["Hairstyling","Skincare","Nail Care","Makeup Application"],
    max: 1
  }
};
