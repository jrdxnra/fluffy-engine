import type { Lift } from "@/lib/types";

export const accessoryMap: { [key in Lift]: { title: string; exercises: string[] } } = {
  Deadlift: {
    title: "Deadlift Assistance",
    exercises: [
      "Romanian Deads",
      "Stiff Leg Deads",
      "Glute Ham Raise",
      "Reverse Hyper",
      "Hip Thrusts",
      "Farmer Walk",
      "Back Extension",
      "French Press",
      "Skull Crushers",
      "Close Grip Dips",
      "Pull Up Variation",
    ],
  },
  Bench: {
    title: "Bench Assistance",
    exercises: [
      "Incline Bench",
      "Dbell Inc Bench",
      "Cable Flyes",
      "Dbell Flyes",
      "Wide Dips",
      "Close Grip Bench",
      "Push Ups",
      "Assisted Push Ups",
      "Leg Raises",
      "Bar Hang",
      "Bar Hang - High",
    ],
  },
  Squat: {
    title: "Squat Assistance",
    exercises: [
      "Front Squat",
      "GM (Standing)",
      "GM (Dead)",
      "GM (Seated)",
      "Dbell Lunges",
      "Barbell Lunges",
      "Leg Curl",
      "Dips",
      "DB Row",
      "Farmer's Carry",
    ],
  },
  Press: {
    title: "OH Press Assistance",
    exercises: [
      "Wide Upright Row",
      "Face Pulls",
      "Shrugs",
      "Overhand BB Curl",
      "Hammer Curl",
      "EZ Bar Curl",
      "JM Press",
      "Skull Crushers",
      "Close Grip Dips",
      "Pull Up Variation",
    ],
  },
};

export const mobilityChecklist = [
  "Foam rolling (5-10 min)",
  "Static stretching (hips/shoulders/hamstrings)",
  "Jump rope or light movement (3-5 min)",
];

export const conditioningChecklist = [
  "Off-day conditioning session completed",
  "Option: hills / prowler / sprints",
  "Option: low-impact cardio 20-30 min",
];
