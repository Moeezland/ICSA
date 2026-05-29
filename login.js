import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { auth, db } from "./firebase.js";

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const loginMessage = document.getElementById("loginMessage");

function setMessage(message, type = "error") {
  loginMessage.textContent = message;
  loginMessage.className = `login-message ${type}`;
}

async function verifyOfficer(user) {
  const officerRef = doc(db, "officers", user.uid);
  const officerSnap = await getDoc(officerRef);

  if (!officerSnap.exists()) {
    throw new Error("This account is not registered as an ICSA officer.");
  }

  const officer = officerSnap.data();

  if (officer.active !== true) {
    throw new Error("This officer account is disabled.");
  }

  return officer;
}

onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  try {
    await verifyOfficer(user);
    window.location.href = "index.html";
  } catch (err) {
    await signOut(auth);
  }
});

loginBtn.onclick = async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    setMessage("Enter email and password.");
    return;
  }

  loginBtn.disabled = true;
  setMessage("Checking officer access...", "info");

  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    await verifyOfficer(credential.user);
    setMessage("Login successful ✅", "success");
    window.location.href = "index.html";
  } catch (err) {
    console.error(err);
    await signOut(auth);
    setMessage(err.message || "Login failed ❌");
  } finally {
    loginBtn.disabled = false;
  }
};

passwordInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") loginBtn.click();
});
