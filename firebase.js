// 🔥 Firebase SDK imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  runTransaction,
  Timestamp,
  deleteField,
  collection,
  getDocs,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

function formatVisaId(typeCode, number) {
  return `MOE${typeCode}${String(number).padStart(6, "0")}`;
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

function generateCivilId() {
  const randomPart = Math.floor(1000000 + Math.random() * 9000000);
  return "729" + randomPart;
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// 🔐 Your config (replace this)
const firebaseConfig = {
  apiKey: "AIzaSyCYxZRvhGOSO6KntJKFB8cQdlE5a2XVAaQ",
  authDomain: "moeezland-id.firebaseapp.com",
  projectId: "moeezland-id",
  storageBucket: "moeezland-id.firebasestorage.app",
  messagingSenderId: "979635453691",
  appId: "1:979635453691:web:29d320a19c635972273a5e"
};

// 🚀 Init
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };

const isLoginPage = window.location.pathname.endsWith("login.html");

async function verifyOfficer(user) {
  const officerRef = doc(db, "officers", user.uid);
  const officerSnap = await getDoc(officerRef);

  if (!officerSnap.exists()) {
    throw new Error("Officer profile not found");
  }

  const officer = officerSnap.data();

  if (officer.active !== true) {
    throw new Error("Officer account disabled");
  }

  return officer;
}

if (!isLoginPage) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }

    try {
      await verifyOfficer(user);
      document.body.classList.remove("auth-checking");
    } catch (err) {
      console.error(err);
      await signOut(auth);
      window.location.href = "login.html";
    }
  });
}

window.logoutOfficer = async () => {
  await signOut(auth);
  window.location.href = "login.html";
};

// 🔍 Search logic (citizens only)
const searchBtn = document.getElementById("searchBtn");
const input = document.getElementById("searchInput");
const resultSection = document.getElementById("resultSection");
const profileCard = document.getElementById("profileCard");

if (input && searchBtn && resultSection && profileCard) {

window.addEventListener("load", () => {
  if (input) input.focus();
});

input.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    searchBtn.click();
  }
});

