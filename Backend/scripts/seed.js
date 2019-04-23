// Loads fictional demo data: one admin, three batches of candidates and a
// set of voters, some of whom have already voted. Wipes users and
// candidates first, so it refuses to run with NODE_ENV=production.
const { connect, mongoose } = require("../app_server/models/db");
const usersdb = require("../app_server/models/usersdb");
const candidate = require("../app_server/models/candidate1");

const DEMO_PASSWORD = process.env.SEED_PASSWORD || "ballot-demo-pass";

const candidates = [
  { username: "Hira Qadeer", roll_num: "22F-2001", batch: 2022, school: "Garden Town Grammar", College: "Riverside College", Experience: "Class representative, second year", Skills: ["debating", "event planning"] },
  { username: "Usman Tariq", roll_num: "22F-2002", batch: 2022, school: "Canal View School", College: "Northfield College", Experience: "Ran the coding society's peer tutoring", Skills: ["mentoring", "web development"] },
  { username: "Mahnoor Iqbal", roll_num: "22F-2003", batch: 2022, school: "Lakeside Academy", College: "Riverside College", Experience: "Organised the batch sports week", Skills: ["sports", "budgeting"] },
  { username: "Danish Rafiq", roll_num: "23F-3001", batch: 2023, school: "Hillcrest School", College: "Northfield College", Experience: "Volunteer at the library help desk", Skills: ["communication"] },
  { username: "Sana Yousuf", roll_num: "23F-3002", batch: 2023, school: "Garden Town Grammar", College: "Eastbrook College", Experience: "Editor of the student newsletter", Skills: ["writing", "design"] },
  { username: "Areeb Nadeem", roll_num: "24F-4001", batch: 2024, school: "Canal View School", College: "Eastbrook College", Experience: "First-year orientation volunteer", Skills: ["photography"] },
  { username: "Komal Shafiq", roll_num: "24F-4002", batch: 2024, school: "Lakeside Academy", College: "Riverside College", Experience: "Robotics club treasurer", Skills: ["robotics", "accounts"] },
];

const voterNames = ["Ali Hamdani", "Zara Anwar", "Fahad Siddiqui", "Iqra Basit", "Hamza Rauf", "Noor Saleem", "Saad Kamran", "Maryam Jabbar", "Talha Aziz", "Rida Haroon", "Waleed Ashraf", "Esha Mumtaz"];
const batches = [2022, 2023, 2024];
// Index into `candidates` for each voter's ballot, or null for "not voted yet".
const ballots = [0, 1, 0, null, 3, 4, 3, null, 5, 6, 6, null];

async function seed() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("refusing to wipe data with NODE_ENV=production");
  }
  await connect();
  await Promise.all([usersdb.deleteMany({}), candidate.deleteMany({})]);

  const tally = candidates.map(() => 0);
  const voters = voterNames.map((name, i) => {
    const batch = batches[Math.floor(i / 4)];
    const choice = ballots[i];
    if (choice !== null) tally[choice] += 1;
    return {
      username: name,
      roll_number: `${String(batch).slice(2)}F-${1001 + i}`,
      password: DEMO_PASSWORD,
      Batch: batch,
      votedFor: choice === null ? null : candidates[choice].roll_num,
      type: true,
    };
  });

  await candidate.insertMany(candidates.map((c, i) => ({ ...c, votes: tally[i] })));
  // create() rather than insertMany() so the password hook runs.
  for (const voter of voters) await usersdb.create(voter);
  await usersdb.create({ username: "Election Office", roll_number: "ADMIN-01", password: DEMO_PASSWORD, type: false });

  console.log(`seeded ${candidates.length} candidates, ${voters.length} voters and 1 admin`);
  console.log(`sign in as ADMIN-01 or a voter such as 22F-1004 (password: ${DEMO_PASSWORD})`);
}

seed()
  .then(() => mongoose.disconnect())
  .catch(async (err) => {
    console.error("seed failed:", err.message);
    await mongoose.disconnect();
    process.exit(1);
  });
