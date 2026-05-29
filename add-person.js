import { Timestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db } from "./firebase.js";
import {
  doc,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

function formatVisaId(typeCode, number) {
  return `MOE${typeCode}${String(number).padStart(6, "0")}`;
}

function generateCivilId() {
  const randomPart = Math.floor(1000000 + Math.random() * 9000000);
  return "729" + randomPart;
}
const VISA_TYPE_CODES = {
  tourist: "TR",
  business: "BS",
  student: "ST",
  transit: "TS",
  work: "WK",
  family: "FM",
  investor: "IN"
};
const checkbox = document.getElementById("hasCivilId");
const civilSection = document.getElementById("civilIdSection");

const civilStatusSelect = document.getElementById("civilStatus");

civilStatusSelect.onchange = () => {
  if (civilStatusSelect.value === "visitor") {
    checkbox.checked = false;
    checkbox.disabled = true;
    civilSection.classList.add("hidden");
  } else {
    checkbox.disabled = false;
  }
};

checkbox.onchange = () => {
  civilSection.classList.toggle("hidden", !checkbox.checked);
};

// run once on load
civilStatusSelect.onchange();

document.getElementById("createBtn").onclick = async () => {
  const createBtn = document.getElementById("createBtn");
  createBtn.disabled = true;
  const eBorder = document.getElementById("eborder").value.trim().toUpperCase();
  const name = document.getElementById("name").value.trim();
  const dob = document.getElementById("dob").value;
  const civilStatus = document.getElementById("civilStatus").value;
  const personStatus = document.getElementById("personStatus").value;
  const hasCivilId = checkbox.checked;
  const civilId = hasCivilId
  ? document.getElementById("civilIdInput").value.trim()
  : null;

if (dob && isNaN(new Date(dob))) {
  alert("Invalid date of birth");
  createBtn.disabled = false;
  return;
}

if (!eBorder || !name) {
  alert("Missing required fields");
  createBtn.disabled = false;
  return;
}

  const personRef = doc(db, "people", eBorder);

  const data = {
    full_name: name,
    dob: dob ? Timestamp.fromDate(new Date(dob)) : null,
    civil_status: civilStatus,
    person_status: personStatus,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp()
  };

if (hasCivilId && !civilId) {
  alert("Enter Civil ID");
  createBtn.disabled = false;
  return;
}

if (hasCivilId && !/^729\d{7}$/.test(civilId)) {
  alert("Civil ID must be 10 digits starting with 729");
  createBtn.disabled = false;
  return;
}

if (hasCivilId && civilStatus === "visitor") {
  alert("Visitors cannot have Civil ID");
  createBtn.disabled = false;
  return;
}

try {
  await runTransaction(db, async (transaction) => {

    const personSnap = await transaction.get(personRef);
    const eligible = civilStatus === "citizen" || civilStatus === "resident";

    // 🔒 person already exists
    if (personSnap.exists()) {
      throw "Person already exists";
    }

    // 🔒 check civil ID
let finalCivilId = null;

if (eligible) {

  // 🔹 If officer provided ID → use it
  if (hasCivilId && civilId) {

    const civilRef = doc(db, "civil_ids", civilId);
    const civilSnap = await transaction.get(civilRef);

    if (civilSnap.exists()) {
      throw "Civil ID already exists";
    }

    finalCivilId = civilId;

  } else {
    // 🔹 AUTO GENERATE (NO DUPLICATES EVER)
    let exists = true;

    while (exists) {
      const newId = generateCivilId();
      const civilRef = doc(db, "civil_ids", newId);
      const civilSnap = await transaction.get(civilRef);

      if (!civilSnap.exists()) {
        finalCivilId = newId;
        exists = false;
      }
    }
  }
}

    // 📦 attach civil ID to person
if (finalCivilId) {
  data.current_documents = {
    civil_id: finalCivilId
  };
}

    // ✅ create person
    transaction.set(personRef, data);

    // ✅ create civil ID
if (finalCivilId) {
  const civilRef = doc(db, "civil_ids", finalCivilId);

  transaction.set(civilRef, {
        owner_eborder_id: eBorder,
        owner_type: civilStatus,
        issued_at: serverTimestamp(),
        id_status: "active"
      });
    }

  });

  alert("Person created ✅");

// 🔄 Reset form ONLY on success
document.getElementById("eborder").value = "";
document.getElementById("name").value = "";
document.getElementById("dob").value = "";
document.getElementById("civilStatus").value = "citizen";
document.getElementById("personStatus").value = "active";
document.getElementById("civilIdInput").value = "";

checkbox.checked = false;
civilSection.classList.add("hidden");

} catch (err) {
  console.error(err);
  alert(typeof err === "string" ? err : "Creation failed ❌");
} finally {
  createBtn.disabled = false;
}
};