searchBtn.addEventListener("click", async () => {
  const eBorder = input.value.trim().toUpperCase();

if (!eBorder) {
  resultSection.classList.remove("hidden");
  profileCard.innerHTML = "<p>Please enter e-Border number</p>";
  return;
}

  resultSection.classList.remove("hidden");
  searchBtn.disabled = true;
  profileCard.innerHTML = "<p>Loading...</p>";

  try {
    const personRef = doc(db, "people", eBorder);
    const personSnap = await getDoc(personRef);

    if (!personSnap.exists()) {
      profileCard.innerHTML = "<p>Person not found</p>";
      return;
    }

    const person = personSnap.data();
    const civilId = person.current_documents?.civil_id;

const visaId = person.current_documents?.visa_id;

let visaData = null;
if (visaId) {
  const visaRef = doc(db, "visas", visaId);
  const visaSnap = await getDoc(visaRef);
  if (visaSnap.exists()) visaData = visaSnap.data();
}

    let civilData = null;
    if (civilId) {
      const civilRef = doc(db, "civil_ids", civilId);
      const civilSnap = await getDoc(civilRef);
      if (civilSnap.exists()) civilData = civilSnap.data();
    }

// 🚨 Integrity check (ONLY for citizen & resident)
const isEligible = person.civil_status === "citizen" || person.civil_status === "resident";

let integrityError = "";

if (isEligible) {

  // ❌ case 1: no current_documents
  if (!person.current_documents) {
    integrityError = "⚠️ Missing current_documents";
  }

  // ❌ case 2: no civil_id inside map
else if (person.current_documents && !person.current_documents.civil_id) {
  integrityError = "⚠️ Missing civil_id in current_documents";
}

  // ❌ case 3: civil_id exists but no civil_ids doc
  else if (civilId && !civilData) {
    integrityError = "⚠️ Civil ID record missing in database";
  }

}

// ✅ Visitor check
const isVisitor = person.civil_status === "visitor";

if (isVisitor) {

  const hasHistory = !!person.has_visa_history;
  const hasDocs = !!person.current_documents && Object.keys(person.current_documents).length > 0;
  const hasVisaId = !!person.current_documents?.visa_id;

  // 🟢 Fresh visitor (never had visa)
  if (!hasHistory) {
    // valid → no error
  }

  // 🔴 Had visa before but now missing docs
else if (
  hasHistory &&
  !hasVisaId &&
  person.person_status === "active" &&
  hasDocs // 👈 IMPORTANT
) {
  integrityError = "⚠️ Missing visa_id in current_documents";
}

  // 🔴 Docs exist but visa_id missing
else if (hasDocs && !hasVisaId && person.person_status === "active") {
  integrityError = "⚠️ Missing visa_id in current_documents";
}

  // 🔴 Visa ID exists but record missing
  else if (hasVisaId && !visaData) {
    integrityError = "⚠️ Visa record missing in database";
  }

}

profileCard.innerHTML = `
  <p><strong>Name:</strong> 
    <span id="nameText">${escapeHTML(person.full_name)}</span>
    <input id="editName" class="edit-field hidden" value="${escapeHTML(person.full_name)}" />
  </p>

  <p><strong>e-Border:</strong> ${eBorder}</p>

  <p><strong>Date of Birth:</strong> ${
    person.dob ? person.dob.toDate().toLocaleDateString() : "N/A"
  }</p>

  <p><strong>Civil Status:</strong> 
    <span id="civilText">${person.civil_status}</span>
    <select id="editCivilStatus" class="edit-field hidden">
      <option value="citizen">citizen</option>
      <option value="resident">resident</option>
      <option value="visitor">visitor</option>
    </select>
  </p>

  <p><strong>Person Status:</strong> 
    <span id="statusText">${person.person_status}</span>
<select id="editStatus" class="edit-field hidden">
  ${
    person.civil_status === "visitor"
      ? `
        <option value="active">active</option>
        <option value="Expired/Cancelled">Expired/Cancelled</option>
      `
      : `
        <option value="active">active</option>
        <option value="inactive">inactive</option>
      `
  }
</select>
  </p>

  <p><strong>Created At:</strong> ${
    person.created_at ? person.created_at.toDate().toLocaleString() : "N/A"
  }</p>

  <p><strong>Updated At:</strong> ${
    person.updated_at ? person.updated_at.toDate().toLocaleString() : "N/A"
  }</p>

  <br>

  <p><strong>Civil ID:</strong> ${civilId || "N/A"}</p>

<p><strong>Visa ID:</strong> ${visaId || "N/A"}</p>
<p><strong>Visa Status:</strong> ${visaData?.visa_status || "N/A"}</p>
<p><strong>Expiry Date:</strong> ${
  visaData?.expiry_date
    ? (visaData.expiry_date.toDate
        ? visaData.expiry_date.toDate().toLocaleDateString()
        : new Date(visaData.expiry_date).toLocaleDateString())
    : "N/A"
}</p>

  <p><strong>ID Status:</strong> ${civilData?.id_status || "N/A"}</p>
  <p><strong>Issued At:</strong> ${
    civilData?.issued_at
      ? civilData.issued_at.toDate().toLocaleString()
      : "N/A"
  }</p>

  <br>

  <button id="editBtn">Edit</button>
  <button id="saveBtn" class="hidden">Save</button>
  <button id="cancelBtn" class="hidden">Cancel</button>
  <button id="expireVisasBtn">Expire Visas</button>

${
  (!civilId && !integrityError && (person.civil_status === "citizen" || person.civil_status === "resident"))
    ? `<button id="issueIdBtn">Issue Civil ID</button>`
    : ""
}

${
(
  !integrityError &&
  person.civil_status === "visitor" &&
  person.person_status === "active" &&
  !person.current_documents?.visa_id
)
    ? `
      <button id="issueVisaBtn">Issue Visa</button>

      <div id="visaForm" class="hidden" style="margin-top:10px;">
<select id="visaTypeSelect">
  <option value="">Select visa type</option>
  <option value="tourist">Tourist</option>
  <option value="business">Business</option>
  <option value="student">Student</option>
  <option value="transit">Transit</option>
  <option value="work">Work</option>
  <option value="family">Family</option>
  <option value="investor">Investor</option>
</select>

<br><br>

<input type="date" id="expiryDateInput" />

<br><br>
        <button id="confirmVisaBtn">Confirm</button>
      </div>
    `
    : ""
}

${integrityError ? `<p class="error-text">${integrityError}</p>` : ""}

`;

const editBtn = document.getElementById("editBtn");
const saveBtn = document.getElementById("saveBtn");
const cancelBtn = document.getElementById("cancelBtn");
const issueBtn = document.getElementById("issueIdBtn");
const issueVisaBtn = document.getElementById("issueVisaBtn");
const visaForm = document.getElementById("visaForm");
const visaTypeSelect = document.getElementById("visaTypeSelect");
const expiryDateInput = document.getElementById("expiryDateInput");
const confirmVisaBtn = document.getElementById("confirmVisaBtn");
const expireVisasBtn = document.getElementById("expireVisasBtn");

if (expireVisasBtn) {

  expireVisasBtn.onclick = async () => {

    const confirmed = confirm(
      "Expire all overdue visas?"
    );

    if (!confirmed) return;

    expireVisasBtn.disabled = true;

    try {

      const visasRef = collection(db, "visas");
      const visasSnap = await getDocs(visasRef);

      const batch = writeBatch(db);

      const now = new Date();

      let expiredCount = 0;

      visasSnap.forEach((visaDoc) => {

        const visa = visaDoc.data();

        if (
          visa.expiry_date &&
          visa.visa_status !== "Expired/Cancelled"
        ) {

          const expiryDate = visa.expiry_date.toDate();

          if (expiryDate <= now) {

            batch.update(visaDoc.ref, {
              visa_status: "Expired/Cancelled"
            });

            if (visa.owner_eborder_id) {

              const personRef = doc(
                db,
                "people",
                visa.owner_eborder_id
              );

              batch.update(personRef, {
                person_status: "Expired/Cancelled",
                "current_documents.visa_id": deleteField(),
                updated_at: serverTimestamp()
              });
            }

            expiredCount++;
          }
        }
      });

      await batch.commit();

      alert(
        `${expiredCount} visa(s) expired successfully ✅`
      );

      searchBtn.click();

    } catch (err) {

      console.error(err);

      alert("Failed to expire visas ❌");
    }

    expireVisasBtn.disabled = false;
  };
}

if (issueBtn) {
  issueBtn.onclick = async () => {
    issueBtn.disabled = true;

    try {
      await runTransaction(db, async (transaction) => {
        const personRef = doc(db, "people", eBorder);
        const personSnap = await transaction.get(personRef);

        if (!personSnap.exists()) {
          throw "Person not found";
        }

        const personData = personSnap.data();
        const currentCivilId = personData.current_documents?.civil_id;
        const status = personData.civil_status;

        // 🔒 eligibility check
        if (currentCivilId) {
          throw "Person already has a Civil ID";
        }

        if (!(status === "citizen" || status === "resident")) {
          throw "Only citizens or residents can receive Civil ID";
        }

        // 🔁 generate unique ID
        let newId;
        let exists = true;

        while (exists) {
          newId = generateCivilId();
          const civilRef = doc(db, "civil_ids", newId);
          const civilSnap = await transaction.get(civilRef);
          exists = civilSnap.exists();
        }

        const civilRef = doc(db, "civil_ids", newId);

        // ✅ create civil_id record
        transaction.set(civilRef, {
          owner_eborder_id: eBorder,
          owner_type: status,
          issued_at: serverTimestamp(),
          id_status: "active"
        });

        // ✅ link to person
transaction.update(personRef, {
  "current_documents.civil_id": newId,
  updated_at: serverTimestamp()
});
      });

      alert("Civil ID issued successfully ✅");
      searchBtn.click();

    } catch (err) {
      console.error(err);
      alert(typeof err === "string" ? err : "Issuance failed ❌");
    } finally {
      issueBtn.disabled = false;
    }
  };
}

if (issueVisaBtn && visaForm) {
  issueVisaBtn.onclick = () => {
    visaForm.classList.remove("hidden");
    issueVisaBtn.disabled = true;
  };
}

if (confirmVisaBtn && visaTypeSelect) {
  confirmVisaBtn.onclick = async () => {

    const visaType = visaTypeSelect.value;

const expiryDate = expiryDateInput.value;

if (!expiryDate) {
  alert("Please select an expiry date");
  return;
}

    if (!visaType || !VISA_TYPE_CODES[visaType]) {
      alert("Please select a valid visa type");
      return;
    }

    confirmVisaBtn.disabled = true;

    try {
      const typeCode = VISA_TYPE_CODES[visaType];

      await runTransaction(db, async (transaction) => {

        const personRef = doc(db, "people", eBorder);
        const personSnap = await transaction.get(personRef);

        if (!personSnap.exists()) throw "Person not found";

        const personData = personSnap.data();

        if (personData.civil_status !== "visitor") {
          throw "Only visitors can receive visa";
        }

        if (personData.current_documents?.visa_id) {
          throw "Person already has a visa";
        }

        if (personData.person_status !== "active") {
          throw "Only active visitors allowed";
        }

        const counterRef = doc(db, "visa_counters", typeCode);
        const counterSnap = await transaction.get(counterRef);

        let nextNumber = 1;
        if (counterSnap.exists()) {
          nextNumber = counterSnap.data().last_number + 1;
        }

        const visaId = formatVisaId(typeCode, nextNumber);
        const visaRef = doc(db, "visas", visaId);

        transaction.set(visaRef, {
          owner_eborder_id: eBorder,
          visa_type: visaType,
          visa_status: "active",
          issued_at: serverTimestamp(),
          expiry_date: Timestamp.fromDate(new Date(expiryDate))
        });

transaction.update(personRef, {
  "current_documents.visa_id": visaId,
  has_visa_history: true,
  updated_at: serverTimestamp()
});

transaction.set(counterRef, {
  last_number: nextNumber
}, { merge: true });

      });

      alert("Visa issued successfully ✅");
      searchBtn.click();

    } catch (err) {
      console.error(err);
      alert(typeof err === "string" ? err : "Visa issuance failed ❌");
    } finally {
      confirmVisaBtn.disabled = false;
    }
  };
}

cancelBtn.onclick = () => {
  searchBtn.click(); // reload original data
};

document.getElementById("editStatus").value = person.person_status;
document.getElementById("editCivilStatus").value = person.civil_status;

editBtn.onclick = () => {
  document.querySelectorAll(".edit-field").forEach(el => el.classList.remove("hidden"));
  document.querySelectorAll("#nameText, #civilText, #statusText")
    .forEach(el => el.classList.add("hidden"));

  editBtn.classList.add("hidden");
  saveBtn.classList.remove("hidden");
  cancelBtn.classList.remove("hidden");
};

document.getElementById("saveBtn").onclick = async () => {
  const saveBtn = document.getElementById("saveBtn");
  saveBtn.disabled = true;

  const newName = document.getElementById("editName").value.trim();
  const newStatus = document.getElementById("editStatus").value;
  const newCivilStatus = document.getElementById("editCivilStatus").value;

  if (!newName) {
    alert("Name cannot be empty");
    saveBtn.disabled = false; // important
    return;
  }

  try {
    await runTransaction(db, async (transaction) => {
      const personRef = doc(db, "people", eBorder);
      const personSnap = await transaction.get(personRef);

      if (!personSnap.exists()) {
        throw "Person not found";
      }

      const personData = personSnap.data();
      const currentVisaId = personData.current_documents?.visa_id;
      // 🔒 lock civil ID (must not change)
      const currentCivilId = personData.current_documents?.civil_id;

      if (currentCivilId && newCivilStatus === "visitor") {
        throw "Cannot change to visitor while person has a Civil ID";
      }

      transaction.update(personRef, {
        full_name: newName,
        person_status: newStatus,
        civil_status: newCivilStatus,
        updated_at: serverTimestamp()
      });

// 🔁 VISA LIFECYCLE CONTROL
if (currentVisaId && newStatus === "Expired/Cancelled") {

  const visaRef = doc(db, "visas", currentVisaId);

  // update visa status
  transaction.update(visaRef, {
    visa_status: "Expired/Cancelled"
  });

  // remove visa from current_documents
transaction.update(personRef, {
  "current_documents.visa_id": deleteField(),
  updated_at: serverTimestamp()
});
}

if (currentCivilId) {
  const civilRef = doc(db, "civil_ids", currentCivilId);

  // map status correctly
  let newIdStatus;

  if (newStatus === "active") {
    newIdStatus = "active";
  } else if (newStatus === "inactive") {
    newIdStatus = "inactive";
  } else if (newStatus === "Expired/Cancelled") {
    newIdStatus = "inactive"; // treat as inactive for IDs
  }

  transaction.update(civilRef, {
    owner_type: newCivilStatus,
    id_status: newIdStatus
  });
}

    });

    alert("Updated successfully ✅");
    searchBtn.click();

  } catch (err) {
    console.error(err);
    alert(typeof err === "string" ? err : "Update failed ❌");
  } finally {
    saveBtn.disabled = false;
  }
};

  } catch (err) {
    console.error(err);
    profileCard.innerHTML = "Something went wrong";
  } finally {
    searchBtn.disabled = false;
  }
});
}