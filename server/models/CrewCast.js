const mongoose = require("mongoose");

const CREW_ROLES = [
  "Director",
  "Producer",
  "Writer",
  "Music Director",
  "Cinematographer",
  "Editor",
];

const crewSchema = new mongoose.Schema(
  {
    personName: {
      type: String,
      required: true,
      trim: true,
    },

   
    role: {
      type: String,
      required: true,
      enum: [...CREW_ROLES, "Actor", "Other"],
    },

  

    // optional (only if needed)
    characterName: {
      type: String,
      default: "",
    },
     profileImage: {
      url: String,
      publicId: String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CastAndCrew", crewSchema);
